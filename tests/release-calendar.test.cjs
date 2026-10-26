const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeResult, loadReleaseCalendar, safeReleaseSource } = require("../desktop/release-calendar.cjs");
const { calendarPage } = require("./fixtures/calendar.cjs");

test("Polish releases are sorted and deduplicated by film, not by date", () => {
  const items = normalizeResult(calendarPage([
    { id: "1", title: "Digger", date: "2026-10-09", bannerUrl: "https://fwcdn.pl/fpo/film.webp" },
    { id: "2", title: "Ala &amp; Jan", date: "2026-10-02" },
    { id: "1", title: "Digger", date: "2026-10-10" },
  ]));
  assert.deepEqual(items.map(item => [item.id, item.date]), [["2", "2026-10-02"], ["1", "2026-10-09"]]);
  assert.equal(items[0].title, "Ala & Jan");
  assert.equal(items[1].bannerUrl, "https://fwcdn.pl/fpo/film.webp");
  assert.equal(items[1].metadata, "Komedia · 1h 40m");
  assert.equal(items[1].description, "Reżyseria: Ala & Jan");
  assert.equal(items[1].sourceUrl, "https://www.filmweb.pl/film/Test-2026-1");
});

test("unknown or broken page formats are errors, not empty calendars", () => {
  assert.throws(() => normalizeResult("<html>Service unavailable</html>"));
  assert.throws(() => normalizeResult({ results: [] }));
  assert.throws(() => normalizeResult(calendarPage([{ title: "Film", date: "2027-02-31" }])));
  assert.throws(() => normalizeResult(calendarPage([{ title: "", date: "2027-02-03" }])));
  assert.deepEqual(normalizeResult(calendarPage()), []);
});

test("missing or untrusted posters do not hide movies or become remote images", () => {
  const items = normalizeResult(calendarPage([
    { id: "1", title: "A", date: "2027-02-03" },
    { id: "2", title: "B", date: "2027-02-03", bannerUrl: "https://fwcdn.pl.evil.test/fpo/a.jpg" },
  ]));
  assert.equal(items.length, 2);
  assert.ok(items.every(item => item.bannerUrl === ""));
  assert.equal(safeReleaseSource("https://www.filmweb.pl/film/Test-2026-1"), true);
  // Kinowy zestaw odcinków może prowadzić do karty serialu, jak listopadowe „Skarpetki”.
  assert.equal(safeReleaseSource("https://www.filmweb.pl/serial/Test-2026-1"), true);
  for (const url of ["https://www.filmweb.pl.evil.test/film/Test-1", "javascript:alert(1)", "https://x@www.filmweb.pl/film/Test-1", "https://www.filmweb.pl/film/Test-1?redirect=evil"])
    assert.equal(safeReleaseSource(url), false);
});

test("every navigation fetches the selected month again, including year rollover", async () => {
  const requests = [];
  const read = async url => { requests.push(url); return calendarPage(); };
  await loadReleaseCalendar(read, "2026-12-01", "2026-12-31");
  await loadReleaseCalendar(read, "2027-01-01", "2027-01-31");
  await loadReleaseCalendar(read, "2026-12-01", "2026-12-31");
  assert.deepEqual(requests, [
    "https://www.filmweb.pl/premiere/2026/12",
    "https://www.filmweb.pl/premiere/2027/1",
    "https://www.filmweb.pl/premiere/2026/12",
  ]);
  await assert.rejects(loadReleaseCalendar(read, "2027-02-30", "2027-03-31"));
  assert.equal(requests.length, 3);
});

test("range filtering and deduplication work across fetched months", async () => {
  const result = await loadReleaseCalendar(async () => calendarPage([
    { id: "1", title: "A", date: "2026-12-01" },
    { id: "2", title: "B", date: "2026-12-30" },
    { id: "2", title: "B", date: "2027-01-02" },
    { id: "3", title: "C", date: "2027-01-03" },
  ]), "2026-12-10", "2027-01-02");
  assert.deepEqual(result.items.map(item => item.id), ["2"]);
  await assert.rejects(loadReleaseCalendar(async () => { throw new Error("Offline"); }, "2026-12-01", "2026-12-31"), /Offline/);
});

test("packaged calendar parser runs without external node_modules", () => {
  const { buildSync } = require("esbuild");
  const { runInNewContext } = require("node:vm");
  const bundle = buildSync({ entryPoints: [require.resolve("../desktop/release-calendar.cjs")],
    bundle: true, platform: "node", format: "cjs", target: "node22", write: false });
  const context = { module: { exports: {} }, URL };
  runInNewContext(bundle.outputFiles[0].text, context);
  const items = context.module.exports.normalizeResult(calendarPage([{ title: "Test", date: "2026-10-02" }]));
  assert.equal(items[0].title, "Test");
});
