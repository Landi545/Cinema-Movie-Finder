<div align="center">

# Cinema Movie Finder

**Dobry wieczór zaczyna się w kinie.**

Znajdź film i dogodny seans w swoim mieście.<br />
Repertuar polskich kin w jednej aplikacji — na Windows i Androida.

### [Pobierz na Windows](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Setup.exe) · [Pobierz na Androida](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Android.apk)

[Jak zacząć](#dla-użytkowników) · [Pytania i pomoc](#pytania-i-pomoc) · [Dla programistów](#dla-programistów)

</div>

---

## Dla użytkowników

### Co to za aplikacja?

Cinema Movie Finder pomaga sprawdzić, **co, gdzie i o której grają w kinach**. Wybierasz miasto i dzień, przeglądasz filmy, a następnie wybierasz seans. W szczegółach znajdziesz godzinę, kino, dostępny adres oraz odnośnik do biletów lub repertuaru.

Aplikacja zbiera repertuar z **Heliosa, Multikina, Cinema City i Filmwebu**. Do wyszukiwania potrzebujesz połączenia z internetem.

### Pobierz i zainstaluj

| Twoje urządzenie | Pobierz aplikację | Co zrobić po pobraniu |
| :--- | :--- | :--- |
| **Komputer z Windows (64-bit)** | [**Pobierz instalator Windows**](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Setup.exe) | Otwórz pobrany plik i przejdź przez instalację. Następnie uruchom Cinema Movie Finder z menu Start. |
| **Telefon z Androidem 7 lub nowszym (ARM64)** | [**Pobierz aplikację Android**](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Android.apk) | Otwórz pobrany plik APK. Jeśli telefon o to poprosi, zezwól przeglądarce lub menedżerowi plików na instalację aplikacji z tego źródła. Wybierz „Zainstaluj”. |

**Nie wiesz, który plik wybrać?** Na komputerze pobierz plik z końcówką `.exe`, a na telefonie z Androidem — `.apk`. Nie musisz pobierać kodu źródłowego ani niczego samodzielnie budować.

[Zobacz najnowsze wydanie i listę zmian →](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest)

### Pierwszy seans w pięciu krokach

1. **Wybierz miasto.** Kliknij jedną z propozycji lub wpisz własne miasto i wybierz „Dalej”.
2. **Wybierz dzień.** Użyj „Dzisiaj”, „Jutro” lub wskaż inną datę. Poczekaj na pobranie repertuaru.
3. **Wybierz film.** Kliknij tytuł, który Cię interesuje.
4. **Wybierz seans.** Sprawdź godzinę oraz kino.
5. **Przejdź do biletów.** W szczegółach wybierz „Otwórz bilety” lub „Otwórz repertuar”. Strona otworzy się w przeglądarce.

Na dole okna zobaczysz **wybrane miasto, datę i status wyszukiwania**, a po pobraniu wyników — liczbę filmów i seansów. Do wcześniejszego wyboru wrócisz przyciskami w aplikacji; „Szukaj dalej” pozwala rozpocząć kolejne wyszukiwanie.

### Pytania i pomoc

**Nie ma wyników albo repertuar jest niepełny — co zrobić?**

Sprawdź internet, spróbuj ponownie lub wybierz inną datę. Kino mogło jeszcze nie opublikować repertuaru, a źródło danych może być chwilowo niedostępne. Komunikat o problemie z pobieraniem nie oznacza, że w kinach nie ma seansów.

**Dlaczego przycisk otwiera repertuar zamiast zakupu biletu?**

Nie wszystkie źródła udostępniają bezpośredni link do zakupu. W takim przypadku aplikacja otwiera stronę repertuaru, na której możesz kontynuować wybór.

**Czy trzeba wpisywać polskie znaki?**

Nie. Możesz wpisać zarówno „Łódź”, jak i „Lodz”.

**Jak zaktualizować aplikację?**

Pobierz nowy instalator lub APK z linków powyżej i zainstaluj aktualizację. Wydania Androida są podpisywane tym samym kluczem, więc możesz instalować je na istniejącej wersji.

**Gdzie zgłosić problem lub pomysł?**

[Otwórz zgłoszenie na GitHubie](https://github.com/Landi545/Cinema-Movie-Finder/issues). Napisz, czy korzystasz z Windows czy Androida, co się wydarzyło i czego oczekujesz. Przy problemach z repertuarem podaj miasto oraz datę seansu.

---

## Dla programistów

**Chcesz rozwijać projekt lub zbudować aplikację samodzielnie? Zacznij tutaj.**

Poniższe informacje dotyczą kodu, środowiska i publikacji. Do zwykłego korzystania wystarczy instalator z części [dla użytkowników](#dla-użytkowników).

Projekt jest **open source**, dostępny na [licencji MIT](LICENSE). Wspólny interfejs HTML/CSS/JavaScript działa w Electronie na Windows i w Capacitorze na Androidzie. Obie wersje korzystają z silnika C++ i pobierają repertuar bez dodatkowego serwera. Komentarze w kodzie są po polsku.

### Mapa projektu

| Obszar | Gdzie szukać |
| :--- | :--- |
| Widoki, wygląd i nawigacja | [index.html](desktop/ui/index.html), [style.css](desktop/ui/style.css), [app.js](desktop/ui/app.js) |
| Okno Windows i dostęp do API | [desktop/main.cjs](desktop/main.cjs), [desktop/preload.cjs](desktop/preload.cjs) |
| Komunikacja z silnikiem | [desktop/bridge.cjs](desktop/bridge.cjs), [desktop/backend.h](desktop/backend.h) |
| Pobieranie i parsowanie repertuaru | [main.cpp](main.cpp) |
| Android, podpisywanie i certyfikaty | [Dokumentacja mobilna](mobile/README.md) |
| Testy komunikacji i interfejsu | [tests/bridge.test.cjs](tests/bridge.test.cjs), [tests/ui/](tests/ui/) |
| Pakowanie i publikacja | [scripts/package.cjs](scripts/package.cjs), [workflow wydań](.github/workflows/release.yml), [instalator Windows](package/windows/CinemaMovieFinder.iss) |

### Przygotowanie środowiska i testy

Pobierz repozytorium i zainstaluj zależności. Wymagany jest **Node.js 24**.

```sh
git clone https://github.com/Landi545/Cinema-Movie-Finder.git
cd Cinema-Movie-Finder
npm ci
```

Uruchom testy komunikacji oraz interfejsu:

```sh
npm test
npx playwright install chromium
npm run test:ui
```

Testy interfejsu korzystają z kontrolowanych danych i obejmują także układ telefonu. Nie wymagają pobierania aktualnego repertuaru. Testy na żywo w [scripts/](scripts/) wymagają internetu i dostępnych danych kin.

### Silnik C++ i aplikacja Windows

Silnik wymaga kompilatora z obsługą **C++20**, `make`, `pkg-config` oraz bibliotek **libcurl, libxml2 i json-c**. W środowisku z tymi narzędziami zbudujesz i sprawdzisz go poleceniami:

```sh
make
./cinema_movie_finder --self-test
```

Na Windows przygotuj silnik, wymagane biblioteki DLL i `cacert.pem` w katalogu `package/windows/payload/Cinema Movie Finder Files`, zgodnie z krokami w [workflowie wydań](.github/workflows/release.yml). Samo `npm ci` nie buduje silnika ani nie pobiera jego bibliotek.

Uruchom interfejs Electron:

```sh
npm start
```

Gotową aplikację spakujesz poleceniem `npm run package:windows`. Instalator powstaje w Inno Setup na podstawie [CinemaMovieFinder.iss](package/windows/CinemaMovieFinder.iss).

### Aplikacja Android

Wersja mobilna kopiuje wspólny interfejs z [desktop/ui/](desktop/ui/). Zmiany wyglądu wprowadzaj w tym katalogu, a następnie odśwież pakiet:

```sh
npm run mobile:prepare
```

Pełna kompilacja wymaga również narzędzi Androida i bibliotek natywnych. Wymagania, przygotowanie silnika, budowanie APK oraz podpisywanie opisuje [mobile/README.md](mobile/README.md).

### Przepływ danych

1. [Kontroler interfejsu](desktop/ui/app.js) obsługuje kolejne wybory użytkownika i wywołuje `window.cinema`.
2. Na Windows [preload](desktop/preload.cjs) udostępnia ograniczone API, a [proces główny](desktop/main.cjs) sprawdza żądania i obsługuje okno oraz linki zewnętrzne.
3. [Most](desktop/bridge.cjs) uruchamia silnik C++ i wymienia z nim komunikaty JSON, po jednym na linię. Obsługuje anulowanie i limit czasu.
4. [Backend](desktop/backend.h) interpretuje polecenia `search` i `detail`. Identyfikator seansu jest indeksem w wynikach ostatniego wyszukiwania.
5. W [main.cpp](main.cpp) funkcja `collectScreenings` łączy repertuary, a `screeningAddress` uzupełnia adres wybranego kina. Na Androidzie żądania do tego samego silnika przekazuje wtyczka natywna.

**Brak wyników i awaria źródła to różne sytuacje.** Pole `unavailableSources` pozwala ostrzec o niepełnym repertuarze. Zachowaj to rozróżnienie przy zmianach parserów i interfejsu.

### Wydania

Push do `main` uruchamia budowanie artefaktów Windows i Androida. Tag `v*`, zgodny z wersją projektu, publikuje instalator i podpisany APK dopiero po przejściu budowania oraz testów.

Przed oznaczeniem wydania zaktualizuj wersję w [package.json](package.json), [package-lock.json](package-lock.json) i [konfiguracji instalatora](package/windows/CinemaMovieFinder.iss), a następnie sprawdź ich zgodność:

```sh
node scripts/check-version.cjs
```

Klucze i hasła podpisujące przechowuj poza repozytorium. Konfigurację sekretów i zasady zachowania klucza Androida opisuje [dokumentacja mobilna](mobile/README.md#wydania-i-podpisywanie).

---

[Pobierz aplikację](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest) · [Zgłoś problem](https://github.com/Landi545/Cinema-Movie-Finder/issues) · [Licencja MIT](LICENSE)
