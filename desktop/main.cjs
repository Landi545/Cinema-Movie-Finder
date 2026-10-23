const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Backend, validSearch, safeUrl } = require("./bridge.cjs");
const { loadPromotions } = require("./promotions.cjs");
const { createPriceService } = require("./prices.cjs");
const { createPriceHttp } = require("./price-http.cjs");
const priceService = createPriceService(createPriceHttp());
let priceSearch = null;

// Ustalamy stałą lokalizację danych Electron, aby deinstalator usuwał
// wyłącznie dane tej aplikacji, nigdy wspólny katalog Electron.
app.setName("Cinema Movie Finder");

const page = path.join(__dirname, "ui", "index.html");
const promotionHosts = new Set(["helios.pl", "www.helios.pl", "multikino.pl", "www.multikino.pl", "cinema-city.pl", "www.cinema-city.pl"]);
function safePromotionUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" && promotionHosts.has(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}
// Udostępniamy publiczne repozytorium; użytkownik sam zatwierdza post na X.
const promotionUrl = `https://x.com/intent/post?text=${encodeURIComponent("Zobaczcie Cinema Movie Finder — prostą aplikację do znajdowania seansów kinowych w Polsce. Sprawdźcie projekt i dajcie znać, co myślicie! https://github.com/Landi545/Cinema-Movie-Finder")}`;
const promotionLinks = new Map([
  [
    "festival-multikino",
    "https://www.multikino.pl/newsy/swieto-kina-powraca-caly-weekend-z-filmami-za-15-zl",
  ],
  [
    "festival-helios",
    "https://helios.pl/zory/kino-helios/aktualnosci/swietokina-21934",
  ],
  [
    "festival-cinema-city",
    "https://www.cinema-city.pl/static/pl/pl/blog/swieto-kina-2026-bilety-na-wszystkie-seanse-za-15-zlotych",
  ],
  [
    "helios-advance",
    "https://helios.pl/katowice/kino-helios/aktualnosci/kup-bilet-wczesniej-i-oszczedzaj-33",
  ],
  [
    "cinema-city-wednesday",
    "https://www.cinema-city.pl/static/pl/pl/bilety-ulgowe",
  ],
  ["multikino-online", "https://www.multikino.pl/newsy/kupuj-taniej-online"],
]);
let backend;
let tickets = new Set();
let movies = new Map();
// IPC przyjmujemy wyłącznie z głównej ramki lokalnego interfejsu.
function trusted(event) {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== pathToFileURL(page).href
  )
    throw new Error("Niedozwolone żądanie.");
}
app.whenReady().then(() => {
  const executable = app.isPackaged
    ? path.join(process.resourcesPath, "backend", "cinema_movie_finder.exe")
    : path.join(
        __dirname,
        "..",
        "package",
        "windows",
        "payload",
        "Cinema Movie Finder Files",
        "cinema_movie_finder.exe",
      );
  backend = new Backend(executable);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  ipcMain.handle("search", async (event, input) => {
    trusted(event);
    if (!validSearch(input)) throw new Error("Podaj miasto i poprawną datę.");
    tickets.clear();
    movies.clear();
    priceSearch = null;
    const result = await backend.request({
      command: "search",
      city: input.city,
      date: input.date,
    });
    // Przeglądarka może otworzyć tylko adres otrzymany w bieżących wynikach.
    tickets = new Set(
      result.screenings.map((row) => row.ticketUrl).filter(safeUrl),
    );
    movies = new Map(result.screenings.map((row) => [row.movieKey, row.title]));
    priceSearch = { rows: result.screenings, city: result.city, date: input.date };
    return result;
  });
  ipcMain.handle("prices", async (event, key) => {
    trusted(event);
    const search = priceSearch;
    if (!search || !movies.has(key)) throw Error("Wybierz film z repertuaru.");
    const result = await priceService.prices(search.rows.filter(row => row.movieKey === key), search.city, search.date);
    if (search !== priceSearch) return [];
    for (const row of result) if (row.ticketUrl && safeUrl(row.ticketUrl)) tickets.add(row.ticketUrl);
    return result;
  });
  ipcMain.handle("detail", (event, id) => {
    trusted(event);
    if (!Number.isSafeInteger(id) || id < 0)
      throw new Error("Wybierz seans ponownie.");
    return backend.request({ command: "detail", id });
  });
  ipcMain.handle("cancel", (event) => {
    trusted(event);
    backend.stop();
    priceSearch = null;
    tickets.clear();
    movies.clear();
  });
  // Wyszukiwarkę otwieramy wyłącznie dla filmu z ostatniego repertuaru.
  ipcMain.handle("open-movie", async (event, key) => {
    trusted(event);
    if (!movies.has(key)) throw new Error("Wybierz film z repertuaru.");
    await shell.openExternal(
      `https://www.google.com/search?q=${encodeURIComponent(movies.get(key) + " film")}`,
    );
  });
  ipcMain.handle("open-ticket", async (event, url) => {
    trusted(event);
    if (!safeUrl(url) || !tickets.has(url))
      throw new Error("Nieprawidłowy adres biletów.");
    await shell.openExternal(url);
  });
  ipcMain.handle("promote", async (event) => {
    trusted(event);
    await shell.openExternal(promotionUrl);
  });
  ipcMain.handle("open-promotion", async (event, id) => {
    trusted(event);
    const url = promotionLinks.get(id) || id;
    if (!safePromotionUrl(url)) throw new Error("Nieprawidłowa promocja.");
    await shell.openExternal(url);
  });
  ipcMain.handle("get-promotions", async (event) => {
    trusted(event);
    return loadPromotions(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Źródło niedostępne");
      return response.text();
    });
  });
  ipcMain.handle("quit", (event) => {
    trusted(event);
    app.quit();
  });
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    title: "Cinema Movie Finder",
    backgroundColor: "#fffdf7",
    icon: path.join(__dirname, "..", "package", "windows", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(page);
});
app.on("before-quit", () => backend?.stop());
app.on("window-all-closed", () => app.quit());
