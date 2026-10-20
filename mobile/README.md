# Wersja mobilna

Capacitor 8 ładuje kopię `desktop/ui/`. `app.js` udostępnia kontrakt `window.cinema`, a lokalna wtyczka przekazuje JSON do tego samego `desktopRequest`, którego używa Electron. JNI na Androidzie wykonuje pracę w kolejce poza interfejsem. Anulowanie unieważnia też oczekujące żądania oraz przerywa libcurl; całe wyszukiwanie ma limit trzech minut.

## Kompilacja

Wymagane: Node 24, CMake, Ninja i vcpkg w wersji przypiętej w [workflowie](../.github/workflows/mobile.yml). Android: JDK 21, SDK 36, NDK 28.2.13676358. Jeden APK zawiera ARM32 i ARM64.

1. `npm ci`
2. Zbuduj `mobile/native` dla obu ABI według workflowu: `arm-android` / `armeabi-v7a` oraz `arm64-android` / `arm64-v8a`, z `ANDROID_PLATFORM=24`. Do `mobile/plugin/android/src/main/jniLibs/<ABI>/` skopiuj odpowiednie `libcinema.so` i `libc++_shared.so`. Nie mieszaj bibliotek różnych architektur.
3. `npm run mobile:android` generuje projekt i kopiuje interfejs. Katalogi `android/` i `dist/` są generowane i pomijane przez Git. Nie przechowuj w nich ręcznych zmian.
4. Android: `cd android` i `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).

`npm run mobile:prepare` odświeża sam interfejs. `npm run test:ui` sprawdza także pełny przebieg na szerokościach 320, 390 i 430 px. Testy C++ mostu działają na Linuksie przez CMake/CTest i nie wymagają internetu. CI sprawdza ponadto rzeczywistą kompilację Androida. Testy w przeglądarce nie zastępują testu na fizycznym telefonie.

## Wydania i podpisywanie

Push do `main` buduje artefakty Windows i Android. Tag zgodny z wersją w `package.json` publikuje wydanie dopiero po zakończeniu wszystkich zadań.

Sekrety repozytorium `ANDROID_KEYSTORE_BASE64` oraz `ANDROID_KEYSTORE_PASSWORD` zawierają klucz wydania i hasło. Alias: `cinema`. Klucz musi być zachowany między wydaniami; jego zmiana uniemożliwi aktualizację istniejącej instalacji. Zachowaj niezależną, prywatną kopię klucza i hasła. Lokalny build release używa `ANDROID_KEYSTORE_PATH` oraz `ANDROID_KEYSTORE_PASSWORD`. Brak sekretów pozwala zbudować debug w PR, ale blokuje publikację tagu.

## Kompatybilność i weryfikacja

| Warstwa | Wymaganie |
| :--- | :--- |
| System | Android 7.0+ (`minSdkVersion=24`), docelowe API 36 |
| Biblioteki natywne | ARM32 `armeabi-v7a` i ARM64 `arm64-v8a` od 1.2.3; brak x86 / x86_64 |
| Interfejs | Chrome / Android System WebView 100+; kompilacja obu skryptów dla Chrome 100 |
| Sieć | Internet i dostępne źródła repertuaru |

[Capacitor 8 obsługuje API 24+](https://capacitorjs.com/docs/android). Aplikacja ma wyższy wymóg WebView (100) niż sam Capacitor, ponieważ używa m.in. `replaceChildren` i nowoczesnego CSS. Próg jest jawny w `capacitor.config.json`; lokalny ekran `compatibility.html` informuje o potrzebie aktualizacji, również gdy główny interfejs nie może się załadować.

Audyt opublikowanego **v1.2.2**: `aapt dump badging` potwierdził minimalne API 24, docelowe API 36 i wyłącznie `arm64-v8a`; `apksigner verify` potwierdził poprawny podpis v2. Sam Android 13/14 nie wyklucza więc instalacji. Brak ARM32 jest możliwą przyczyną problemu na telefonie z 32-bitowym systemem, ale bez modelu i komunikatu nie jest potwierdzoną diagnozą.

CI weryfikuje **gotowy APK**: scalony manifest (API 24/36), obie architektury i obie biblioteki w każdej z nich, podpis dla API 24, 33 i 34 oraz wyrównanie wydania do stron 16 KB. Testy Playwright sprawdzają przebieg wyboru i układ telefonu. To nie zastępuje instalacji i działania JNI na fizycznym urządzeniu lub emulatorze: Android 7, 13 i 14 nie mają tutaj automatycznego testu uruchomienia APK.

Przed potwierdzeniem zgodności konkretnego telefonu sprawdź instalację, start aplikacji, wyszukiwanie, szczegóły seansu, otwarcie biletów i systemowy przycisk Wstecz. Do diagnozy instalacji przez ADB przydają się:

```sh
adb shell getprop ro.product.cpu.abilist
adb shell getprop ro.build.version.sdk
adb install -r CinemaMovieFinder-Android.apk
```

`INSTALL_FAILED_NO_MATCHING_ABIS` wskazuje architekturę, `INSTALL_FAILED_UPDATE_INCOMPATIBLE` — konflikt podpisów, a `INSTALL_FAILED_VERSION_DOWNGRADE` — próbę instalacji starszego wydania. Zachowaj dokładny błąd. Nie usuwaj istniejącej instalacji jako pierwszego kroku.

## Certyfikaty HTTPS

[native/cacert.pem](native/cacert.pem) to publiczny zestaw CA Mozilla z `https://curl.se/ca/cacert.pem`, z datą pochodzenia w nagłówku. Jest osadzany w silniku; weryfikacja certyfikatów i nazw hostów pozostaje włączona. Aktualizuj ten plik przy utrzymaniu wydań, gdy zmienia się zestaw zaufanych CA. To nie jest prywatny klucz podpisujący aplikację. Licencje bibliotek natywnych i Capacitor są dołączane do zasobów aplikacji w katalogu `licenses`.

## Ograniczenia

Repertuar wymaga internetu; źródła mogą ograniczać pobieranie. Aplikacja nie deklaruje pracy w tle: po dłuższym uśpieniu telefonu wyszukiwanie może wymagać ponowienia. Przycisk systemowy Wstecz na Androidzie przechodzi do poprzedniego kroku; na ekranie startowym zamyka aplikację. Bilety i udostępnianie otwierają systemowy widok przeglądarki.
