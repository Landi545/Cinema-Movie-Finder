// Sprawdzamy spakowany proces C++, izolację Electron i komunikację IPC.
const { _electron: electron } = require('@playwright/test');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../dist/CinemaMovieFinder-win32-x64');
  const backend = path.join(root, 'resources/backend/cinema_movie_finder.exe');
  execFileSync(backend, ['--self-test'], { cwd: path.dirname(backend), stdio: 'inherit' });
  const result = spawnSync(backend, ['--gui'], {
    cwd: path.dirname(backend), encoding: 'utf8',
    input: '{"command":"search","city":"Łódź","date":"2027-02-29"}\n'
  });
  assert.equal(result.status, 0);
  assert.match(JSON.parse(result.stdout).error, /poprawną datę/);
  const app = await electron.launch({ executablePath: path.join(root, 'CinemaMovieFinder.exe') });
  try {
    const window = await app.firstWindow();
    await window.getByRole('button', { name: 'Łódź', exact: true }).click();
    assert.equal(await window.locator('#chosen-city').textContent(), 'Łódź');
    assert.equal(await window.evaluate(() => typeof window.cinema.search), 'function');
    assert.equal(await window.evaluate(() => typeof window.require), 'undefined');
    const message = await window.evaluate(async () => {
      try { await window.cinema.detail(0); return 'unexpected success'; }
      catch (error) { return error.message; }
    });
    assert.match(message, /Wybierz seans ponownie/);
    console.log('Packaged Electron smoke test passed.');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
