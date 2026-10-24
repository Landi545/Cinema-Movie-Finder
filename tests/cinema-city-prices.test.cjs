// Taryfy testowe odzwierciedlają publiczne API, bez tworzenia zamówień.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cinemaCityPrice, resolveCinemaCity } = require('../desktop/cinema-city-prices.cjs');
const { createPriceService } = require('../desktop/prices.cjs');
const ticket = (extra = {}) => ({ name: 'Normalny', price: 38.1, basePrice: 35.9,
  serviceCharge: 2.2, multiplyFactor: 1, maxQty: 10, ...extra });
const data = (tickets, name = 'Miejsca dostępne') => ({ ticketGroups: { 1: { name, tickets } },
  serviceCharge: { amountPerOrder: 0, percentRatePerOrder: 0, amountPerTicket: 2.2 } });
test('Cinema City fee is included exactly once and restricted discounts are excluded', () => {
  const price = cinemaCityPrice(data([ticket(), ticket({ name: 'Ulgowy', price: 20 }),
    ticket({ code: 'BNP', price: 25 })]), {});
  assert.equal(price.price, 38.1);
  assert.equal(price.basePrice, 35.9);
  assert.equal(cinemaCityPrice(data([ticket({ multiplyFactor: 2 })]), {}), null);
  assert.equal(cinemaCityPrice(data([ticket()]), { isMemberSaleOnly: 1 }), null);
});
test('Cinema City accepts VIP-only tariffs and labels seat surcharges as from', () => {
  const tariffs = data([ticket({ price: 98.1, basePrice: 95.9 })], 'VIP');
  tariffs.ticketGroups[1].seatModifiers = { 2: 3 };
  const price = cinemaCityPrice(tariffs, { featureAttributes: ['VIP'] });
  assert.equal(price.price, 98.1);
  assert.equal(price.priceFrom, true);
  assert.match(price.priceNote, /VIP/);
});
test('Cinema City resolves official links and only reads presentation and tariffs', async () => {
  const calls = [];
  const service = createPriceService(async url => {
    calls.push(url);
    return url.endsWith('/ticketGroups') ? data([ticket()]) :
      { presentation: { dateTime: '2026-10-26 10:00:00', featureAttributes: [] } };
  });
  const [price] = await service.prices([{ id: 1, cinema: 'Cinema City Mokotów', time: '10:00',
    ticketUrl: 'https://www.cinema-city.pl/pl/booking-router/launch/1070/1768700?lang=pl' }], 'Warszawa', '2026-10-26');
  assert.equal(price.price, 38.1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes('/api/presentations/1768700')));
});
test('Filmweb fallback requires a unique matching cinema, film and time', async () => {
  const row = { cinema: 'Cinema City Warszawa - Mokotów', title: 'Lalka', time: '10:00' };
  const get = async url => url.includes('cinemas/') ? { body: { cinemas: [{ id: 1070, displayName: 'Warszawa - Mokotów' }] } } :
    { body: { films: [{ id: 'film', name: 'Lalka' }], events: [{ id: '1768700', filmId: 'film', eventDateTime: '2026-10-26T10:00:00' }] } };
  assert.equal(await resolveCinemaCity(row, 'Warszawa', '2026-10-26', get), '1768700');
  assert.equal(await resolveCinemaCity({ ...row, time: '11:00' }, 'Warszawa', '2026-10-26', get), null);
});
