// Testujemy rzeczywisty most C, bez sieci i bez urządzenia mobilnego.
#include "../mobile/native/engine.h"
#include <cstring>
#include <iostream>

int testDesktopBackend();
bool contains(const char* input, unsigned long long token, const char* expected) {
    char* response = cinema_request(input, token);
    const bool ok = response && std::strstr(response, expected);
    if (!ok) std::cerr << (response ? response : "Brak odpowiedzi") << '\n';
    cinema_free(response);
    return ok;
}
int main() {
    if (testDesktopBackend() != 0) return 1;
    auto token = cinema_generation();
    if (!contains("{", token, "Niepoprawne żądanie")) return 2;
    if (!contains(R"({"command":"search","city":"Łódź","date":"2027-02-29"})", token, "poprawną datę")) return 3;
    if (!contains(R"({"command":"detail","id":0})", token, "Wybierz seans")) return 4;
    cinema_cancel();
    if (!contains("{}", token, "Anulowano")) return 5;
    if (!contains("{}", cinema_generation(), "Nieznane polecenie")) return 6;
    std::cout << "Mobile bridge tests passed.\n";
}
