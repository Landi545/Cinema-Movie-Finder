// Dołączany po wspólnych funkcjach wyszukiwania w main.cpp.
#include <memory>
#include <stdexcept>

// RAII zwalnia obiekty json-c także wtedy, gdy obsługa żądania zgłosi wyjątek.
using Json = std::unique_ptr<json_object, decltype(&json_object_put)>;

std::string jsonText(json_object* object, const char* key) {
    json_object* value = nullptr;
    if (!json_object_object_get_ex(object, key, &value) ||
        !json_object_is_type(value, json_type_string)) return {};
    return json_object_get_string(value);
}

void addText(json_object* object, const char* key, const std::string& value) {
    json_object_object_add(object, key, json_object_new_string(value.c_str()));
}

bool validDesktopDate(const std::string& date) {
    if (!std::regex_match(date, std::regex(R"(20[0-9]{2}-[0-9]{2}-[0-9]{2})"))) return false;
    using namespace std::chrono;
    return year_month_day{year{std::stoi(date.substr(0, 4))},
        month{static_cast<unsigned>(std::stoi(date.substr(5, 2)))},
        day{static_cast<unsigned>(std::stoi(date.substr(8, 2)))}}.ok();
}

json_object* screeningJson(const Screening& screening, size_t index) {
    json_object* row = json_object_new_object();
    json_object_object_add(row, "id", json_object_new_int64(static_cast<int64_t>(index)));
    addText(row, "title", screening.title);
    addText(row, "movieKey", normalizePolish(screening.title));
    addText(row, "time", screening.time);
    addText(row, "cinema", screening.cinema);
    addText(row, "address", screening.address);
    addText(row, "ticketUrl", screening.ticketUrl);
    addText(row, "posterUrl", screening.posterUrl);
    return row;
}

// search zastępuje wyniki sesji; detail używa indeksu w tych wynikach.
Json desktopRequest(json_object* request, SearchResults& results) {
    Json response(json_object_new_object(), json_object_put);
    const auto command = jsonText(request, "command");
    if (command == "search") {
        auto city = collapseWhitespace(jsonText(request, "city"));
        const auto date = jsonText(request, "date");
        if (city.empty() || city.size() > 300 || city.find_first_of("\r\n") != std::string::npos ||
            !validDesktopDate(date)) throw std::runtime_error("Podaj miasto i poprawną datę.");
        results = {};
        {
            std::lock_guard<std::mutex> guard(sourceIssuesMutex);
            sourceIssues.clear();
        }
        city = resolveCityName(city);
        results = collectScreenings(city, date);
        addText(response.get(), "city", city);
        auto* rows = json_object_new_array();
        for (size_t index = 0; index < results.screenings.size(); ++index)
            json_object_array_add(rows, screeningJson(results.screenings[index], index));
        json_object_object_add(response.get(), "screenings", rows);
        auto* warnings = json_object_new_array();
        {
            std::lock_guard<std::mutex> guard(sourceIssuesMutex);
            for (const auto& source : sourceIssues)
                json_object_array_add(warnings, json_object_new_string(source.c_str()));
        }
        json_object_object_add(response.get(), "unavailableSources", warnings);
    } else if (command == "detail") {
        json_object* id = nullptr;
        if (!json_object_object_get_ex(request, "id", &id) || !json_object_is_type(id, json_type_int))
            throw std::runtime_error("Wybierz seans ponownie.");
        const auto index = json_object_get_int64(id);
        if (index < 0 || static_cast<size_t>(index) >= results.screenings.size())
            throw std::runtime_error("Wybierz seans ponownie.");
        const auto& screening = results.screenings[static_cast<size_t>(index)];
        addText(response.get(), "address", screeningAddress(screening, results.cinemas));
    } else {
        throw std::runtime_error("Nieznane polecenie.");
    }
    return response;
}

