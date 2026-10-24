// Testujemy awarie źródeł bez połączenia z prawdziwym systemem biletowym.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPriceHttp } = require('../desktop/price-http.cjs');
const response = (status, data = {}) => ({ status, ok: status === 200,
  json: async () => data, headers: { getSetCookie: () => ['guest=anonymous; Path=/'] } });

test('temporary server failure is retried once', async () => {
  let calls = 0;
  const get = createPriceHttp(async () => response(++calls === 1 ? 503 : 200, { price: 20 }));
  assert.deepEqual(await get('https://api.helios.pl/test'), { price: 20 });
  assert.equal(calls, 2);
});
test('blocking and rate limiting are not retried', async () => {
  for (const status of [403, 429]) {
    let calls = 0;
    const get = createPriceHttp(async () => { calls++; return response(status); });
    await assert.rejects(get('https://api.helios.pl/test'));
    assert.equal(calls, 1);
  }
});
test('expired booking session is renewed once', async () => {
  let sessions = 0, reads = 0;
  const get = createPriceHttp(async url => {
    if (url.endsWith('/token')) { sessions++; return response(200); }
    return response(++reads === 1 ? 401 : 200, { result: [] });
  });
  assert.deepEqual(await get('https://www.multikino.pl/api/microservice/booking/test'), { result: [] });
  assert.equal(sessions, 2);
  assert.equal(reads, 2);
});
test('invalid JSON shape is not cached as a valid response or retried', async () => {
  let calls = 0;
  const get = createPriceHttp(async () => { calls++; return response(200, null); });
  await assert.rejects(get('https://api.helios.pl/test'));
  assert.equal(calls, 1);
});
