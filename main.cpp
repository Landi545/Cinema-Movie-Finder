// Wspólny silnik konsoli i Electron. Mapa modułów znajduje się w README.md.
// Kolejność: modele -> HTTP i tekst -> źródła kin -> łączenie -> punkty wejścia.
#include <curl/curl.h>
#include <libxml/HTMLparser.h>
#include <libxml/tree.h>
#include <json-c/json.h>
#ifdef _WIN32
#include <windows.h>
#endif

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <ctime>
#include <deque>
#include <future>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <regex>
#include <set>
#include <sstream>
#include <streambuf>
#include <string>
#include <vector>

// Dane kina są oddzielone od seansów: jedno kino może mieć wiele pokazów.
struct Cinema {
    std::string name;
    std::string address;
    std::string scheduleUrl;
    std::string id;
    std::string city;
};

struct Screening {
    std::string title;
    std::string time;
    std::string cinema;
    std::string address;
    std::string ticketUrl;
    std::string posterUrl = {};
};

enum class CinemaSource { Helios, Multikino, CinemaCity };

struct CinemaEntry {
    Cinema cinema;
    CinemaSource source;
};

CURLSH* sharedCookieStore = nullptr;
std::mutex sourceIssuesMutex;
std::set<std::string> sourceIssues;

void reportSourceIssue(const std::string& url) {
    std::lock_guard<std::mutex> guard(sourceIssuesMutex);
    if (url.find("helios.pl") != std::string::npos) sourceIssues.insert("Helios");
    else if (url.find("multikino.pl") != std::string::npos) sourceIssues.insert("Multikino");
    else if (url.find("cinema-city.pl") != std::string::npos) sourceIssues.insert("Cinema City");
    else if (url.find("filmweb.pl") != std::string::npos) sourceIssues.insert("Filmweb");
}

std::string replacePolishLetters(std::string value) {
    const std::array<std::pair<std::string, std::string>, 18> replacements = {{
        {"ą", "a"}, {"ć", "c"}, {"ę", "e"}, {"ł", "l"}, {"ń", "n"},
        {"ó", "o"}, {"ś", "s"}, {"ź", "z"}, {"ż", "z"}, {"Ą", "A"},
        {"Ć", "C"}, {"Ę", "E"}, {"Ł", "L"}, {"Ń", "N"}, {"Ó", "O"},
        {"Ś", "S"}, {"Ź", "Z"}, {"Ż", "Z"}
    }};
    for (const auto& [from, to] : replacements) {
        size_t position = 0;
        while ((position = value.find(from, position)) != std::string::npos) {
            value.replace(position, from.size(), to);
            position += to.size();
        }
    }
    return value;
}

class ConsoleAsciiBuf : public std::streambuf {
public:
    explicit ConsoleAsciiBuf(std::streambuf* destination) : destination(destination) {}

protected:
    int sync() override {
        flushPending(true);
        return destination->pubsync();
    }

    int overflow(int character) override {
        if (character == EOF) {
            flushPending(true);
            return EOF;
        }
        const char byte = static_cast<char>(character);
        return xsputn(&byte, 1) == 1 ? character : EOF;
    }

    std::streamsize xsputn(const char* data, std::streamsize count) override {
        pending.append(data, static_cast<size_t>(count));
        flushPending(false);
        return count;
    }

private:
    std::streambuf* destination;
    std::string pending;

    static size_t completeUtf8Length(const std::string& text) {
        size_t index = 0;
        while (index < text.size()) {
            const unsigned char lead = static_cast<unsigned char>(text[index]);
            size_t width = 1;
            if ((lead & 0x80) == 0) width = 1;
            else if ((lead & 0xE0) == 0xC0) width = 2;
            else if ((lead & 0xF0) == 0xE0) width = 3;
            else if ((lead & 0xF8) == 0xF0) width = 4;
            if (index + width > text.size()) break;
            index += width;
        }
        return index;
    }

    void flushPending(bool flushAll) {
        const size_t complete = flushAll ? pending.size() : completeUtf8Length(pending);
        if (complete == 0) return;
        const std::string converted = replacePolishLetters(pending.substr(0, complete));
        pending.erase(0, complete);
        destination->sputn(converted.data(), static_cast<std::streamsize>(converted.size()));
    }
};

class ConsoleAsciiGuard {
public:
    explicit ConsoleAsciiGuard(std::ostream& stream)
        : stream(stream), buffer(stream.rdbuf()), previous(stream.rdbuf()) {
        stream.rdbuf(&buffer);
    }

    ~ConsoleAsciiGuard() {
        stream.flush();
        stream.rdbuf(previous);
    }

    ConsoleAsciiGuard(const ConsoleAsciiGuard&) = delete;
    ConsoleAsciiGuard& operator=(const ConsoleAsciiGuard&) = delete;

private:
    std::ostream& stream;
    ConsoleAsciiBuf buffer;
    std::streambuf* previous;
};

std::string trim(const std::string& value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return {};
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

std::string collapseWhitespace(const std::string& value) {
    std::string result;
    bool previousWasSpace = true;
    for (unsigned char character : value) {
        if (std::isspace(character)) {
            if (!previousWasSpace) result += ' ';
            previousWasSpace = true;
        } else {
            result += static_cast<char>(character);
            previousWasSpace = false;
        }
    }
    return trim(result);
}

size_t writeResponse(char* data, size_t size, size_t count, void* output) {
    const size_t bytes = size * count;
    static_cast<std::string*>(output)->append(data, bytes);
    return bytes;
}

// Wspólna warstwa HTTP; awarie źródeł są zgłaszane jako ostrzeżenia repertuaru.
std::optional<std::string> download(const std::string& url) {
#ifdef CINEMA_MOBILE
    if (interrupted()) return std::nullopt;
#endif
    CURL* handle = curl_easy_init();
    if (!handle) return std::nullopt;

    std::string response;
    curl_easy_setopt(handle, CURLOPT_URL, url.c_str());
    curl_easy_setopt(handle, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(handle, CURLOPT_CONNECTTIMEOUT, 10L);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 25L);
#ifdef CINEMA_MOBILE
    // Przerywamy także równoległe pobrania; weryfikacja TLS pozostaje włączona.
    curl_blob ca{const_cast<char*>(certificates), sizeof(certificates) - 1, CURL_BLOB_NOCOPY};
    curl_easy_setopt(handle, CURLOPT_CAINFO_BLOB, &ca);
    curl_easy_setopt(handle, CURLOPT_NOPROGRESS, 0L);
    curl_easy_setopt(handle, CURLOPT_XFERINFOFUNCTION,
        +[](void*, curl_off_t, curl_off_t, curl_off_t, curl_off_t) -> int { return interrupted() ? 1 : 0; });
#endif
    curl_easy_setopt(handle, CURLOPT_USERAGENT,
                     "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36");
    curl_easy_setopt(handle, CURLOPT_ACCEPT_ENCODING, "");
#ifdef _WIN32
    curl_easy_setopt(handle, CURLOPT_CAINFO, "cacert.pem");
#endif
    if (sharedCookieStore && url.find("www.multikino.pl") != std::string::npos) {
        curl_easy_setopt(handle, CURLOPT_COOKIEFILE, "");
        curl_easy_setopt(handle, CURLOPT_SHARE, sharedCookieStore);
    }
    curl_slist* headers = nullptr;
    if (url.find("www.multikino.pl/api/") != std::string::npos) {
        headers = curl_slist_append(headers, "Origin: https://www.multikino.pl");
        headers = curl_slist_append(headers, "Accept: application/json, text/plain, */*");
        curl_easy_setopt(handle, CURLOPT_REFERER, "https://www.multikino.pl/repertuar/");
        curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);
    }
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, writeResponse);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response);

    const CURLcode result = curl_easy_perform(handle);
    long statusCode = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &statusCode);
    if (headers) curl_slist_free_all(headers);
    curl_easy_cleanup(handle);

    if (result != CURLE_OK || statusCode < 200 || statusCode >= 300) {
        reportSourceIssue(url);
        std::cerr << "Download failed: " << url << " (HTTP " << statusCode
                  << ", " << curl_easy_strerror(result) << ")\n";
        return std::nullopt;
    }
    return response;
}