// Protokół mostu: jedna linia JSON w UTF-8 na żądanie i jedna na odpowiedź.
int runDesktopBackend() {
    // Bez konwersji kodowania konsoli: stdin/stdout przesyłają komunikaty JSON w UTF-8.
    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return 1;
    sharedCookieStore = curl_share_init();
    if (sharedCookieStore) curl_share_setopt(sharedCookieStore, CURLSHOPT_SHARE, CURL_LOCK_DATA_COOKIE);
    xmlInitParser();
    SearchResults results;
    std::string line;
    while (std::getline(std::cin, line)) {
        Json response(nullptr, json_object_put);
        try {
            Json request(json_tokener_parse(line.c_str()), json_object_put);
            if (!request || !json_object_is_type(request.get(), json_type_object))
                throw std::runtime_error("Niepoprawne żądanie.");
            response = desktopRequest(request.get(), results);
        } catch (const std::exception& error) {
            response.reset(json_object_new_object());
            addText(response.get(), "error", error.what());
        }
        std::cout << json_object_to_json_string_ext(response.get(), JSON_C_TO_STRING_PLAIN) << std::endl;
    }
    if (sharedCookieStore) curl_share_cleanup(sharedCookieStore);
    curl_global_cleanup();
    xmlCleanupParser();
    return 0;
}

