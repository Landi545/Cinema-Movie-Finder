# Cinema Movie Finder

Aplikacja wyszukuje repertuar kin w polskich miastach. Pobiera dane z Heliosa, Multikina, Cinema City i Filmwebu.

Aplikacja jest **open source**, dostępna na [licencji MIT](LICENSE). Kod został przygotowany do wygodnego odczytu: komentarze wyjaśniają przepływ danych, odpowiedzialność modułów i ważne ograniczenia. Publiczne repozytorium: [Landi545/Cinema-Movie-Finder](https://github.com/Landi545/Cinema-Movie-Finder).

## Jak czytać kod

Najłatwiej zacząć od interfejsu i podążać za żądaniem wyszukania:

1. [desktop/ui/app.js](desktop/ui/app.js) obsługuje wybór miasta, daty, filmu i seansu. [index.html](desktop/ui/index.html) definiuje widoki, a [style.css](desktop/ui/style.css) ich wygląd.
2. [desktop/preload.cjs](desktop/preload.cjs) udostępnia interfejsowi ograniczone API `window.cinema`.
3. [desktop/main.cjs](desktop/main.cjs) tworzy okno Electron, sprawdza żądania i otwiera linki do biletów oraz gotowy post na X.
4. [desktop/bridge.cjs](desktop/bridge.cjs) uruchamia silnik C++ i wymienia z nim komunikaty JSON, po jednym na linię. Obsługuje anulowanie i limit czasu.
5. [desktop/backend.h](desktop/backend.h) interpretuje polecenia `search` i `detail`. Identyfikator seansu jest indeksem w wynikach ostatniego wyszukiwania.
6. [main.cpp](main.cpp) zawiera modele danych, pobieranie HTTP, normalizację polskich nazw, parsery źródeł, łączenie repertuarów oraz tryb konsolowy. Funkcja `collectScreenings` łączy wyniki kin z Filmwebem; `screeningAddress` uzupełnia adres wybranego kina.

[Testy mostu](tests/bridge.test.cjs) sprawdzają komunikację i walidację, a [testy interfejsu](tests/ui/flow.spec.cjs) przechodzą przez scenariusze użytkownika z kontrolowanymi danymi. [Workflow wydań](.github/workflows/release.yml) buduje silnik, wykonuje testy i tworzy instalator. [Skrypt pakowania](scripts/package.cjs) dołącza silnik i biblioteki do aplikacji Electron.

Brak wyników i awaria źródła to różne sytuacje: pole `unavailableSources` pozwala interfejsowi ostrzec o niepełnym repertuarze. Dane kin mogą zmieniać się niezależnie od aplikacji.

## Użytkowanie

1. Pobierz `CinemaMovieFinder-Setup.exe` z [najnowszego wydania](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest).
2. Uruchom instalator i aplikację.
3. Wybierz miasto oraz datę, a następnie film i seans.

Aplikacja wymaga internetu. Link do bezpośredniego zakupu biletów nie jest dostępny dla niektórych kin; w takim przypadku można otworzyć repertuar w zewnętrznej przeglądarce. Przycisk „Szukaj dalej” rozpoczyna nowe wyszukiwanie, a „Wyjdź” zamyka aplikację. Polskie znaki są obsługiwane, ale nie są wymagane przy wpisywaniu miasta.

## Telefony (wersja 1.2)

Android 7 lub nowszy, procesor ARM64: pobierz `CinemaMovieFinder-Android.apk` z wydania, otwórz plik i zezwól przeglądarce na instalowanie aplikacji. Kolejne wydania są podpisywane tym samym kluczem, więc można je instalować jako aktualizacje. Wersja na telefon korzysta z tych samych widoków i silnika C++ co Windows; pobiera repertuar bezpośrednio, bez dodatkowego serwera.

Szczegóły kompilacji, podpisu i aktualizacji certyfikatów: [mobile/README.md](mobile/README.md).

## Praca nad wersją Windows

Wymagane są Node.js 24 oraz biblioteki C++: libcurl, libxml2 i json-c. Konsolowy silnik buduje się poleceniem:

```sh
make
./cinema_movie_finder --self-test
```

Testy Node.js i interfejsu:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
```

Lokalny start aplikacji Electron: `npm start`. Wymaga silnika, bibliotek DLL i `cacert.pem` w `package/windows/payload/Cinema Movie Finder Files`, zgodnie z [workflowem wydań](.github/workflows/release.yml). Pakowanie wykonuje `npm run package:windows`, a konfiguracja instalatora znajduje się w [CinemaMovieFinder.iss](package/windows/CinemaMovieFinder.iss).

Push do `main` buduje artefakty Windows i Android. Tag `v*` publikuje instalator Windows oraz podpisany APK Androida po przejściu budowania i testów. Testy na żywo w `scripts/` wymagają internetu i aktualnego repertuaru.
