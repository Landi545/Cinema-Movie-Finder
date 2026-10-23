const test = require('node:test');
const assert = require('node:assert/strict');
const { createPriceService, multikinoStandard, heliosStandard } = require('../desktop/prices.cjs');
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