int testDesktopBackend() {
    const auto filmweb = parseFilmwebShowtimes(R"(<html><div class="seanceTiles"><a class="seanceTiles__title" href="/showtimes/%C5%81%C3%B3d%C5%BA/Charlie-1">Charlie</a><div class="seanceTile" data-date="2026-10-19" data-value="18:00"></div><div class="seanceTile" data-date="2026-10-20" data-value="19:00"></div></div><div class="seanceTiles"><a class="seanceTiles__title" href="/showtimes/Zgierz/Kino-2">Kino</a><div class="seanceTile" data-date="2026-10-19" data-value="18:00"></div></div></html>)", "lodz", "2026-10-19", "Film");
    if (filmweb.size() != 1 || filmweb[0].cinema != "Charlie") return 14;
    std::vector<Screening> aliases{{"Film", "18:00", "Multikino", "", "filmweb"}, {"Film", "19:00", "Helios Sukcesja", "", "filmweb"}, {"Film", "20:00", "Cinema City Manufaktura", "", "filmweb"}};
    alignCinemaNames(aliases, {{{"Multikino Łódź", "", "", "", "Łódź"}, CinemaSource::Multikino}, {{"Helios", "", "", "", "Łódź"}, CinemaSource::Helios}, {{"Cinema City Łódź Manufaktura", "", "", "", "Łódź"}, CinemaSource::CinemaCity}}, "Łódź");
    if (aliases[0].cinema != "Multikino Łódź" || aliases[1].cinema != "Helios" || aliases[2].cinema != "Cinema City Łódź Manufaktura") return 15;
    const Cinema testCinema{"Multikino Łódź", "", "https://www.multikino.pl/repertuar/lodz/teraz-gramy", "0023", "Łódź"};
    const auto multi = parseMultikinoApi(R"({"result":[{"filmTitle":"Film A","posterImageSrc":"https://www.multikino.pl/poster.jpg","showingGroups":[{"sessions":[{"startTime":"2026-10-19T10:00:00","bookingUrl":"/ticket/1"},{"startTime":"2026-10-19T10:00:00","bookingUrl":"/ticket/2"},{"startTime":"2026-10-20T10:00:00","bookingUrl":"/wrong"}]},{"sessions":[{"startTime":"2026-10-19T23:30:00"}]}]},{"filmTitle":"Film B","showingGroups":[{"sessions":[{"startTime":"2026-10-19T12:00:00","bookingUrl":"https://example.org/ticket"}]}]}]})", testCinema, "2026-10-19");
    if (multi.size() != 4 || multi[0].ticketUrl != "https://www.multikino.pl/ticket/1" ||
        multi[2].ticketUrl != testCinema.scheduleUrl || multi[0].posterUrl != "https://www.multikino.pl/poster.jpg" || !multi[3].posterUrl.empty()) return 7;
    const auto cc = parseCinemaCityApi(R"({"body":{"films":[{"id":"a","name":"Film A","posterLink":"https://www.cinema-city.pl/poster.jpg"},{"id":"b","name":"Film B"}],"events":[{"filmId":"a","eventDateTime":"2026-10-19T10:00:00","bookingLink":"https://example.org/1"},{"filmId":"b","eventDateTime":"2026-10-19T23:00:00","bookingRouterLaunchLink":"https://example.org/2"},{"filmId":"a","eventDateTime":"2026-10-20T10:00:00"}]}})", testCinema, "2026-10-19");
    if (cc.size() != 2 || cc[1].title != "Film B" || cc[0].posterUrl != "https://www.cinema-city.pl/poster.jpg" || !cc[1].posterUrl.empty()) return 8;
    auto merged = multi;
    mergeScreenings(merged, {
        {"Film A", "10:00", "MULTIKINO Lodz", "", "filmweb"},
        {"Film A", "18:00", "Multikino Łódź", "", "filmweb"},
        {"Film C", "18:00", "Multikino Łódź", "", "filmweb"},
        {"Film A", "10:00", "Helios", "", "filmweb"},
        {"Film A", "10:00", "Cinema City Manufaktura", "", "filmweb"},
        {"Film A", "10:00", "Kino niezależne", "", "filmweb"}
    });
    if (merged.size() != 9 || merged[0].ticketUrl != multi[0].ticketUrl || merged[1].ticketUrl != multi[1].ticketUrl) return 9;
    std::vector<Screening> fallback;
    mergeScreenings(fallback, merged);
    if (fallback.size() != 8) return 10;
    if (!cityMatches("Warszawa Młociny", "warszawa") || !cityMatches("Łódź", "lodz") ||
        !cityMatches("Bielsko-Biała", "bielsko biala") || cityMatches("Szczecinek", "Szczecin")) return 11;
    sourceIssues.clear();
    parseMultikinoApi("<html>Unavailable</html>", testCinema, "2026-10-19");
    parseCinemaCityApi(R"({"body":{"films":{},"events":[]}})", testCinema, "2026-10-19");
    parseHeliosApi("{}", testCinema, "2026-10-19");
    if (sourceIssues != std::set<std::string>{"Multikino", "Cinema City", "Helios"}) return 12;
    sourceIssues.clear();
    parseMultikinoApi(R"({"result":[]})", testCinema, "2026-10-19");
    parseCinemaCityApi(R"({"body":{"films":[],"events":[]}})", testCinema, "2026-10-19");
    if (!sourceIssues.empty()) return 13;
    if (!hasTargetDate("19 października 2026", "2026-10-19") ||
        !hasTargetDate("1 września 2026", "2026-09-01")) return 4;
    const auto cinemas = parseHeliosCinemas(R"({"data":[{"id":45,"header":"Helios Kupiec","slug":"kino-helios-chr-kupiec","location":{"city":"Szczecin","street":"Krzywoustego 9"}},{"id":1,"header":"Helios","slug":"kino-helios","location":{"city":"Łódź","street":"Żółta 1"}}]})", "SZCZECIN");
    if (cinemas.size() != 1 || cinemas[0].cinema.id != "45") return 5;
    const std::string fixture = R"({"data":{"screenings":{"2026-10-18":{"m1":{"screenings":[{"timeFrom":"2026-10-18 10:00:00","sourceId":"today","cinemaSourceId":"cinema"}]}},"2026-10-19":{"m1":{"screenings":[{"timeFrom":"2026-10-19 15:15:00","sourceId":"tomorrow","cinemaSourceId":"cinema"},{"timeFrom":"2026-10-18 10:00:00","sourceId":"wrong-day","cinemaSourceId":"cinema"}]},"e2":{"screenings":[{"timeFrom":"2026-10-19 18:00:00","sourceId":"event","cinemaSourceId":"cinema"}]}}},"movies":{"m1":{"posterPhoto":{"url":"https://img.helios.pl/poster.jpg"},"title":"Zażółć gęślą jaźń"}},"events":{"e2":{"name":"Kino Konesera"}}}})";
    const auto screenings = parseHeliosApi(fixture, cinemas[0].cinema, "2026-10-19");
    if (screenings.size() != 2 || screenings[0].title != "Zażółć gęślą jaźń" ||
        screenings[0].posterUrl != "https://img.helios.pl/poster.jpg" || !screenings[1].posterUrl.empty() || screenings[0].time != "15:15" || screenings[1].title != "Kino Konesera" ||
        screenings[0].ticketUrl.find("/screen/tomorrow?cinemaId=cinema") == std::string::npos ||
        !parseHeliosApi(fixture, cinemas[0].cinema, "2026-10-20").empty()) return 6;
    const std::string nestedHeliosFixture = R"({"data":{"screenings":{"2026-10-19":{"m1":{"screenings":[{"timeFrom":"2026-10-19 20:15:00","sourceId":"nested","cinemaSourceId":"cinema","screeningMovies":[{"movie":{"name":"Film z nowej struktury","posterPhoto":{"url":"https://img.helios.pl/nested.jpg"}}}]}]}}}}})";
    const auto nestedScreenings = parseHeliosApi(nestedHeliosFixture, cinemas[0].cinema, "2026-10-19");
    if (nestedScreenings.size() != 1 || nestedScreenings[0].title != "Film z nowej struktury" ||
        nestedScreenings[0].time != "20:15" || nestedScreenings[0].posterUrl != "https://img.helios.pl/nested.jpg") return 16;
    std::map<std::string, std::string> posterCatalog;
    addHeliosPosterCatalog(R"({"data":{"movies":{"future":{"title":"Spider-Man. Całkiem nowy dzień","posterPhoto":{"url":"https://img.helios.pl/future.jpg"}}}}})", posterCatalog);
    std::vector<Screening> missingPosters{
        {"Spider-Man: Całkiem nowy dzień", "18:00", "Kino A", "", ""},
        {"Film z innego kina", "19:00", "Kino A", "", ""},
        {"Film z innego kina", "20:00", "Kino B", "", "", "https://www.multikino.pl/same-film.jpg"},
        {"Inny film", "21:00", "Kino B", "", ""}
    };
    fillMissingPosters(missingPosters, posterCatalog);
    if (missingPosters[0].posterUrl != "https://img.helios.pl/future.jpg" ||
        missingPosters[1].posterUrl != "https://www.multikino.pl/same-film.jpg" ||
        missingPosters[2].posterUrl != "https://www.multikino.pl/same-film.jpg" ||
        !missingPosters[3].posterUrl.empty()) return 17;
    if (normalizePolish("ŁÓDŹ") != "lodz" || normalizePolish("Bielsko-Biała") != "bielsko biala" ||
        !validDesktopDate("2028-02-29") || validDesktopDate("2027-02-29") ||
        validDesktopDate("2026-13-10") || validDesktopDate("26-10-18")) return 1;
    Screening sample{"Zażółć gęślą jaźń", "18:30", "Kino Łódź", "Żółta ąęśćńóźż 1", "https://example.org", "https://img.helios.pl/poster.jpg"};
    Json row(screeningJson(sample, 0), json_object_put);
    Json decoded(json_tokener_parse(json_object_to_json_string(row.get())), json_object_put);
    if (jsonText(decoded.get(), "title") != sample.title || jsonText(decoded.get(), "address") != sample.address || jsonText(decoded.get(), "posterUrl") != sample.posterUrl) return 2;
    SearchResults results;
    Json request(json_tokener_parse("{\"command\":\"detail\",\"id\":-1}"), json_object_put);
    try { desktopRequest(request.get(), results); return 3; } catch (const std::runtime_error&) {}
    std::cout << "Desktop backend tests passed (UTF-8, dates, selection validation).\n";
    return 0;
}
