// Czytamy polskie premiery kinowe, nie mieszamy premier światowych i festiwalowych.
// Wspólny parser działa w procesie głównym Electron i w pakiecie Androida.
const { parseDocument, DomUtils } = require("htmlparser2");
const ORIGIN = "https://www.filmweb.pl";

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function safeReleaseSource(value) {
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && !url.username && !url.password
      && /^\/(?:film|serial)\/[^/]+-\d+$/.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}

const byClass = (root, name) => DomUtils.findAll(
  node => (node.attribs?.class || "").split(/\s+/).includes(name), root.children || [],
);
const text = node => node ? DomUtils.textContent(node).replace(/\s+/g, " ").trim() : "";
const names = (root, name) => byClass(root, name).flatMap(node =>
  DomUtils.findAll(child => child.name === "h3", node.children).map(text),
).join(", ");

function normalizeResult(html) {
  if (typeof html !== "string") throw new Error("Niepoprawna odpowiedź kalendarza.");
  // Nie wykonujemy pobranych skryptów i nie wstawiamy zewnętrznego HTML do okna.
  const document = parseDocument(html);
  const calendar = byClass(document, "premieresList")[0];
  if (!calendar) throw new Error("Źródło zmieniło format kalendarza lub jest niedostępne.");
  const items = [];
  for (const day of byClass(calendar, "premieresList__dayRange")) {
    const date = day.attribs["data-date"];
    if (!validDate(date)) throw new Error("Źródło zwróciło niepoprawną datę premiery.");
    for (const card of byClass(day, "previewFilm")) {
      const id = card.attribs["data-film-id"];
      const link = byClass(card, "preview__link")[0];
      const title = text(link);
      const sourceUrl = new URL(link?.attribs.href || "/", ORIGIN).href;
      if (!/^\d+$/.test(id || "") || !title || !safeReleaseSource(sourceUrl))
        throw new Error("Źródło zwróciło niepełne dane filmu.");
      const image = byClass(card, "poster__image")[0]?.attribs.src || "";
      // Dopuszczamy tylko prawdziwe plakaty dostawcy, bez zewnętrznych adresów.
      const bannerUrl = /^https:\/\/(?:[a-z0-9-]+\.)?fwcdn\.pl\/fpo\//i.test(image) ? image : "";
      const genres = names(card, "preview__detail--genres");
      const duration = text(byClass(card, "preview__duration")[0]);
      const director = names(card, "preview__detail--director");
      const cast = names(card, "preview__detail--cast");
      items.push({ id, date, title, bannerUrl, sourceUrl,
        genres: genres ? genres.split(/,\s*/).filter(Boolean) : [],
        metadata: [genres, duration].filter(Boolean).join(" · "),
        description: [director && "Reżyseria: " + director, cast && "W obsadzie: " + cast].filter(Boolean).join(". "),
      });
    }
  }
  if (byClass(calendar, "previewFilm").length !== items.length)
    throw new Error("Nie udało się przypisać wszystkich filmów do dat premier.");
  return uniqueFilms(items);
}

function uniqueFilms(items) {
  const unique = new Map();
  // Jeden identyfikator filmu = jedna premiera. Kolejność w obrębie dnia pochodzi ze źródła.
  for (const item of items.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

async function loadReleaseCalendar(readText, from, to) {
  if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    throw new Error("Niepoprawny zakres kalendarza.");
  const cursor = new Date(from + "T12:00:00Z");
  cursor.setUTCDate(1);
  const pages = [];
  while (cursor.toISOString().slice(0, 10) <= to) {
    pages.push(ORIGIN + "/premiere/" + cursor.getUTCFullYear() + "/" + (cursor.getUTCMonth() + 1));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  // Bez pamięci podręcznej: każde otwarcie i każda strzałka ponownie sprawdzają źródło.
  const items = [];
  for (const url of pages) items.push(...normalizeResult(await readText(url)));
  return { items: uniqueFilms(items).filter(item => item.date >= from && item.date <= to),
    from, to, checkedAt: new Date().toISOString() };
}

module.exports = { loadReleaseCalendar, normalizeResult, safeReleaseSource };