std::string nodeText(xmlNode* node) {
    xmlChar* content = xmlNodeGetContent(node);
    if (!content) return {};
    std::string result(reinterpret_cast<const char*>(content));
    xmlFree(content);
    return collapseWhitespace(result);
}

std::string nodeAttribute(xmlNode* node, const char* name) {
    xmlChar* value = xmlGetProp(node, BAD_CAST name);
    if (!value) return {};
    std::string result(reinterpret_cast<const char*>(value));
    xmlFree(value);
    return result;
}

void collectNodes(xmlNode* node, std::vector<xmlNode*>& result) {
    for (xmlNode* current = node; current; current = current->next) {
        if (current->type == XML_ELEMENT_NODE) result.push_back(current);
        collectNodes(current->children, result);
    }
}

std::string dateQuery(const std::string& url, const std::string& date) {
    return url + "?date=" + date;
}

std::string polishDate(const std::string& isoDate) {
    static const std::array<std::string, 12> months = {
        "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
        "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
    };
    const int year = std::stoi(isoDate.substr(0, 4));
    const int month = std::stoi(isoDate.substr(5, 2));
    const int day = std::stoi(isoDate.substr(8, 2));
    return std::to_string(day) + " " + months.at(static_cast<size_t>(month - 1)) + " " + std::to_string(year);
}

bool hasTargetDate(const std::string& text, const std::string& isoDate) {
    return text.find(polishDate(isoDate)) != std::string::npos;
}

std::string lowerAscii(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return value;
}

// Klucz służy tylko do porównywania; wyświetlane tytuły zachowują oryginalną pisownię.
std::string normalizePolish(std::string value) {
    const std::array<std::pair<std::string, std::string>, 18> replacements = {{
        {"ą", "a"}, {"ć", "c"}, {"ę", "e"}, {"ł", "l"}, {"ń", "n"},
        {"ó", "o"}, {"ś", "s"}, {"ź", "z"}, {"ż", "z"}, {"Ą", "a"},
        {"Ć", "c"}, {"Ę", "e"}, {"Ł", "l"}, {"Ń", "n"}, {"Ó", "o"},
        {"Ś", "s"}, {"Ź", "z"}, {"Ż", "z"}
    }};
    for (const auto& [from, to] : replacements) {
        size_t position = 0;
        while ((position = value.find(from, position)) != std::string::npos) {
            value.replace(position, from.size(), to);
            position += to.size();
        }
    }
    value = lowerAscii(collapseWhitespace(value));
    std::string result;
    bool previousWasSpace = true;
    for (unsigned char character : value) {
        if (std::isalnum(character)) {
            result += static_cast<char>(character);
            previousWasSpace = false;
        } else if (!previousWasSpace) {
            result += ' ';
            previousWasSpace = true;
        }
    }
    return trim(result);
}

std::string urlEncode(const std::string& value);

std::string titleCasePolish(std::string value) {
    const std::array<std::pair<std::string, std::string>, 18> replacements = {{
        {"Ą", "ą"}, {"Ć", "ć"}, {"Ę", "ę"}, {"Ł", "ł"}, {"Ń", "ń"},
        {"Ó", "ó"}, {"Ś", "ś"}, {"Ź", "ź"}, {"Ż", "ż"}, {"ą", "ą"},
        {"ć", "ć"}, {"ę", "ę"}, {"ł", "ł"}, {"ń", "ń"}, {"ó", "ó"},
        {"ś", "ś"}, {"ź", "ź"}, {"ż", "ż"}
    }};
    for (const auto& [from, to] : replacements) {
        size_t position = 0;
        while ((position = value.find(from, position)) != std::string::npos) {
            value.replace(position, from.size(), to);
            position += to.size();
        }
    }
    value = lowerAscii(collapseWhitespace(value));
    bool capitalize = true;
    const std::array<std::pair<std::string, std::string>, 9> polishUppercase = {{
        {"ą", "Ą"}, {"ć", "Ć"}, {"ę", "Ę"}, {"ł", "Ł"}, {"ń", "Ń"},
        {"ó", "Ó"}, {"ś", "Ś"}, {"ź", "Ź"}, {"ż", "Ż"}
    }};
    std::string result;
    for (size_t index = 0; index < value.size();) {
        if (value[index] == ' ' || value[index] == '-') {
            result += value[index++];
            capitalize = true;
            continue;
        }
        if (capitalize) {
            bool replaced = false;
            for (const auto& [lower, upper] : polishUppercase) {
                if (value.compare(index, lower.size(), lower) == 0) {
                    result += upper;
                    index += lower.size();
                    replaced = true;
                    break;
                }
            }
            if (replaced) {
                capitalize = false;
                continue;
            }
            result += static_cast<char>(std::toupper(static_cast<unsigned char>(value[index++])));
            capitalize = false;
            continue;
        }
        result += value[index++];
    }
    return result;
}

