# Wersja mobilna

Capacitor 8 ładuje kopię `desktop/ui/`. `app.js` udostępnia kontrakt `window.cinema`, a lokalna wtyczka przekazuje JSON do tego samego `desktopRequest`, którego używa Electron. JNI na Androidzie wykonuje pracę w kolejce poza interfejsem. Anulowanie unieważnia też oczekujące żądania oraz przerywa libcurl; całe wyszukiwanie ma limit trzech minut.

## Kompilacja

Wymagane: Node 24, CMake, Ninja i vcpkg w wersji przypiętej w [workflowie](../.github/workflows/mobile.yml). Android: JDK 21, SDK 36, NDK 28.2.13676358. Android jest budowany dla ARM64.

1. `npm ci`
2. Zbuduj `mobile/native` poleceniami dla Androida z workflowu i skopiuj bibliotekę do `mobile/plugin/android/src/main/jniLibs/arm64-v8a`.
3. `npm run mobile:android` generuje projekt i kopiuje interfejs. Katalogi `android/` i `dist/` są generowane i pomijane przez Git. Nie przechowuj w nich ręcznych zmian.
4. Android: `cd android` i `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).

`npm run mobile:prepare` odświeża sam interfejs. `npm run test:ui` sprawdza także pełny przebieg na szerokościach 320, 390 i 430 px. Testy C++ mostu działają na Linuksie przez CMake/CTest i nie wymagają internetu. CI sprawdza ponadto rzeczywistą kompilację Androida. Testy w przeglądarce nie zastępują testu na fizycznym telefonie.

## Wydania i podpisywanie

Push do `main` buduje artefakty Windows i Android. Tag zgodny z wersją w `package.json` publikuje wydanie dopiero po zakończeniu wszystkich zadań.

Sekrety repozytorium `ANDROID_KEYSTORE_BASE64` oraz `ANDROID_KEYSTORE_PASSWORD` zawierają klucz wydania i hasło. Alias: `cinema`. Klucz musi być zachowany między wydaniami; jego zmiana uniemożliwi aktualizację istniejącej instalacji. Zachowaj niezależną, prywatną kopię klucza i hasła. Lokalny build release używa `ANDROID_KEYSTORE_PATH` oraz `ANDROID_KEYSTORE_PASSWORD`. Brak sekretów pozwala zbudować debug w PR, ale blokuje publikację tagu.

## Certyfikaty HTTPS

[native/cacert.pem](native/cacert.pem) to publiczny zestaw CA Mozilla z `https://curl.se/ca/cacert.pem`, z datą pochodzenia w nagłówku. Jest osadzany w silniku; weryfikacja certyfikatów i nazw hostów pozostaje włączona. Aktualizuj ten plik przy utrzymaniu wydań, gdy zmienia się zestaw zaufanych CA. To nie jest prywatny klucz podpisujący aplikację. Licencje bibliotek natywnych i Capacitor są dołączane do zasobów aplikacji w katalogu `licenses`.

## Ograniczenia

Repertuar wymaga internetu; źródła mogą ograniczać pobieranie. Aplikacja nie deklaruje pracy w tle: po dłuższym uśpieniu telefonu wyszukiwanie może wymagać ponowienia. Przycisk systemowy Wstecz na Androidzie przechodzi do poprzedniego kroku; na ekranie startowym zamyka aplikację. Bilety i udostępnianie otwierają systemowy widok przeglądarki.
