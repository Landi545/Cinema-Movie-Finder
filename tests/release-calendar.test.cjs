const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeResult } = require("../desktop/release-calendar.cjs");

test("release calendar normalizes Wikidata rows and removes duplicate films", () => {
  const result = normalizeResult({
    results: { bindings: [
      { film: { value: "http://www.wikidata.org/entity/Q1" }, filmLabel: { value: "Film A" }, date: { value: "2026-11-01T00:00:00Z" } },
      { film: { value: "https://www.wikidata.org/entity/Q1" }, filmLabel: { value: "Film A" }, date: { value: "2026-11-01T00:00:00Z" } },
      { film: { value: "https://example.com/Q2" }, filmLabel: { value: "Niebezpieczny" }, date: { value: "2026-11-02T00:00:00Z" } },
    ] },
  });
  assert.deepEqual(result, [{ id: "2026-11-01:https://www.wikidata.org/entity/Q1", date: "2026-11-01", title: "Film A", sourceUrl: "https://www.wikidata.org/entity/Q1" }]);
});