std::string resolveCityName(const std::string& input) {
    const std::string normalizedInput = titleCasePolish(input);
    const std::string url = "https://www.filmweb.pl/showtimes/" + urlEncode(normalizedInput);
    const auto html = download(url);
    if (!html) return normalizedInput;
    htmlDocPtr document = htmlReadMemory(html->data(), static_cast<int>(html->size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return normalizedInput;
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    std::string canonical;
    for (xmlNode* node : nodes) {
        if (nodeAttribute(node, "data-city-name").empty()) continue;
        canonical = nodeAttribute(node, "data-city-name");
        if (normalizePolish(canonical) == normalizePolish(input)) break;
        canonical.clear();
    }
    xmlFreeDoc(document);
    return canonical.empty() ? normalizedInput : canonical;
}

std::string jsonString(json_object* object, const char* key) {
    json_object* value = nullptr;
    if (!object || !json_object_object_get_ex(object, key, &value) ||
        !json_object_is_type(value, json_type_string)) return {};
    return json_object_get_string(value);
}

bool hasClass(xmlNode* node, const std::string& className) {
    const std::string classes = nodeAttribute(node, "class");
    std::istringstream stream(classes);
    std::string token;
    while (stream >> token) {
        if (token == className) return true;
    }
    return false;
}

void collectSubtree(xmlNode* node, std::vector<xmlNode*>& result) {
    if (!node) return;
    if (node->type == XML_ELEMENT_NODE) result.push_back(node);
    for (xmlNode* child = node->children; child; child = child->next) {
        collectSubtree(child, result);
    }
}

bool hasAncestorClass(xmlNode* node, const std::string& className) {
    for (xmlNode* ancestor = node->parent; ancestor; ancestor = ancestor->parent) {
        if (hasClass(ancestor, className)) return true;
    }
    return false;
}

std::string urlEncode(const std::string& value) {
    static const char hex[] = "0123456789ABCDEF";
    std::string result;
    for (unsigned char character : value) {
        if (std::isalnum(character) || character == '-' || character == '_' || character == '.' || character == '~') {
            result += static_cast<char>(character);
        } else {
            result += '%';
            result += hex[character >> 4];
            result += hex[character & 0x0F];
        }
    }
    return result;
}

int filmwebDayOffset(const std::string& isoDate) {
    using namespace std::chrono;
    const year_month_day selected{year{std::stoi(isoDate.substr(0, 4))},
                                  month{static_cast<unsigned>(std::stoi(isoDate.substr(5, 2)))},
                                  day{static_cast<unsigned>(std::stoi(isoDate.substr(8, 2)))}};
    const auto now = std::time(nullptr);
    const auto local = *std::localtime(&now);
    const sys_days today = year{local.tm_year + 1900}/month{static_cast<unsigned>(local.tm_mon + 1)}/day{static_cast<unsigned>(local.tm_mday)};
    return static_cast<int>((sys_days{selected} - today).count());
}

std::string filmwebAddress(const std::string& cinemaPageUrl) {
    const auto html = download(cinemaPageUrl);
    if (!html) return {};
    htmlDocPtr document = htmlReadMemory(html->data(), static_cast<int>(html->size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return {};
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    std::string street;
    std::string locality;
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "meta") != 0) continue;
        const std::string property = nodeAttribute(node, "itemprop");
        if (property == "streetAddress") street = nodeAttribute(node, "content");
        if (property == "addressLocality") locality = nodeAttribute(node, "content");
    }
    xmlFreeDoc(document);
    if (street.empty()) return {};
    return street + (locality.empty() ? "" : ", " + locality);
}

std::vector<Screening> parseFilmwebShowtimes(const std::string& html, const std::string& city,
                                             const std::string& date, const std::string& title) {
    std::vector<Screening> result;
    htmlDocPtr document = htmlReadMemory(html.data(), static_cast<int>(html.size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return result;
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    for (xmlNode* node : nodes) {
        if (!hasClass(node, "seanceTiles")) continue;
        std::vector<xmlNode*> children;
        collectSubtree(node, children);
        std::string cinemaName;
        std::string cinemaCity;
        std::string cinemaUrl;
        for (xmlNode* child : children) {
            if (hasClass(child, "seanceTiles__title")) {
                cinemaName = nodeText(child);
                cinemaUrl = nodeAttribute(child, "href");
            } else if (hasClass(child, "seanceTiles__subtitle")) {
                cinemaCity = nodeText(child);
            }
        }
        // Strony pojedynczego miasta pomijają podtytuł. Adres URL kina nadal określa
        // jego miasto, również na stronach zawierających sąsiednie miejscowości.
        if (cinemaCity.empty()) {
            const auto prefix = cinemaUrl.find("/showtimes/");
            if (prefix != std::string::npos) {
                const auto start = prefix + 11;
                auto encoded = cinemaUrl.substr(start, cinemaUrl.find('/', start) - start);
                std::replace(encoded.begin(), encoded.end(), '+', ' ');
                char* decoded = curl_easy_unescape(nullptr, encoded.c_str(), static_cast<int>(encoded.size()), nullptr);
                if (decoded) { cinemaCity = decoded; curl_free(decoded); }
            }
        }
        if (normalizePolish(cinemaCity) != normalizePolish(city) || cinemaName.empty()) continue;
        const std::string fullCinemaUrl = cinemaUrl.rfind("http", 0) == 0
            ? cinemaUrl : "https://www.filmweb.pl" + cinemaUrl;
        for (xmlNode* child : children) {
            if (!hasClass(child, "seanceTile") || nodeAttribute(child, "data-date") != date) continue;
            const std::string time = nodeAttribute(child, "data-value");
            if (time.size() != 5) continue;
            result.push_back({title, time, cinemaName, {}, fullCinemaUrl});
        }
    }
    xmlFreeDoc(document);
    return result;
}

// Filmweb uzupełnia bezpośrednie źródła; odnośniki mogą prowadzić do listy seansów.
std::vector<Screening> fetchFilmwebScreenings(const std::string& city, const std::string& date) {
    const int dayOffset = filmwebDayOffset(date);
    if (dayOffset < 0 || dayOffset > 30) return {};
    const std::string encodedCity = urlEncode(city);
    const std::string cityPath = "/showtimes/" + encodedCity;
    std::string cityUrl = "https://www.filmweb.pl" + cityPath;
    if (dayOffset > 0) cityUrl += "?day=" + std::to_string(dayOffset);
    const auto cityPage = download(cityUrl);
    if (!cityPage) return {};
    htmlDocPtr document = htmlReadMemory(cityPage->data(), static_cast<int>(cityPage->size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return {};
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    std::map<std::string, std::string> filmPages;
    const bool isShowtimesPage = std::any_of(nodes.begin(), nodes.end(), [](xmlNode* node) {
        return hasClass(node, "showtimesHeaderSection");
    });
    if (!isShowtimesPage) reportSourceIssue("filmweb.pl");
    const std::regex filmPathPattern(R"(^/film/[^/]+$)");
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "a") != 0) continue;
        if (!hasAncestorClass(node, "showtimesFilmsItem")) continue;
        const std::string href = nodeAttribute(node, "href");
        if (!std::regex_match(href, filmPathPattern)) continue;
        const std::string title = nodeText(node);
        if (!title.empty()) filmPages.emplace(href, title);
    }
    xmlFreeDoc(document);

    std::vector<Screening> result;
    std::deque<std::future<std::vector<Screening>>> requests;
    for (const auto& [filmPath, title] : filmPages) {
        std::string url = "https://www.filmweb.pl" + filmPath + "/showtimes/" + encodedCity;
        if (dayOffset > 0) url += "?day=" + std::to_string(dayOffset);
        requests.push_back(std::async(std::launch::async, [url, city, date, title] {
            const auto html = download(url);
            return html ? parseFilmwebShowtimes(*html, city, date, title) : std::vector<Screening>{};
        }));
        if (requests.size() >= 8) {
            auto found = requests.front().get();
            result.insert(result.end(), found.begin(), found.end());
            requests.pop_front();
        }
    }
    for (auto& request : requests) {
        auto found = request.get();
        result.insert(result.end(), found.begin(), found.end());
    }
    return result;
}

json_object* parseJson(const std::string& text) {
    return json_tokener_parse(text.c_str());
}

std::string findHeliosAddress(const std::string& html, const std::string& city) {
    htmlDocPtr document = htmlReadMemory(html.data(), static_cast<int>(html.size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return {};
    const std::string text = nodeText(xmlDocGetRootElement(document));
    xmlFreeDoc(document);

    const std::string searchableText = lowerAscii(text);
    const std::regex postalPattern(R"(\b\d{2}-\d{3}\b)");
    for (std::sregex_iterator it(text.begin(), text.end(), postalPattern), end; it != end; ++it) {
        const size_t postalPosition = static_cast<size_t>(it->position());
        const std::string afterPostal = text.substr(postalPosition + static_cast<size_t>(it->length()), 100);
        if (normalizePolish(afterPostal).find(normalizePolish(city)) == std::string::npos) continue;
        size_t start = std::string::npos;
        for (const std::string marker : {"ul.", "al.", "pl."}) {
            const size_t position = searchableText.rfind(marker, postalPosition);
            if (position != std::string::npos && (start == std::string::npos || position > start)) start = position;
        }
        if (start == std::string::npos || postalPosition - start > 180) continue;
        return trim(text.substr(start, postalPosition + static_cast<size_t>(it->length()) - start)) + " " + city;
    }
    return {};
}

std::string titleFromSlug(const std::string& slug) {
    std::string result = slug;
    std::replace(result.begin(), result.end(), '-', ' ');
    bool capitalize = true;
    for (char& character : result) {
        if (character == ' ') capitalize = true;
        else if (capitalize) {
            character = static_cast<char>(std::toupper(static_cast<unsigned char>(character)));
            capitalize = false;
        }
    }
    return result;
}

// Helios: wyszukujemy kina i przekształcamy odpowiedzi API we wspólne modele.
std::vector<CinemaEntry> parseHeliosCinemas(const std::string& text, const std::string& city) {
    std::vector<CinemaEntry> result;
    json_object* root = parseJson(text);
    json_object* data = nullptr;
    if (!root || !json_object_object_get_ex(root, "data", &data) || !json_object_is_type(data, json_type_array)) {
        if (root) json_object_put(root);
        reportSourceIssue("helios.pl");
        return result;
    }
    for (size_t i = 0; i < json_object_array_length(data); ++i) {
        auto* item = json_object_array_get_idx(data, i);
        json_object* location = nullptr;
        json_object* id = nullptr;
        if (!json_object_object_get_ex(item, "location", &location) ||
            !json_object_object_get_ex(item, "id", &id)) continue;
        const auto cityName = jsonString(location, "city");
        if (normalizePolish(cityName) != normalizePolish(city)) continue;
        auto slug = normalizePolish(cityName);
        std::replace(slug.begin(), slug.end(), ' ', '-');
        result.push_back({{jsonString(item, "header"), jsonString(location, "street") + ", " + cityName,
            "https://helios.pl/" + slug + "/" + jsonString(item, "slug") + "/repertuar",
            json_object_get_string(id), cityName}, CinemaSource::Helios});
    }
    json_object_put(root);
    return result;
}

std::vector<Screening> parseHeliosApi(const std::string& text, const Cinema& cinema, const std::string& date) {
    std::vector<Screening> result;
    json_object* root = parseJson(text);
    json_object *data = nullptr, *days = nullptr, *day = nullptr, *movies = nullptr, *events = nullptr;
    if (!root || !json_object_object_get_ex(root, "data", &data) ||
        !json_object_object_get_ex(data, "screenings", &days) || !json_object_is_type(days, json_type_object)) {
        if (root) json_object_put(root);
        reportSourceIssue("helios.pl");
        return result;
    }
    json_object_object_get_ex(data, "movies", &movies);
    json_object_object_get_ex(data, "events", &events);
    if (json_object_object_get_ex(days, date.c_str(), &day) && json_object_is_type(day, json_type_object)) {
        json_object_object_foreach(day, key, group) {
            json_object *movie = nullptr, *sessions = nullptr;
            if (movies) json_object_object_get_ex(movies, key, &movie);
            if (!movie && events) json_object_object_get_ex(events, key, &movie);
            auto title = jsonString(movie, "title");
            if (title.empty()) title = jsonString(movie, "name");
            if (!json_object_object_get_ex(group, "screenings", &sessions) ||
                !json_object_is_type(sessions, json_type_array)) continue;
            for (size_t i = 0; i < json_object_array_length(sessions); ++i) {
                auto* session = json_object_array_get_idx(sessions, i);
                auto sessionTitle = title;
                json_object* poster = nullptr;
                if (movie) json_object_object_get_ex(movie, "posterPhoto", &poster);
                auto posterUrl = jsonString(poster, "url");
                if (sessionTitle.empty()) {
                    json_object* screeningMovies = nullptr;
                    if (json_object_object_get_ex(session, "screeningMovies", &screeningMovies) &&
                        json_object_is_type(screeningMovies, json_type_array)) {
                        for (size_t movieIndex = 0; movieIndex < json_object_array_length(screeningMovies); ++movieIndex) {
                            auto* screeningMovie = json_object_array_get_idx(screeningMovies, movieIndex);
                            json_object* movieDetails = nullptr;
                            if (!json_object_object_get_ex(screeningMovie, "movie", &movieDetails)) continue;
                            sessionTitle = jsonString(movieDetails, "title");
                            if (sessionTitle.empty()) sessionTitle = jsonString(movieDetails, "name");
                            if (!sessionTitle.empty()) {
                                poster = nullptr;
                                json_object_object_get_ex(movieDetails, "posterPhoto", &poster);
                                posterUrl = jsonString(poster, "url");
                                break;
                            }
                        }
                    }
                }
                const auto start = jsonString(session, "timeFrom");
                const auto id = jsonString(session, "sourceId");
                const auto cinemaId = jsonString(session, "cinemaSourceId");
                if (sessionTitle.empty() || start.size() < 16 || start.substr(0, 10) != date ||
                    id.empty() || cinemaId.empty()) continue;
                result.push_back({sessionTitle, start.substr(11, 5), cinema.name, cinema.address,
                    "https://bilety.helios.pl/screen/" + urlEncode(id) + "?cinemaId=" + urlEncode(cinemaId) +
                    "&backUrl=" + urlEncode(cinema.scheduleUrl), posterUrl});
            }
        }
    }
    json_object_put(root);
    return result;
}

// Katalog Heliosa obejmuje filmy dostępne także w inne dni niż wybrany repertuar.
// Dopasowujemy wyłącznie pełny, znormalizowany tytuł, żeby nie pomylić podobnych filmów.
void addHeliosPosterCatalog(const std::string& text, std::map<std::string, std::string>& catalog) {
    json_object* root = parseJson(text);
    json_object* data = nullptr;
    if (!root || !json_object_object_get_ex(root, "data", &data)) {
        if (root) json_object_put(root);
        return;
    }
    for (const char* collection : {"movies", "events"}) {
        json_object* entries = nullptr;
        if (!json_object_object_get_ex(data, collection, &entries) ||
            !json_object_is_type(entries, json_type_object)) continue;
        json_object_object_foreach(entries, _key, movie) {
            (void)_key;
            auto title = jsonString(movie, "title");
            if (title.empty()) title = jsonString(movie, "name");
            json_object* poster = nullptr;
            json_object_object_get_ex(movie, "posterPhoto", &poster);
            const auto url = jsonString(poster, "url");
            if (!title.empty() && !url.empty()) catalog.emplace(normalizePolish(title), url);
        }
    }
    json_object_put(root);
}

std::vector<CinemaEntry> fetchHeliosCinemas(const std::string& city) {
    const auto api = download("https://api.helios.pl/api/v1/cinemas");
    if (api) {
        auto cinemas = parseHeliosCinemas(*api, city);
        // Poprawna lista bez pasującego kina nie oznacza awarii źródła.
        json_object* root = parseJson(*api);
        json_object* data = nullptr;
        const bool valid = root && json_object_object_get_ex(root, "data", &data) &&
            json_object_is_type(data, json_type_array);
        if (root) json_object_put(root);
        if (valid) return cinemas;
    }
    std::vector<CinemaEntry> result;
    const auto directory = download("https://helios.pl/nasze-kina");
    if (!directory) return result;
    htmlDocPtr document = htmlReadMemory(directory->data(), static_cast<int>(directory->size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return result;

    const std::string citySlug = normalizePolish(city);
    std::string wantedSlug = citySlug;
    std::replace(wantedSlug.begin(), wantedSlug.end(), ' ', '-');
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    std::set<std::string> seen;
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "a") != 0) continue;
        const std::string path = nodeAttribute(node, "href");
        const std::string cityPrefix = "/" + wantedSlug + "/";
        if (path.rfind(cityPrefix, 0) != 0 || !seen.insert(path).second) continue;
        const std::string slug = path.substr(cityPrefix.size());
        if (slug.rfind("kino-helios", 0) != 0 && slug.rfind("helios-", 0) != 0) continue;

        std::string suffix = slug.rfind("kino-helios", 0) == 0
            ? slug.substr(std::string("kino-helios").size())
            : slug.substr(std::string("helios-").size());
        if (!suffix.empty() && suffix.front() == '-') suffix.erase(0, 1);
        const std::string cinemaName = suffix.empty() ? "Helios" : "Helios " + titleFromSlug(suffix);
        const std::string pageUrl = "https://helios.pl" + path;
        const auto details = download(pageUrl + "/o-kinie");
        const std::string address = details ? findHeliosAddress(*details, city) : std::string{};
        const std::string scheduleUrl = pageUrl + "/repertuar";
        result.push_back({{cinemaName, address, scheduleUrl, {}, city}, CinemaSource::Helios});
    }
    xmlFreeDoc(document);
    return result;
}

bool cityMatches(const std::string& venue, const std::string& city) {
    const std::string normalizedVenue = normalizePolish(venue);
    const std::string normalizedCity = normalizePolish(city);
    return normalizedVenue == normalizedCity ||
           normalizedVenue.rfind(normalizedCity + " ", 0) == 0;
}

// Multikino: znajdujemy kina pasujące do wybranego miasta.
std::vector<CinemaEntry> fetchMultikinoCinemas(const std::string& city) {
    std::vector<CinemaEntry> result;
    // Przed wywołaniem API ustanawiamy sesję witryny za pomocą plików cookie.
    download("https://www.multikino.pl/");
    const auto response = download("https://www.multikino.pl/api/microservice/showings/cinemas");
    if (!response) return result;
    json_object* root = parseJson(*response);
    json_object* venues = nullptr;
    if (!root || !json_object_object_get_ex(root, "result", &venues) ||
        !json_object_is_type(venues, json_type_array)) {
        if (root) json_object_put(root);
        reportSourceIssue("multikino.pl");
        return result;
    }

    const size_t venueCount = json_object_array_length(venues);
    for (size_t i = 0; i < venueCount; ++i) {
        json_object* group = json_object_array_get_idx(venues, i);
        json_object* cinemas = nullptr;
        if (!json_object_object_get_ex(group, "cinemas", &cinemas) ||
            !json_object_is_type(cinemas, json_type_array)) continue;
        const size_t cinemaCount = json_object_array_length(cinemas);
        for (size_t j = 0; j < cinemaCount; ++j) {
            json_object* item = json_object_array_get_idx(cinemas, j);
            const std::string name = jsonString(item, "cinemaName");
            if (!cityMatches(name, city)) continue;
            std::string scheduleUrl = jsonString(item, "whatsOnUrl");
            if (scheduleUrl.empty()) continue;
            result.push_back({{"Multikino " + name, {}, scheduleUrl,
                               jsonString(item, "cinemaId"), city},
                              CinemaSource::Multikino});
        }
    }
    json_object_put(root);
    return result;
}

// Cinema City: żądania kin i seansów korzystają z identyfikatorów danego źródła.
std::vector<CinemaEntry> fetchCinemaCityCinemas(const std::string& city, const std::string& date) {
    std::vector<CinemaEntry> result;
    const std::string url = "https://www.cinema-city.pl/pl/data-api-service/v1/quickbook/10103/"
                            "cinemas/with-event/until/" + date;
    const auto response = download(url);
    if (!response) return result;
    json_object* root = parseJson(*response);
    json_object* body = nullptr;
    json_object* cinemas = nullptr;
    if (!root || !json_object_object_get_ex(root, "body", &body) ||
        !json_object_object_get_ex(body, "cinemas", &cinemas) ||
        !json_object_is_type(cinemas, json_type_array)) {
        if (root) json_object_put(root);
        reportSourceIssue("cinema-city.pl");
        return result;
    }
    const size_t count = json_object_array_length(cinemas);
    for (size_t i = 0; i < count; ++i) {
        json_object* item = json_object_array_get_idx(cinemas, i);
        json_object* addressInfo = nullptr;
        json_object_object_get_ex(item, "addressInfo", &addressInfo);
        const std::string cityName = jsonString(addressInfo, "city");
        if (normalizePolish(cityName) != normalizePolish(city)) continue;
        const std::string street = jsonString(addressInfo, "address1");
        const std::string postalCode = jsonString(addressInfo, "postalCode");
        const std::string address = street + (postalCode.empty() ? "" : ", " + postalCode) +
                                    (cityName.empty() ? "" : " " + cityName);
        result.push_back({{"Cinema City " + jsonString(item, "displayName"), address, {},
                           jsonString(item, "id"), cityName}, CinemaSource::CinemaCity});
    }
    json_object_put(root);
    return result;
}

std::vector<Screening> parseMultikinoApi(const std::string& text, const Cinema& cinema, const std::string& date) {
    json_object* root = parseJson(text);
    json_object* films = nullptr;
    if (!root || !json_object_object_get_ex(root, "result", &films) ||
        !json_object_is_type(films, json_type_array)) {
        if (root) json_object_put(root);
        reportSourceIssue("multikino.pl");
        return {};
    }

    std::vector<Screening> result;
    const size_t filmCount = json_object_array_length(films);
    for (size_t i = 0; i < filmCount; ++i) {
        json_object* film = json_object_array_get_idx(films, i);
        std::string title = jsonString(film, "filmTitle");
        if (title.empty()) title = jsonString(film, "filmName");
        if (title.empty()) title = jsonString(film, "title");
        if (title.empty()) title = jsonString(film, "name");
        json_object* filmData = nullptr;
        if (title.empty() && json_object_object_get_ex(film, "film", &filmData)) {
            title = jsonString(filmData, "name");
        }
        json_object* groups = nullptr;
        if (title.empty() || !json_object_object_get_ex(film, "showingGroups", &groups) ||
            !json_object_is_type(groups, json_type_array)) continue;
        const size_t groupCount = json_object_array_length(groups);
        for (size_t j = 0; j < groupCount; ++j) {
            json_object* group = json_object_array_get_idx(groups, j);
            json_object* sessions = nullptr;
            if (!json_object_object_get_ex(group, "sessions", &sessions) ||
                !json_object_is_type(sessions, json_type_array)) continue;
            const size_t sessionCount = json_object_array_length(sessions);
            for (size_t k = 0; k < sessionCount; ++k) {
                json_object* session = json_object_array_get_idx(sessions, k);
                const std::string start = jsonString(session, "startTime");
                const std::string booking = jsonString(session, "bookingUrl");
                if (start.size() < 16 || start.substr(0, 10) != date) continue;
                const std::string ticketUrl = booking.empty() ? cinema.scheduleUrl : booking.rfind("http", 0) == 0
                    ? booking : "https://www.multikino.pl" + booking;
                result.push_back({title, start.substr(11, 5), cinema.name, {}, ticketUrl,
                    jsonString(film, "posterImageSrc")});
            }
        }
    }
    json_object_put(root);
    return result;
}

std::vector<Screening> fetchMultikinoScreenings(const Cinema& cinema, const std::string& date) {
    download(cinema.scheduleUrl + "?day=" + date);
    const std::string url = "https://www.multikino.pl/api/microservice/showings/cinemas/" +
        cinema.id + "/films?showingDate=" + date + "T00:00:00&minEmbargoLevel=3&"
        "includesSession=true&includeSessionAttributes=true";
    const auto response = download(url);
    return response ? parseMultikinoApi(*response, cinema, date) : std::vector<Screening>{};
}

std::vector<Screening> parseCinemaCityApi(const std::string& text, const Cinema& cinema, const std::string& date) {
    json_object* root = parseJson(text);
    json_object* body = nullptr;
    json_object* films = nullptr;
    json_object* events = nullptr;
    if (!root || !json_object_object_get_ex(root, "body", &body) ||
        !json_object_object_get_ex(body, "films", &films) ||
        !json_object_object_get_ex(body, "events", &events) ||
        !json_object_is_type(films, json_type_array) || !json_object_is_type(events, json_type_array)) {
        if (root) json_object_put(root);
        reportSourceIssue("cinema-city.pl");
        return {};
    }

    std::map<std::string, std::string> titles;
    // Plakat pochodzi z tego samego rekordu filmu co tytuł, bez wyszukiwania po nazwie.
    std::map<std::string, std::string> posters;
    for (size_t i = 0; i < json_object_array_length(films); ++i) {
        json_object* film = json_object_array_get_idx(films, i);
        titles[jsonString(film, "id")] = jsonString(film, "name");
        posters[jsonString(film, "id")] = jsonString(film, "posterLink");
    }
    std::vector<Screening> result;
    for (size_t i = 0; i < json_object_array_length(events); ++i) {
        json_object* event = json_object_array_get_idx(events, i);
        const std::string filmId = jsonString(event, "filmId");
        const auto title = titles.find(filmId);
        const std::string start = jsonString(event, "eventDateTime");
        if (title == titles.end() || start.size() < 16 || start.substr(0, 10) != date) continue;
        std::string ticketUrl = jsonString(event, "bookingRouterLaunchLink");
        if (ticketUrl.empty()) ticketUrl = jsonString(event, "bookingLink");
        result.push_back({title->second, start.substr(11, 5), cinema.name, cinema.address, ticketUrl, posters[filmId]});
    }
    json_object_put(root);
    return result;
}

std::vector<Screening> fetchCinemaCityScreenings(const Cinema& cinema, const std::string& date) {
    const std::string url = "https://www.cinema-city.pl/pl/data-api-service/v1/quickbook/10103/"
        "film-events/in-cinema/" + cinema.id + "/at-date/" + date;
    const auto response = download(url);
    return response ? parseCinemaCityApi(*response, cinema, date) : std::vector<Screening>{};
}

std::string fetchMultikinoAddress(const Cinema& cinema) {
    const auto page = download(cinema.scheduleUrl);
    if (!page) return {};
    htmlDocPtr document = htmlReadMemory(page->data(), static_cast<int>(page->size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return {};
    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    std::string address;
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "address") == 0) {
            address = nodeText(node);
            break;
        }
    }
    xmlFreeDoc(document);
    std::smatch postal;
    if (std::regex_search(address, postal, std::regex(R"(\d{2}-\d{3})"))) {
        address.insert(static_cast<size_t>(postal.position()), " ");
    }
    return collapseWhitespace(address);
}

std::vector<Screening> parseHelios(const std::string& html, const Cinema& cinema,
                                   const std::string& date) {
    std::vector<Screening> result;
    htmlDocPtr document = htmlReadMemory(html.data(), static_cast<int>(html.size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return result;

    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    const std::regex titlePattern(R"REGEX(Kup bilet na "(.+)", seans o ([0-2]?[0-9]:[0-5][0-9]))REGEX");
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "a") != 0) continue;
        const std::string href = nodeAttribute(node, "href");
        if (href.find("bilety.helios.pl/screen/") == std::string::npos) continue;

        std::string text = nodeAttribute(node, "aria-label");
        if (text.empty()) text = nodeText(node);
        if (!hasTargetDate(text, date)) continue;
        std::smatch match;
        if (!std::regex_search(text, match, titlePattern)) continue;
        result.push_back({match[1].str(), match[2].str(), cinema.name, cinema.address, href});
    }
    xmlFreeDoc(document);
    return result;
}

void collectAnchors(xmlNode* node, std::vector<xmlNode*>& result) {
    if (!node) return;
    for (xmlNode* current = node; current; current = current->next) {
        if (current->type == XML_ELEMENT_NODE && xmlStrcasecmp(current->name, BAD_CAST "a") == 0) {
            result.push_back(current);
        }
        collectAnchors(current->children, result);
    }
}

bool containsTicketLink(xmlNode* node) {
    std::vector<xmlNode*> anchors;
    collectAnchors(node, anchors);
    for (xmlNode* anchor : anchors) {
        if (nodeAttribute(anchor, "href").find("/rezerwacja-biletow/") != std::string::npos) return true;
    }
    return false;
}

std::string titleForTicket(xmlNode* ticket) {
    for (xmlNode* ancestor = ticket->parent; ancestor; ancestor = ancestor->parent) {
        if (ancestor->type != XML_ELEMENT_NODE) continue;
        std::vector<xmlNode*> anchors;
        collectAnchors(ancestor, anchors);
        for (xmlNode* anchor : anchors) {
            const std::string href = nodeAttribute(anchor, "href");
            if (href.find("/filmy/") == std::string::npos) continue;
            const std::string title = nodeText(anchor);
            if (!title.empty() && containsTicketLink(ancestor)) return title;
        }
    }
    return {};
}

std::vector<Screening> parseMultikino(const std::string& html, const Cinema& cinema) {
    std::vector<Screening> result;
    htmlDocPtr document = htmlReadMemory(html.data(), static_cast<int>(html.size()), nullptr,
                                         "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NOERROR |
                                         HTML_PARSE_NOWARNING | HTML_PARSE_NONET);
    if (!document) return result;

    std::vector<xmlNode*> nodes;
    collectNodes(xmlDocGetRootElement(document), nodes);
    const std::regex timePattern(R"REGEX(^([0-2]?[0-9]:[0-5][0-9])\s*-\s*)REGEX");
    for (xmlNode* node : nodes) {
        if (xmlStrcasecmp(node->name, BAD_CAST "a") != 0) continue;
        const std::string href = nodeAttribute(node, "href");
        if (href.find("/rezerwacja-biletow/") == std::string::npos) continue;

        const std::string text = nodeText(node);
        std::smatch match;
        if (!std::regex_search(text, match, timePattern)) continue;
        const std::string title = titleForTicket(node);
        if (title.empty()) continue;
        result.push_back({title, match[1].str(), cinema.name, cinema.address,
                          href.find("http") == 0 ? href : "https://www.multikino.pl" + href});
    }
    xmlFreeDoc(document);
    return result;
}

std::optional<std::string> readDate() {
    while (true) {
        std::cout << "\nKiedy ma byc seans?\n"
                  << "1) dzisiaj\n"
                  << "2) jutro\n"
                  << "3) wybierz date (DD.MM.RR)\n"
                  << "> ";
        std::string choice;
        if (!std::getline(std::cin, choice)) return std::nullopt;
        if (choice == "1" || choice == "2") {
            using namespace std::chrono;
            const auto today = floor<days>(system_clock::now());
            const year_month_day selected{today + days(choice == "2" ? 1 : 0)};
            std::ostringstream formatted;
            formatted << static_cast<int>(selected.year()) << '-'
                      << (static_cast<unsigned>(selected.month()) < 10 ? "0" : "")
                      << static_cast<unsigned>(selected.month()) << '-'
                      << (static_cast<unsigned>(selected.day()) < 10 ? "0" : "")
                      << static_cast<unsigned>(selected.day());
            return formatted.str();
        }
        if (choice != "3") {
            std::cout << "Wpisz 1, 2 albo 3.\n";
            continue;
        }

        std::cout << "Podaj date w formacie DD.MM.RR: ";
        std::string input;
        if (!std::getline(std::cin, input)) return std::nullopt;
        int day = 0;
        int month = 0;
        int shortYear = 0;
        char firstDot = 0;
        char secondDot = 0;
        std::istringstream parser(input);
        if (!(parser >> day >> firstDot >> month >> secondDot >> shortYear) ||
            firstDot != '.' || secondDot != '.' || parser.peek() != std::char_traits<char>::eof()) {
            std::cout << "Niepoprawny format daty. Sprobuj ponownie.\n";
            continue;
        }
        using namespace std::chrono;
        const year_month_day selected{year{2000 + shortYear}, std::chrono::month{static_cast<unsigned>(month)},
                                      std::chrono::day{static_cast<unsigned>(day)}};
        if (!selected.ok() || shortYear > 99 || shortYear < 0) {
            std::cout << "Taka data nie istnieje. Sprobuj ponownie.\n";
            continue;
        }
        std::ostringstream formatted;
        formatted << (2000 + shortYear) << '-'
                  << (month < 10 ? "0" : "") << month << '-'
                  << (day < 10 ? "0" : "") << day;
        return formatted.str();
    }
}

struct SearchResults {
    std::vector<CinemaEntry> cinemas;
    std::vector<Screening> screenings;
};

void alignCinemaNames(std::vector<Screening>& rows, const std::vector<CinemaEntry>& cinemas, const std::string& city) {
    auto nameKey = [&](const std::string& name) {
        auto key = " " + normalizePolish(name) + " ";
        const auto cityToken = " " + normalizePolish(city) + " ";
        const auto at = key.find(cityToken);
        if (at != std::string::npos) key.replace(at, cityToken.size(), " ");
        // Nazwy centrów handlowych różnią się między operatorem kina a Filmwebem.
        for (const std::string token : {" g city ", " atrium ", " galeria "}) {
            const auto position = key.find(token);
            if (position != std::string::npos) key.replace(position, token.size(), " ");
        }
        return trim(key);
    };
    for (auto& row : rows) {
        const auto key = nameKey(row.cinema);
        const Cinema* match = nullptr;
        for (const auto& entry : cinemas) {
            const auto candidate = nameKey(entry.cinema.name);
            const bool generic = (key == "helios" && candidate.rfind("helios", 0) == 0) ||
                (candidate == "helios" && key.rfind("helios ", 0) == 0);
            bool branch = false;
            for (const std::string chain : {"helios ", "multikino ", "cinema city "}) {
                if (key.rfind(chain, 0) != 0 || candidate.rfind(chain, 0) != 0) continue;
                branch = candidate.rfind(key + " ", 0) == 0 || key.rfind(candidate + " ", 0) == 0;
            }
            if (key != candidate && !generic && !branch) continue;
            if (match) { match = nullptr; break; } // Niejednoznacznie dopasowane kina pozostają oddzielne.
            match = &entry.cinema;
        }
        if (match) {
            row.cinema = match->name;
            if (row.address.empty()) row.address = match->address;
        }
    }
}

// Uzupełniamy wyniki bezpośrednie, unikając powtórzonych seansów z Filmwebu.
void mergeScreenings(std::vector<Screening>& direct, const std::vector<Screening>& additional) {
    // Usuwamy powtórzenia pojedynczych wpisów, nigdy całej sieci: nawet działające
    // źródło bezpośrednie może pomijać kino, film lub godzinę. Zachowujemy odrębne
    // odnośniki rezerwacji, np. dla równoczesnych seansów w różnych salach.
    auto key = [](const Screening& row) {
        return normalizePolish(row.cinema) + "\n" + normalizePolish(row.title) + "\n" + row.time;
    };
    std::map<std::string, size_t> known;
    for (size_t index = 0; index < direct.size(); ++index) known.emplace(key(direct[index]), index);
    for (const auto& row : additional) {
        const auto rowKey = key(row);
        const auto existing = known.find(rowKey);
        if (existing == known.end()) {
            known.emplace(rowKey, direct.size());
            direct.push_back(row);
        } else if (direct[existing->second].posterUrl.empty() && !row.posterUrl.empty()) {
            direct[existing->second].posterUrl = row.posterUrl;
        }
    }
}

void fillMissingPosters(std::vector<Screening>& screenings,
                        std::map<std::string, std::string> catalog = {}) {
    // Plakat z jednego kina może uzupełnić ten sam film w pozostałych kinach.
    for (const auto& row : screenings) {
        if (!row.posterUrl.empty()) catalog.emplace(normalizePolish(row.title), row.posterUrl);
    }
    for (auto& row : screenings) {
        if (!row.posterUrl.empty()) continue;
        const auto poster = catalog.find(normalizePolish(row.title));
        if (poster != catalog.end()) row.posterUrl = poster->second;
    }
}

// Punkt wejścia wyszukiwania: znajdujemy kina, pobieramy seanse, łączymy i sortujemy.
SearchResults collectScreenings(const std::string& city, const std::string& date) {
    SearchResults result;
    auto& cinemas = result.cinemas;
    auto& screenings = result.screenings;
    std::map<std::string, std::string> posterCatalog;
    const auto heliosCinemas = fetchHeliosCinemas(city);
    const auto multikinoCinemas = fetchMultikinoCinemas(city);
    const auto cinemaCityCinemas = fetchCinemaCityCinemas(city, date);
    cinemas.insert(cinemas.end(), heliosCinemas.begin(), heliosCinemas.end());
    cinemas.insert(cinemas.end(), multikinoCinemas.begin(), multikinoCinemas.end());
    cinemas.insert(cinemas.end(), cinemaCityCinemas.begin(), cinemaCityCinemas.end());

    for (const CinemaEntry& entry : cinemas) {
        std::vector<Screening> found;
        if (entry.source == CinemaSource::Helios) {
            if (!entry.cinema.id.empty()) {
                const auto data = download("https://api.helios.pl/api/v1/cinemas/" + entry.cinema.id + "/screenings");
                if (data) {
                    addHeliosPosterCatalog(*data, posterCatalog);
                    found = parseHeliosApi(*data, entry.cinema, date);
                }
            } else {
                const auto html = download(dateQuery(entry.cinema.scheduleUrl, date));
                if (html) found = parseHelios(*html, entry.cinema, date);
            }
        } else if (entry.source == CinemaSource::Multikino) {
            found = fetchMultikinoScreenings(entry.cinema, date);
        } else {
            found = fetchCinemaCityScreenings(entry.cinema, date);
        }
        screenings.insert(screenings.end(), found.begin(), found.end());
    }

    auto filmwebScreenings = fetchFilmwebScreenings(city, date);
    alignCinemaNames(filmwebScreenings, cinemas, city);
    mergeScreenings(screenings, filmwebScreenings);
    fillMissingPosters(screenings, std::move(posterCatalog));

    std::sort(screenings.begin(), screenings.end(), [](const Screening& left, const Screening& right) {
        if (left.time != right.time) return left.time < right.time;
        if (left.title != right.title) return left.title < right.title;
        return left.cinema < right.cinema;
    });

    return result;
}

// Brakujący adres pobieramy dopiero po wybraniu seansu przez użytkownika.
std::string screeningAddress(const Screening& selected, const std::vector<CinemaEntry>& cinemas) {
    std::string address = selected.address;
    if (address.empty()) {
        const auto cinema = std::find_if(cinemas.begin(), cinemas.end(), [&](const CinemaEntry& entry) {
            return entry.cinema.name == selected.cinema && entry.source == CinemaSource::Multikino;
        });
        if (cinema != cinemas.end()) address = fetchMultikinoAddress(cinema->cinema);
    }
    if (address.empty() && selected.ticketUrl.find("filmweb.pl/showtimes/") != std::string::npos) {
        address = filmwebAddress(selected.ticketUrl);
    }
    return address;
}

void searchCity(const std::string& city) {
    const auto selectedDate = readDate();
    if (!selectedDate) return;
    const std::string dateInPolish = polishDate(*selectedDate);
    std::cout << "\nPobieram repertuar na " << dateInPolish << "...\n";

    auto results = collectScreenings(city, *selectedDate);
    auto& cinemas = results.cinemas;
    auto& screenings = results.screenings;

    std::vector<std::string> movies;
    std::set<std::string> seenTitles;
    for (const Screening& screening : screenings) {
        const std::string normalized = normalizePolish(screening.title);
        if (seenTitles.insert(normalized).second) movies.push_back(screening.title);
    }
    if (movies.empty()) {
        std::cout << "Nie znaleziono seansow na ten dzien. Sprawdz date lub strony kin.\n";
        return;
    }

    std::cout << "\nFilmy w miescie " << city << " dnia " << dateInPolish << ":\n";
    for (size_t index = 0; index < movies.size(); ++index) {
        std::cout << index + 1 << ") " << movies[index] << '\n';
    }

    size_t movieChoice = 0;
    while (true) {
        std::cout << "\nWybierz film (numer): ";
        std::string input;
        if (!std::getline(std::cin, input)) {
            return;
        }
        try {
            movieChoice = std::stoul(input);
        } catch (...) {
            movieChoice = 0;
        }
        if (movieChoice >= 1 && movieChoice <= movies.size()) break;
        std::cout << "Nie ma filmu o takim numerze.\n";
    }

    std::vector<const Screening*> selectedScreenings;
    for (const Screening& screening : screenings) {
        if (normalizePolish(screening.title) == normalizePolish(movies[movieChoice - 1])) {
            selectedScreenings.push_back(&screening);
        }
    }
    std::cout << "\nSeanse filmu: " << movies[movieChoice - 1] << "\n";
    for (size_t index = 0; index < selectedScreenings.size(); ++index) {
        const Screening& screening = *selectedScreenings[index];
        std::cout << index + 1 << ") " << screening.time << " - " << screening.cinema << '\n';
    }

    size_t screeningChoice = 0;
    while (true) {
        std::cout << "\nWybierz seans (numer): ";
        std::string input;
        if (!std::getline(std::cin, input)) {
            return;
        }
        try {
            screeningChoice = std::stoul(input);
        } catch (...) {
            screeningChoice = 0;
        }
        if (screeningChoice >= 1 && screeningChoice <= selectedScreenings.size()) break;
        std::cout << "Nie ma seansu o takim numerze.\n";
    }

    const Screening& selected = *selectedScreenings[screeningChoice - 1];
    const std::string address = screeningAddress(selected, cinemas);
    std::cout << "\nKino: " << selected.cinema << '\n'
              << "Adres: " << (address.empty() ? "Nie udalo sie pobrac adresu kina." : address) << '\n'
              << (selected.ticketUrl.find("filmweb.pl/") != std::string::npos
                    ? "Repertuar: " : "Bilety: ")
              << selected.ticketUrl << '\n';
}

#include "desktop/backend.h"

// Wybieramy testy własne, protokół JSON dla Electron lub interfejs konsolowy.
#ifndef CINEMA_MOBILE
int main(int argc, char** argv) {
    if (argc == 2 && std::string(argv[1]) == "--gui") return runDesktopBackend();
    if (argc == 2 && std::string(argv[1]) == "--self-test") return testDesktopBackend();
    std::setlocale(LC_ALL, "");
#ifdef _WIN32
    SetConsoleCP(CP_UTF8);
    SetConsoleOutputCP(CP_UTF8);
#endif
    ConsoleAsciiGuard asciiCout(std::cout);
    ConsoleAsciiGuard asciiCerr(std::cerr);
    curl_global_init(CURL_GLOBAL_DEFAULT);
    sharedCookieStore = curl_share_init();
    if (sharedCookieStore) {
        curl_share_setopt(sharedCookieStore, CURLSHOPT_SHARE, CURL_LOCK_DATA_COOKIE);
    }
    xmlInitParser();

    bool keepRunning = true;
    while (keepRunning) {
        std::cout << "================================\n"
                  << "      CINEMA MOVIE FINDER\n"
                  << "================================\n\n";

        std::string city;
        while (city.empty()) {
            std::cout << "Podaj miasto: ";
            if (!std::getline(std::cin, city)) {
                keepRunning = false;
                break;
            }
            city = collapseWhitespace(city);
            if (city.empty()) std::cout << "Miasto nie moze byc puste. Sprobuj ponownie.\n";
        }
        if (!keepRunning) break;

        city = resolveCityName(city);
        searchCity(city);
        if (std::cin.eof()) break;

        while (true) {
            std::cout << "\nCo chcesz zrobic?\n"
                      << "1) Szukaj dalej\n"
                      << "2) Wyjdz\n"
                      << "> ";
            std::string choice;
            if (!std::getline(std::cin, choice)) {
                keepRunning = false;
                break;
            }
            choice = normalizePolish(choice);
            if (choice == "1" || choice == "szukaj dalej") break;
            if (choice == "2" || choice == "wyjdz" || choice == "wyjsc") {
                keepRunning = false;
                break;
            }
            std::cout << "Wpisz 1 (Szukaj dalej) albo 2 (Wyjdz).\n";
        }
    }

    if (sharedCookieStore) curl_share_cleanup(sharedCookieStore);
    curl_global_cleanup();
    xmlCleanupParser();
    return 0;
}
#endif
