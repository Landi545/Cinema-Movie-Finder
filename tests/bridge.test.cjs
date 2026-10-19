// Testy mostu i walidacji danych niezależne od aktualnego repertuaru kin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { Backend, validSearch, safeUrl } = require('../desktop/bridge.cjs');
function fixture() {
  let child;
  const backend = new Backend('C:/test/search.exe', () => {
    child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.killed = true; };
    return child;
  });
  return { backend, get child() { return child; } };
}
test('validates real calendar dates and Unicode city names', () => {
  assert.equal(validSearch({ city: 'Łódź', date: '2028-02-29' }), true);
  for (const input of [null, { city: ' ', date: '2026-10-18' }, { city: 'Łódź', date: '2026-02-29' }, { city: 'Łódź\nquit', date: '2026-10-18' }, { city: 'Łódź', date: '2026-13-01' }]) assert.equal(validSearch(input), false);
});
test('rejects executable links and credentials', () => {
  for (const url of ['file:///C:/Windows/system32/cmd.exe', 'javascript:alert(1)', 'https://user:pass@example.org', 'bad']) assert.equal(safeUrl(url), false);
  assert.equal(safeUrl('https://www.filmweb.pl/showtimes/Łódź'), true);
});
test('JSON pipes preserve split UTF-8 bytes', async () => {
  const f = fixture();
  const result = f.backend.request({ command: 'search', city: 'Łódź' });
  assert.match(f.child.stdin.read().toString(), /Łódź/);
  const bytes = Buffer.from(JSON.stringify({ title: 'Zażółć gęślą jaźń' }) + '\n');
  for (const byte of bytes) f.child.stdout.write(Buffer.from([byte]));
  assert.deepEqual(await result, { title: 'Zażółć gęślą jaźń' });
  f.backend.stop();
});
test('cancel kills work and a new request can recover', async () => {
  const f = fixture();
  const first = f.backend.request({ command: 'search' });
  const rejection = assert.rejects(first, /Anulowano/);
  const old = f.child;
  f.backend.stop();
  await rejection;
  assert.equal(old.killed, true);
  const next = f.backend.request({ command: 'search' });
  old.emit('exit', 1);
  f.child.stdout.write('{"screenings":[]}\n');
  assert.deepEqual(await next, { screenings: [] });
  f.backend.stop();
});
test('rejects concurrent requests and handles backend crash', async () => {
  const f = fixture();
  const first = f.backend.request({ command: 'search' });
  await assert.rejects(f.backend.request({ command: 'search' }), /Poczekaj/);
  const rejection = assert.rejects(first, /zamknięta/);
  f.child.emit('exit', 1);
  await rejection;
});
