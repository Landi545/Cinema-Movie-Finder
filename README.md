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

Widoczna zakładka **„Promocje kinowe”** zbiera warunki ofert Heliosa, Multikina i Cinema City: termin, cenę, miejsce skorzystania, ograniczenia i odnośnik do oficjalnych zasad. Gwiazdka pomaga zawęzić wybór, ale cena końcowa jest zawsze potwierdzana przez kino — wydarzenia specjalne, wybrane miejsca i zakup online mogą podlegać wyłączeniom lub dopłatom.

Aplikacja zbiera repertuar z **Heliosa, Multikina, Cinema City i Filmwebu**. Do wyszukiwania potrzebujesz połączenia z internetem.

### Pobierz i zainstaluj

| Twoje urządzenie                                      | Pobierz aplikację                                                                                                                       | Co zrobić po pobraniu                                                                                                                                        |
| :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Komputer z Windows (64-bit)**                       | [**Pobierz instalator Windows**](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Setup.exe)  | Otwórz pobrany plik i przejdź przez instalację. Następnie uruchom Cinema Movie Finder z menu Start.                                                          |
| **Telefon z Androidem 7 lub nowszym (ARM32 / ARM64)** | [**Pobierz aplikację Android**](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest/download/CinemaMovieFinder-Android.apk) | Otwórz pobrany plik APK. Jeśli telefon o to poprosi, zezwól przeglądarce lub menedżerowi plików na instalację aplikacji z tego źródła. Wybierz „Zainstaluj”. |

