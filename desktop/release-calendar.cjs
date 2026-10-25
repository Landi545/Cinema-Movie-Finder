// Kalendarz korzysta z publicznych danych Wikidata, więc nie wymaga klucza API.
// Moduł nie zna transportu: desktop używa fetch, a Android CapacitorHttp.
const CALENDAR_LIMIT = 100;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildQuery(from, to) {
  return `SELECT DISTINCT ?film ?filmLabel ?date WHERE {
    ?film wdt:P31/wdt:P279* wd:Q11424;
          wdt:P577 ?date.
    FILTER(?date >= "${from}T00:00:00Z"^^xsd:dateTime && ?date <= "${to}T23:59:59Z"^^xsd:dateTime)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
  }
  ORDER BY ?date
  LIMIT ${CALENDAR_LIMIT}`;
}

function normalizeResult(payload) {
  const bindings = payload?.results?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Niepoprawna odpowiedź kalendarza.");
  const unique = new Map();
  for (const binding of bindings) {
    const date = binding.date?.value?.slice(0, 10);
    const title = binding.filmLabel?.value?.trim();
    const url = binding.film?.value?.replace(/^http:\/\//, "https://");
    if (!validDate(date) || !title || !/^https:\/\/www\.wikidata\.org\/entity\//.test(url || "")) continue;
    const id = `${date}:${url}`;
    unique.set(id, { id, date, title, sourceUrl: url });
  }
  return [...unique.values()].slice(0, CALENDAR_LIMIT);
}

async function loadReleaseCalendar(readJson, from, to) {
  const today = new Date();
  const start = from || isoDate(today);
  const endDate = new Date(`${start}T12:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 120);
  const end = to || isoDate(endDate);
  if (!validDate(start) || !validDate(end) || start > end) throw new Error("Niepoprawny zakres kalendarza.");
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(buildQuery(start, end))}`;
  const payload = await readJson(url);
  return { items: normalizeResult(payload), from: start, to: end, checkedAt: new Date().toISOString() };
}

module.exports = { loadReleaseCalendar, normalizeResult };
