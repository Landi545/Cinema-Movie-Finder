const test = require('node:test');
const assert = require('node:assert/strict');
const { createPriceService, multikinoStandard, multikinoPrice, heliosStandard } = require('../desktop/prices.cjs');
test('Multikino falls back from missing Standard to Lux and then other public zones', () => {
  const ticket = (name, priceInCents = 3490, extra = {}) => ({ name, priceInCents, feePriceInCents: 300, ...extra });
  const data = tickets => ({ result: [{ isDefaultTicketGroup: true, tickets }] });
  const lux = ticket('bilet strefa Lux');
  assert.equal(multikinoPrice(data([lux])).price, 37.9);
  assert.match(multikinoPrice(data([lux])).priceNote, /Lux/);
  assert.match(multikinoPrice(data([lux, ticket('bilet strefa Standard')])).priceNote, /Standard/);
  assert.match(multikinoPrice(data([ticket('bilet strefa Ultra Lux'), lux])).priceNote, /strefa Lux/);
  assert.match(multikinoPrice(data([ticket('bilet strefa Ultra Lux')])).priceNote, /Ultra Lux/);
  assert.match(multikinoPrice(data([ticket('bilet strefa Lux Promo')])).priceNote, /Lux Promo/);
  assert.equal(multikinoPrice(data([ticket('Kupon Lux'), ticket('bilet strefa Lux', 100, { isPackage: true }),
    ticket('bilet strefa VIP', 100, { isApplicable: false })])), null);
});
test('Multikino uses Standard and adds the online fee, never Promo or VIP', () => {
  const data = { result: [{ isDefaultTicketGroup: true, tickets: [
    { name: 'bilet strefa Promo', priceInCents: 1500, feePriceInCents: 300 },
    { name: 'bilet strefa Standard', priceInCents: 3190, feePriceInCents: 300 },
    { name: 'bilet strefa VIP', priceInCents: 4000, feePriceInCents: 300 }
  ] }] };
  assert.equal(multikinoStandard(data).price, 34.9);
  assert.equal(multikinoStandard({ result: [{ isDefaultTicketGroup: true, tickets: [data.result[0].tickets[0]] }] }), null);
});
test('Helios includes mandatory fees without applying the same discount twice', () => {
  assert.equal(heliosStandard([{ name: 'Wtorek', price: 19.9, priceWithMandatoryExtraFees: 21.4 }]).price, 21.4);
  assert.equal(heliosStandard([{ name: 'Kupon', priceWithMandatoryExtraFees: 10 }]), null);
});
for (const feature of ['IMAX', 'Dream', 'VIP', '']) {
  test(`Helios reads the actual session tariff for ${feature || 'ordinary'} screens`, async () => {
    const service = createPriceService(async url => {
      if (url.endsWith('/screening/session')) return { screenId: 'screen', printType: '2D' };
      if (url.endsWith('/screen/screen')) return { feature, defaultSeatGroupName: 'Standardowy',
        seats: [{ id: 'seat', kind: '0', symbol: '1', groupId: null }] };
      if (url.endsWith('/tickets?seatIds=seat')) return [{ name: 'Święto kina ' + feature, price: 15, priceWithMandatoryExtraFees: 16.5 }];
      throw Error('Unexpected request');
    });
    const [price] = await service.prices([{ id: 1, cinema: 'Helios Outlet Park',
      ticketUrl: 'https://bilety.helios.pl/screen/session?cinemaId=cinema' }], 'Szczecin', '2026-10-25');
    assert.equal(price.price, 16.5);
    assert.equal(price.priceStatus, 'available');
    if (feature) assert.ok(price.priceNote.includes(feature));
  });
}
test('Helios tries a named single-seat zone when default seats have no tariff, never a sofa', async () => {
  const requested = [];
  const service = createPriceService(async url => {
    if (url.endsWith('/screening/session')) return { screenId: 'screen' };
    if (url.endsWith('/screen/screen')) return {
      groups: [{ id: 'sofa', name: 'VIP Sofa', type: 'couch' }, { id: 'premium', name: 'Premium', type: 'seat' }],
      seats: [{ id: 'ordinary', kind: 0, symbol: '1' },
        { id: 'sofa', kind: 0, symbol: '2', groupId: 'sofa' },
        { id: 'premium', kind: 0, symbol: '3', groupId: 'premium' }] };
    requested.push(url);
    return url.endsWith('=ordinary') ? [] : [{ name: 'Normalny', priceWithMandatoryExtraFees: 30 }];
  });
  const [price] = await service.prices([{ id: 1, cinema: 'Helios',
    ticketUrl: 'https://bilety.helios.pl/screen/session?cinemaId=cinema' }], '', '2026-10-25');
  assert.equal(price.price, 30);
  assert.match(price.priceNote, /Premium/);
  assert.equal(requested.length, 2);
  assert.ok(!requested.some(url => url.endsWith('=sofa')));
});
test('matching Filmweb screening gets an official booking URL and a Standard price', async () => {
  const service = createPriceService(async url => {
    if (url.endsWith('/cinemas')) return { result: [{ cinemas: [{ cinemaName: 'Szczecin', cinemaId: '0007' }] }] };
    if (url.includes('/films?')) return { result: [{ filmTitle: 'Lalka', showingGroups: [{ sessions: [{ startTime: '2026-10-27T11:45:00', bookingUrl: '/rezerwacja-biletow/podsumowanie/0007/HO1/123' }] }] }] };
    if (url.endsWith('/tickets')) return { result: [{ isDefaultTicketGroup: true, tickets: [{ name: 'bilet strefa Standard', priceInCents: 3190, feePriceInCents: 300 }] }] };
    throw Error('Unexpected request');
  });
  const rows = await service.prices([{ id: 1, cinema: 'Multikino Szczecin', title: 'Lalka', time: '11:45', ticketUrl: 'https://www.filmweb.pl/showtimes/test' }], 'Szczecin', '2026-10-27');
  assert.equal(rows[0].price, 34.9);
  assert.equal(rows[0].ticketUrl, 'https://www.multikino.pl/rezerwacja-biletow/podsumowanie/0007/HO1/123');
});
test('ambiguous simultaneous sessions are not guessed; failure does not invent a price', async () => {
  const service = createPriceService(async url => {
    if (url.endsWith('/cinemas')) return { result: [{ cinemas: [{ cinemaName: 'Szczecin', cinemaId: '0007' }] }] };
    return { result: [{ filmTitle: 'Lalka', showingGroups: [{ sessions: [1,2].map(i => ({ startTime: '2026-10-27T11:45:00', bookingUrl: '/rezerwacja-biletow/podsumowanie/0007/HO1/' + i })) }] }] };
  });
  const [result] = await service.prices([{ id: 1, cinema: 'Multikino Szczecin', title: 'Lalka', time: '11:45' }], 'Szczecin', '2026-10-27');
  assert.equal(result.price, undefined);
  assert.equal(result.ticketUrl, undefined);
});

test('Helios outage remains a clear unavailable price, not an application error', async () => {
  const service = createPriceService(async () => { throw Object.assign(new Error('HTTP 500'), { status: 500 }); });
  const [result] = await service.prices([{ id: 1, cinema: 'Helios Outlet Park', title: 'Film', time: '18:30', ticketUrl: 'https://www.filmweb.pl/showtimes/test' }], 'Szczecin', '2026-10-25');
  assert.equal(result.priceStatus, 'unavailable');
  assert.match(result.priceNote, /Helios chwilowo nie udostępnia taryfy/);
});