**Wydanie 1.3.0:** [pobierz nową wersję](https://github.com/Landi545/Cinema-Movie-Finder/releases/tag/v1.3.0) z odświeżonym wyglądem, większymi i czytelniejszymi kartami filmów, plakatami oraz szybkim wyszukiwaniem informacji o filmie. Powitanie i ikona „Dzisiaj” dopasowują się do pory dnia. Przy braku internetu aplikacja pokazuje komunikat i pozwala ponowić wyszukiwanie po odzyskaniu połączenia.

**Wymagania Androida:** Android 7.0 (API 24) lub nowszy oraz **Chrome / Android System WebView 100 lub nowszy**. Na Androidzie 7–9 zaktualizuj Chrome, a na Androidzie 10+ — Android System WebView. Sam numer wersji Androida nie wystarcza: starszy składnik wyświetlający strony może uniemożliwić uruchomienie interfejsu.

Od wersji **1.2.3** jeden APK zawiera biblioteki dla systemów ARM32 (`armeabi-v7a`) i ARM64 (`arm64-v8a`). Wersja 1.2.2 obsługiwała wyłącznie ARM64. Systemy x86 / x86_64 nie są obsługiwane. Android 13 i 14 mieszczą się w obsługiwanym zakresie konfiguracji; nie deklarujemy jednak testów na każdym modelu telefonu. Zakres weryfikacji opisuje [dokumentacja mobilna](mobile/README.md#kompatybilność-i-weryfikacja).

**Nie wiesz, który plik wybrać?** Na komputerze pobierz plik z końcówką `.exe`, a na telefonie z Androidem — `.apk`. Nie musisz pobierać kodu źródłowego ani niczego samodzielnie budować.

**Odpowiedzialność za starsze wydania:** starsze wersje aplikacji mogą działać mniej płynnie, zawierać mniej funkcji i mieć nieaktualne źródła danych. Niektóre wydania mogą także nie działać poprawnie na słabszych lub starszych urządzeniach. Pobierasz i instalujesz starsze wydanie na własne ryzyko — zalecamy korzystanie z [najnowszego wydania](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest).

[Zobacz najnowsze wydanie i listę zmian →](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest)

### Pierwszy seans w pięciu krokach

1. **Wybierz miasto.** Kliknij jedną z propozycji lub wpisz własne miasto i wybierz „Dalej”.
2. **Wybierz dzień.** Użyj „Dzisiaj”, „Jutro” lub wskaż inną datę. Poczekaj na pobranie repertuaru.
3. **Wybierz film.** Przeglądaj plakaty i godziny lub wpisz tytuł w polu „Znajdź film”. „O filmie” otwiera wyszukiwarkę w przeglądarce; kliknięcie tytułu pokazuje dostępne seanse.
4. **Wybierz seans.** Sprawdź godzinę oraz kino.
5. **Przejdź do biletów.** W szczegółach wybierz „Otwórz bilety” lub „Otwórz repertuar”. Strona otworzy się w przeglądarce.

Na dole okna zobaczysz **wybrane miasto, datę i status wyszukiwania**, a po pobraniu wyników — liczbę filmów i seansów. Do wcześniejszego wyboru wrócisz przyciskami w aplikacji; „Szukaj dalej” pozwala rozpocząć kolejne wyszukiwanie.

### Pytania i pomoc

**Android wyświetla „Nie zainstalowano aplikacji” — co zrobić?**

1. Pobierz ponownie **APK z najnowszego wydania**, a nie archiwum kodu źródłowego. Upewnij się, że pobieranie zostało zakończone i masz wolne miejsce.
2. Zezwól na instalowanie aplikacji dla przeglądarki lub menedżera plików, z którego otwierasz APK.
3. Jeśli masz wydanie 1.2.2 i telefon z 32-bitowym systemem ARM, wybierz wersję 1.2.3 lub nowszą.
4. Jeśli instalowałeś wcześniej wersję testową/debug albo podpisaną innym kluczem, aktualizacja może zostać odrzucona. Nie odinstalowuj aplikacji bez potrzeby — usunięcie kasuje jej lokalne dane. Zwykłe wydania instaluj na istniejącej wersji.
5. Gdy błąd pozostaje, [zgłoś problem](https://github.com/Landi545/Cinema-Movie-Finder/issues) z **modelem telefonu, wersją Androida, wersją APK i dokładną treścią komunikatu**. Sam numer „Android 13/14” nie pozwala ustalić przyczyny.

Problemy z WebView dotyczą **uruchamiania interfejsu po instalacji**, a nie samej instalacji APK.

**Nie ma wyników albo repertuar jest niepełny — co zrobić?**

Sprawdź internet, spróbuj ponownie lub wybierz inną datę. Kino mogło jeszcze nie opublikować repertuaru, a źródło danych może być chwilowo niedostępne. Komunikat o problemie z pobieraniem nie oznacza, że w kinach nie ma seansów.

**Dlaczego przycisk otwiera repertuar zamiast zakupu biletu?**

Nie wszystkie źródła udostępniają bezpośredni link do zakupu. W takim przypadku aplikacja otwiera stronę repertuaru, na której możesz kontynuować wybór.

**Czy trzeba wpisywać polskie znaki?**

Nie. Możesz wpisać zarówno „Łódź”, jak i „Lodz”.

**Dlaczego niektóre filmy nie mają plakatu?**

Plakaty pochodzą bezpośrednio z danych kin. Jeśli wybrany seans nie zawiera obrazu, aplikacja szuka plakatu tego samego tytułu w danych innych kin oraz w katalogu filmów z innych dni. Dopasowanie wymaga zgodności wszystkich słów tytułu po usunięciu różnic w wielkości liter, polskich znakach i interpunkcji, dlatego aplikacja nie podstawia przypadkowego obrazu podobnie nazwanego filmu. Jeśli żadnego plakatu nie ma albo obrazu nie można pobrać, zobaczysz ozdobną kartę w kolorach aplikacji. Możesz nadal wybrać seans lub użyć „O filmie”, aby wyszukać tytuł w Google.

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

| Obszar                              | Gdzie szukać                                                                                                                                             |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Widoki, wygląd i nawigacja          | [index.html](desktop/ui/index.html), [style.css](desktop/ui/style.css), [app.js](desktop/ui/app.js)                                                      |
| Okno Windows i dostęp do API        | [desktop/main.cjs](desktop/main.cjs), [desktop/preload.cjs](desktop/preload.cjs)                                                                         |
| Komunikacja z silnikiem             | [desktop/bridge.cjs](desktop/bridge.cjs), [desktop/backend.h](desktop/backend.h)                                                                         |
| Pobieranie i parsowanie repertuaru  | [main.cpp](main.cpp)                                                                                                                                     |
| Android, podpisywanie i certyfikaty | [Dokumentacja mobilna](mobile/README.md)                                                                                                                 |
| Testy komunikacji i interfejsu      | [tests/bridge.test.cjs](tests/bridge.test.cjs), [tests/ui/](tests/ui/)                                                                                   |
| Pakowanie i publikacja              | [scripts/package.cjs](scripts/package.cjs), [workflow wydań](.github/workflows/release.yml), [instalator Windows](package/windows/CinemaMovieFinder.iss) |

Katalog promocji znajduje się w [promotions.json](desktop/ui/promotions.json), a jego format opisuje [promotions.schema.json](desktop/ui/promotions.schema.json). Każda promocja jest osobnym obiektem: po dopisaniu rekordu z `id`, opisem, sieciami i oficjalnym linkiem pojawi się automatycznie w aplikacji — nie trzeba dopisywać kolejnego warunku w interfejsie. Opcjonalne pole `verification` zawiera reguły tekstowe sprawdzane na stronach kin, np. `{ "pattern": "promocja|bilet", "flags": "i" }`; reguły łączą się operatorem AND. Bez `verification` oferta nadal jest widoczna jako oferta katalogowa, ale nie jest oznaczana jako potwierdzona przez źródło.

Po wejściu do promocji [wspólny moduł](desktop/promotions.cjs) sprawdza oficjalne strony zapisanych ofert, niezależnie od publikacji na GitHubie. Wynik podaje liczbę rozpoznanych ofert, a nie sam sukces HTTP. Na Windows ostatni udany wynik jest zapisywany w katalogu danych użytkownika jako `promotions-cache.json`; przy braku sieci cache może być użyty maksymalnie przez 7 dni i jest oznaczany jako zapis lokalny. Starszy cache nie jest przedstawiany jako aktualny. Cena Superwtorku jest odczytywana ze źródła. Desktop używa HTTP w procesie głównym, Android natywnego CapacitorHttp.

Promocje są umieszczone w osobnym pasku planowania pod etapami wyszukiwania. To stały punkt na narzędzia związane z planowaniem wyjścia do kina; obecnie zawiera wyłącznie promocje. Kalendarz premier nie jest jeszcze częścią aplikacji ani interfejsu.

#### Jak dodać promocję

1. Dodaj nowy obiekt do [promotions.json](desktop/ui/promotions.json), używając unikalnego `id` w kebab-case.
2. Wpisz `networks` zgodne z nazwami rozpoznawanymi przez aplikację, np. `helios`, `multikino`, `cinema city`.
3. Dodaj co najmniej jeden link HTTPS do oficjalnej strony kina. Domeny muszą należeć do listy dozwolonych w [desktop/main.cjs](desktop/main.cjs) i [mobile/app.js](mobile/app.js).
4. Dla promocji, którą można śledzić na konkretny dzień, ustaw `kind`, `weekday` albo `start` i `end`. Oferty ogólne oznacz `trackable: false`.
5. Jeśli oferta ma być weryfikowana automatycznie, dodaj `verification`. Nie dodawaj logiki dla jej `id` do `promotions.cjs` — wyjątki są potrzebne wyłącznie dla wartości wyliczanych, takich jak cena odczytywana ze źródła.

Przed publikacją uruchom `npm test` oraz `npm run test:ui` i sprawdź kartę nowej oferty, link do źródła, zachowanie offline oraz dopasowanie sieci i daty.

W kroku 04 [moduł cen](desktop/prices.cjs) pobiera ceny konkretnego seansu z oficjalnych API Heliosa i Multikina. Multikino: domyślna grupa biletów, wyłącznie strefa Standard, cena biletu plus opłata online. Helios: odczyt ceny dla zwykłego fotela (bez rezerwowania go), z obowiązkowymi dopłatami. Kwota zwrócona przez kino zawiera aktualny rabat i nie jest ponownie obniżana przez interfejs. Strefy Promo/VIP, kupony i bilety ulgowe nie zastępują ceny standardowej. Brak danych jest oznaczany kreską, nigdy wymyśloną ceną. Nie gwarantujemy dostępności konkretnego fotela.

Ceny są pobierane po wybraniu filmu, maksymalnie cztery żądania seansów równolegle; odczyty są buforowane przez dwie minuty. Interfejs przekazuje wyłącznie klucz filmu z bieżącego repertuaru, nie dowolny URL. Po jednoznacznym dopasowaniu kina, pełnego tytułu, daty i godziny odnośnik Filmwebu jest zastępowany oficjalnym zakupem. Niejednoznaczne dopasowanie pozostawia dotychczasowy link. Desktop obsługuje Heliosa, Multikino i Cinema City; niezależne kina wymagają osobnych integracji.

Śledzenie ofert tygodniowych jest dostępne tylko w odpowiednim dniu; Kinowa Środa wyklucza także święta. Zakończone oferty znikają, a ich śledzenie jest wyłączane. Złota ramka oznacza dopasowanie sieci i daty, nie gwarancję ceny: repertuar nie zawiera kompletu wyłączeń oferty. Oferty ogólne nie pozwalają śledzić pojedynczego filmu. Linki mogą prowadzić tylko do dozwolonych domen HTTPS kin; listy domen są w [desktop/main.cjs](desktop/main.cjs) i [mobile/app.js](mobile/app.js).

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

W PowerShell możesz używać `npm.cmd` i `npx.cmd`, jeśli polityka wykonywania blokuje skrypty `.ps1`. Komunikaty commitów pisz po angielsku, a komentarze w kodzie po polsku.

### Podgląd zmian bez publikowania

**Do sprawdzania wyglądu nie potrzebujesz commita, pusha ani GitHub Actions.** Otwórz [desktop/ui/index.html](desktop/ui/index.html) w przeglądarce i odśwież stronę po zapisaniu zmian. To podgląd warstwy wizualnej: zwykła przeglądarka nie ma dostępu do silnika ani systemowego otwierania linków.

Pełną aplikację uruchom przez `npm start` po przygotowaniu silnika Windows opisanego poniżej. Po zmianach interfejsu uruchom ją ponownie; zmiany procesu głównego i preload również wymagają ponownego uruchomienia. Do sprawdzenia wyników bez internetu użyj testów Playwright, które podstawiają kontrolowany kontrakt `window.cinema`.

Na telefonie używaj tego samego interfejsu: `npm run mobile:prepare` odświeża [dist/mobile/](dist/mobile/), a `npm run mobile:android` dodatkowo synchronizuje zasoby projektu Android. Samo odświeżenie tych katalogów nie aktualizuje APK zainstalowanego na urządzeniu — potrzebna jest ponowna kompilacja i instalacja.

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

### Kontrakt interfejsu i zasady zmian

| Metoda `window.cinema`   | Zadanie                                                                                           |
| :----------------------- | :------------------------------------------------------------------------------------------------ |
| `search({ city, date })` | Zwraca miasto, listę `screenings` i opcjonalne `unavailableSources`. Data ma format `YYYY-MM-DD`. |
| `detail(id)`             | Uzupełnia adres kina dla seansu z ostatnich wyników.                                              |
| `cancel()`               | Przerywa pracę silnika i unieważnia linki z poprzedniego wyszukiwania.                            |
| `openTicket(url)`        | Otwiera tylko adres otrzymany w bieżącym repertuarze.                                             |
| `openMovie(movieKey)`    | Otwiera Google z tytułem filmu z bieżących wyników. Nie przyjmuje dowolnego URL.                  |
| `promote()` / `quit()`   | Otwiera gotowy post na X / zamyka aplikację; na Androidzie przycisk wyjścia jest ukryty.          |

Rekord seansu zawiera `id`, `movieKey`, `title`, `time`, `cinema`, `address`, `ticketUrl` oraz opcjonalne `posterUrl`. Starsze odpowiedzi bez plakatu pozostają poprawne. Grupowanie filmów zachowuje wszystkie seanse, a pole wyszukiwania ignoruje wielkość liter i brak polskich znaków. Tytuły i inne dane źródeł wstawiaj przez `textContent`, nigdy jako HTML.

**Plakaty:** parsery odczytują `posterPhoto.url` z Heliosa, `posterImageSrc` z Multikina i `posterLink` z Cinema City. Po połączeniu repertuarów silnik tworzy katalog według pełnego `normalizePolish(title)`: plakat znaleziony w jednym kinie uzupełnia ten sam film w pozostałych kinach. Odpowiedź Heliosa zawiera również katalog filmów poza wybraną datą, więc może uzupełnić film dostępny danego dnia tylko w innym źródle. Bieżący plakat seansu ma pierwszeństwo; podobny, ale inny tytuł nie zostanie dopasowany. Nie wykonujemy dodatkowych zapytań do usług wyszukiwania obrazów. Przeglądarka pobiera obrazy dopiero w pobliżu widocznej części listy, bez nagłówka odsyłającego. Interfejs i CSP dopuszczają HTTPS wyłącznie z `img.helios.pl`, `www.multikino.pl` i `www.cinema-city.pl`. Przy zmianie źródeł zmień obie listy i sprawdź zachowanie przy błędzie obrazu. Plakaty pozostają własnością ich uprawnionych właścicieli.

**Pora dnia:** godziny 6:00–17:59 oznaczają dzień, a 18:00–5:59 — wieczorne powitanie, według lokalnego zegara urządzenia. Widok odświeża się co minutę oraz po powrocie do aplikacji. Nie wymaga lokalizacji ani danych pogodowych.

**Połączenie:** zdarzenie `offline` podczas pobierania przerywa bieżące żądanie; licznik `generation` chroni przed spóźnioną odpowiedzią. Po `online` użytkownik sam ponawia wyszukiwanie. `navigator.onLine` wykrywa stan zgłaszany przez system, ale nie gwarantuje dostępu do internetu — awaria źródła, portal logowania do Wi-Fi i limit czasu nadal korzystają z obsługi błędów silnika. Nie przedstawiaj ich jako pustego repertuaru.

### Odporność na awarie źródeł

- Cinema City (desktop): publiczne odczyty `presentations/{id}` i `ticketGroups` dostarczają taryfę konkretnego seansu, również VIP/IMAX. Nie tworzymy koszyka ani nie blokujemy foteli. Cena API zawiera już opłatę za bilet — nie dodajemy jej drugi raz. Dopłaty zależne od miejsca powodują oznaczenie „od”. Przy braku zwykłej strefy wybierana jest dostępna rozpoznana taryfa VIP; ulgi, kupony, pakiety i bilety wymagające członkostwa są pomijane. Nieznana struktura opłat pozostawia cenę niedostępną zamiast zgadywać. Fallback dla odnośnika Filmwebu wymaga jednoznacznego dopasowania kina, filmu, daty i godziny.

- Multikino: brak strefy Standard nie oznacza braku ceny. Parser sprawdza kolejno Standard, Lux, Ultra Lux i pozostałe rozpoznane publiczne strefy pojedynczych biletów. Fallback zachowuje nazwę faktycznej strefy i obowiązkową opłatę online; nie korzysta z kuponów, pakietów ani cen innych seansów. Dotyczy to m.in. kin Warszawa Młociny i Warszawa G City Targówek.

- Przycisk „Ponów pobieranie brakujących cen” pozwala odzyskać ceny po chwilowej awarii bez ponownego wyszukiwania repertuaru. W wersji desktop ponawiane są tylko brakujące ceny, a poprawnie pobrane pozostają na ekranie.
- Przycisk ponowienia pozostaje widoczny, gdy dowolny seans Heliosa, Multikina lub Cinema City nadal nie ma ceny; podczas trwającego odczytu jest nieaktywny, a po zakończeniu można użyć go ponownie.
- Desktop zapisuje maksymalnie 50 ostatnich awarii cen w `price-diagnostics.json` w katalogu danych aplikacji (Windows: `%APPDATA%/Cinema Movie Finder`). Zapis obejmuje czas, źródło, status HTTP i typ/kod wyjątku; nie zawiera ciasteczek, tokenów ani adresów rezerwacji. Pozwala odróżnić błąd serwera, sieci i parsera. Błąd zapisu diagnostyki nie blokuje aplikacji.

- Ceny Heliosa obejmują także sale IMAX, DREAM i VIP: format sali nie jest powodem odrzucenia taryfy. Odczyt dotyczy konkretnego seansu i pojedynczego fotela, z obowiązkowymi opłatami. Przy cenie widnieją format i strefa miejsca. Jeśli domyślna strefa nie udostępnia taryfy, sprawdzane są nazwane strefy pojedynczych foteli (maksymalnie cztery strefy); sofy i miejsca dla wózków nie zastępują zwykłego biletu.
- Nie wszystkie braki cen oznaczają błąd aplikacji: system sprzedaży może zwrócić HTTP 500 lub pustą taryfę, również przy działającym repertuarze. Nie podstawiamy wtedy ceny z innego kina, dnia ani seansu. Automatyczny odczyt desktop obejmuje Heliosa, Multikino i Cinema City.

- Niepełny repertuar pozostaje dostępny, a brakujące źródło jest sygnalizowane krótką, stonowaną informacją. Brak danych po awarii nie oznacza braku seansów.
- Niepoprawne odpowiedzi silnika są odrzucane; kolejne wyszukiwanie może uruchomić go ponownie. Anulowane odpowiedzi nie przywracają starych odnośników do biletów.
- Odczyt cen ma limit 10 sekund na żądanie i najwyżej jedno ponowienie po błędzie sieci lub HTTP 5xx. Blokady 403 i ograniczenia 429 nie są ponawiane. Po 401 sesja anonimowa Multikina jest odnawiana raz.
- Błąd ceny nie blokuje wyboru seansu ani oficjalnego odnośnika. Ponowne otwarcie filmu po 30 sekundach pozwala ponowić nieudany odczyt. Pamięć odpowiedzi cenowych jest ograniczona do 256 wpisów z ważnością 2 minut.
- Aplikacja nie zastępuje brakujących cen wymyślonymi wartościami. „Od” oznacza dolną cenę rozpoznanej taryfy; dopłaty za wybrane miejsca i cenę końcową potwierdza system sprzedaży.
- Brak internetu jest komunikowany po polsku; techniczne wyjątki odczytu danych nie są pokazywane jako komunikaty użytkownika. Nie dodano automatycznego pokazywania starego repertuaru jako aktualnego.

### Kontrola przed wydaniem

- `npm test` — walidacja danych, komunikacja JSON, anulowanie i awaria procesu.
- `npm run test:ui` — przejście przez wybór seansu, filtrowanie, klawiatura, szerokości 320/390/430 px, granice pory dnia, utrata internetu i ponowienie, plakaty i ich zamienniki oraz mobilne otwieranie linków.
- Test `mobile-bridge` w CTest — parsery źródeł, przypisanie plakatów do filmów, kodowanie UTF-8 i protokół natywny. W VS Code używaj CMake Tools; konfiguracja znajduje się w [mobile/native/](mobile/native/).
- `node scripts/smoke.cjs` po spakowaniu Windows — uruchomienie rzeczywistej aplikacji. Sprawdź też instalację i ręczne wyszukiwanie na docelowym urządzeniu.

Zmiana [main.cpp](main.cpp) lub [desktop/backend.h](desktop/backend.h) wymaga przebudowania zarówno silnika Windows, jak i `libcinema.so` dla obu ABI Androida. Samo skopiowanie interfejsu nie aktualizuje bibliotek natywnych. Testy przeglądarkowe nie zastępują testu APK na telefonie.

### Wydania

Push do `main` uruchamia budowanie artefaktów Windows i Androida. Tag `v*`, zgodny z wersją projektu, publikuje instalator i podpisany APK dopiero po przejściu budowania oraz testów.

W razie niedostępności Actions można zbudować i przetestować oba instalatory lokalnie, a następnie dołączyć je do GitHub Releases pod tagiem wydania. Wymagania podpisu i weryfikacji APK opisuje [dokumentacja mobilna](mobile/README.md#wydania-i-podpisywanie). Nie zastępuj brakującego instalatora archiwum kodu ani plikiem ze starszej wersji.

Lokalne wydanie przygotuj z jednego, sprawdzonego commita. Zbuduj silnik i pakiet Windows, uruchom test spakowanej aplikacji, a następnie skompiluj instalator w Inno Setup. Dla Androida zbuduj obie biblioteki ABI, zsynchronizuj projekt i przygotuj podpisany APK. Zweryfikuj wersję, podpis oraz zawartość gotowych plików przed publikacją. Jeśli Actions jest zablokowane, commit z `[skip ci]` pozwala uniknąć uruchamiania workflowu `push`; publikację wykonaj ręcznie przez GitHub Releases lub GitHub CLI.

W wydaniu umieszczaj **`CinemaMovieFinder-Setup.exe` i `CinemaMovieFinder-Android.apk`**. Archiwa „Source code” GitHub tworzy automatycznie z tagu. Opis wydania powinien zawierać zmiany ważne dla użytkownika i krótką instrukcję pobierania; logi kompilacji, raporty testów i sumy kontrolne zachowaj lokalnie.

Przed oznaczeniem wydania zaktualizuj wersję w [package.json](package.json), [package-lock.json](package-lock.json) i [konfiguracji instalatora](package/windows/CinemaMovieFinder.iss), a następnie sprawdź ich zgodność:

```sh
node scripts/check-version.cjs
```

Klucze i hasła podpisujące przechowuj poza repozytorium. Konfigurację sekretów i zasady zachowania klucza Androida opisuje [dokumentacja mobilna](mobile/README.md#wydania-i-podpisywanie).

---

[Pobierz aplikację](https://github.com/Landi545/Cinema-Movie-Finder/releases/latest) · [Zgłoś problem](https://github.com/Landi545/Cinema-Movie-Finder/issues) · [Licencja MIT](LICENSE)
