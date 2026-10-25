import { registerPlugin, CapacitorHttp } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { loadPromotions } from "../desktop/promotions.cjs";
import { createPriceService } from "../desktop/prices.cjs";
import { loadReleaseCalendar } from "../desktop/release-calendar.cjs";
let priceSearch = null;
let guestUntil = 0, guestRequest;
const priceService = createPriceService(async (url) => {
  if (url.startsWith("https://www.multikino.pl/api/microservice/booking/") && Date.now() >= guestUntil) {
    if (!guestRequest) guestRequest = CapacitorHttp.post({ url: "https://www.multikino.pl/api/microservice/auth/token", headers: { Accept: "application/json" }, connectTimeout: 10000, readTimeout: 10000 })
      .then(response => { if (response.status !== 200) throw Error("Sesja kina niedostępna"); guestUntil = Date.now() + 240000; })
      .finally(() => { guestRequest = null; });
    await guestRequest;
  }
  const response = await CapacitorHttp.get({ url, responseType: "json", connectTimeout: 10000, readTimeout: 10000 });
  if (response.status !== 200) { if (response.status === 401) guestUntil = 0; throw Error("Cena niedostępna"); }
  return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
});

const engine = registerPlugin("CinemaEngine");
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
const promotionHosts = new Set(["helios.pl", "www.helios.pl", "multikino.pl", "www.multikino.pl", "cinema-city.pl", "www.cinema-city.pl"]);
let tickets = new Set();
let movies = new Map();
let generation = 0;
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};
async function request(input) {
  const { json } = await engine.request({ json: JSON.stringify(input) });
  const result = JSON.parse(json);
  if (result.error) throw new Error(result.error);
  return result;
}

// Telefon udostępnia ten sam kontrakt co preload Electron; widoki pozostają wspólne.
window.cinema = {
  async getReleaseCalendar(range) {
    return loadReleaseCalendar(async (url) => {
      const response = await CapacitorHttp.get({ url, responseType: "json", headers: { "User-Agent": "CinemaMovieFinder/1.0" }, connectTimeout: 15000, readTimeout: 15000 });
      if (response.status !== 200) throw new Error("Źródło kalendarza jest chwilowo niedostępne.");
      return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    }, range?.from, range?.to);
  },
  async getPromotions() {
    return loadPromotions(async (url) => {
      const response = await CapacitorHttp.get({ url, responseType: "text", connectTimeout: 10000, readTimeout: 10000 });
      if (response.status !== 200 || typeof response.data !== "string") throw new Error("Źródło niedostępne");
      return response.data;
    });
  },
  async search(input) {
    const token = ++generation;
    tickets.clear();
    movies.clear();
    priceSearch = null;
    const result = await request({ command: "search", ...input });
    if (token !== generation) throw new Error("Anulowano pobieranie.");
    tickets = new Set(
      result.screenings.map((row) => row.ticketUrl).filter(safeUrl),
    );
    movies = new Map(result.screenings.map((row) => [row.movieKey, row.title]));
    priceSearch = { rows: result.screenings, city: result.city, date: input.date };
    return result;
  },
  async prices(key) {
    const search = priceSearch;
    if (!search || !movies.has(key)) throw Error("Wybierz film z repertuaru.");
    const result = await priceService.prices(search.rows.filter(row => row.movieKey === key), search.city, search.date);
    if (search !== priceSearch) return [];
    for (const row of result) if (row.ticketUrl && safeUrl(row.ticketUrl)) tickets.add(row.ticketUrl);
    return result;
  },
  detail: (id) => request({ command: "detail", id }),
  async cancel() {
    priceSearch = null;
    ++generation;
    tickets.clear();
    movies.clear();
    await engine.cancel();
  },
  // Tytuł pochodzi z wyników, a docelowa domena wyszukiwarki jest stała.
  async openMovie(key) {
    if (!movies.has(key)) throw new Error("Wybierz film z repertuaru.");
    await Browser.open({
      url:
        "https://www.google.com/search?q=" +
        encodeURIComponent(movies.get(key) + " film"),
    });
  },
  async openTicket(url) {
    if (!safeUrl(url) || !tickets.has(url))
      throw new Error("Nieprawidłowy adres biletów.");
    await Browser.open({ url });
  },
  promote: () =>
    Browser.open({
      url:
        "https://x.com/intent/post?text=" +
        encodeURIComponent(
          "Cinema Movie Finder — znajdź seans w swoim mieście. https://github.com/Landi545/Cinema-Movie-Finder",
        ),
    }),
  async openPromotion(id) {
    const url = promotionLinks.get(id) || id;
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error("Nieprawidłowa promocja."); }
    if (parsed.protocol !== "https:" || !promotionHosts.has(parsed.hostname) || parsed.username || parsed.password || parsed.port) throw new Error("Nieprawidłowa promocja.");
    await Browser.open({ url });
  },
  quit: () => App.exitApp(),
};
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("quit").hidden = true;
});
App.addListener("backButton", () => {
  const panel = document.querySelector("main > section:not([hidden])");
  const back = panel?.querySelector("[data-back], #cancel");
  if (back) back.click();
  else App.exitApp();
});
