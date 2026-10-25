const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPromotions } = require('../desktop/promotions.cjs');
test('source failure is reported, not presented as a verified catalogue', async () => {
  const result = await loadPromotions(async () => { throw Error('offline'); });
  assert.equal(result.checked, 0);
  assert.equal(result.fresh, false);
  assert.equal(result.promotions.length, 5);
});
test('does not present an old local promotion cache as current information', async () => {
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const result = await loadPromotions(async () => { throw Error('offline'); }, {
    read: async () => ({ savedAt: old, promotions: [{ id: 'old', title: 'Stara oferta' }] }),
  });
  assert.equal(result.stale, true);
  assert.equal(result.cached, false);
  assert.notEqual(result.promotions[0].title, 'Stara oferta');
});
test('local promotion cache expires after one day', async () => {
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const result = await loadPromotions(async () => { throw Error('offline'); }, {
    read: async () => ({ savedAt: old, promotions: [{ id: 'old', title: 'Stara oferta' }] }),
  });
  assert.equal(result.stale, true);
  assert.equal(result.cached, false);
});
test('Helios price comes from source text; challenge pages do not pass verification', async () => {
  const result = await loadPromotions(async url => url.includes('kup-bilet-wczesniej')
    ? '<p>wtorkowymi seansami w cenie 21,90 zł</p>' : '<h1>Verify you are human</h1>');
  assert.equal(result.checked, 1);
  assert.equal(result.promotions.find(p => p.id === 'helios-super-tuesday').ticketPrice, 21.9);
  assert.equal(result.fresh, false);
});
