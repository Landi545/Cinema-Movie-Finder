// Test integracyjny z rzeczywistymi źródłami, oddzielony od powtarzalnych testów CI.
// Przykład: node scripts/live-smoke.cjs sciezka/do/cinema_movie_finder.exe Szczecin 2026-10-19 Helios Multikino Pionier
const { Backend } = require('../desktop/bridge.cjs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = process.argv[4] || `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const city = process.argv[3] || 'Szczecin';
  const backend = new Backend(path.resolve(process.argv[2] || 'package/windows/payload/Cinema Movie Finder Files/cinema_movie_finder.exe'));
  try {
    const result = await backend.request({ command: 'search', city, date });
    assert.ok(result.screenings.length > 0, `No live screenings: ${JSON.stringify(result)}`);
    assert.ok(result.screenings.every(row => row.title && /^\d{2}:\d{2}$/.test(row.time) && row.cinema));
    for (const expected of process.argv.slice(5)) {
      assert.ok(result.screenings.some(row => row.cinema.includes(expected)),
        `Missing cinema/source ${expected}: ${JSON.stringify(result.unavailableSources)}`);
    }
    const detail = await backend.request({ command: 'detail', id: result.screenings[0].id });
    assert.equal(typeof detail.address, 'string');
    console.log(JSON.stringify({ city: result.city, date, screenings: result.screenings.length,
      movies: new Set(result.screenings.map(row => row.movieKey)).size,
      cinemas: [...new Set(result.screenings.map(row => row.cinema))],
      unavailableSources: result.unavailableSources, sample: result.screenings[0], detail }, null, 2));
  } finally { backend.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
