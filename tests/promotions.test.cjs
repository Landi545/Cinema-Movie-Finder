const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPromotions } = require('../desktop/promotions.cjs');
test('source failure is reported, not presented as a verified catalogue', async () => {
  const result = await loadPromotions(async () => { throw Error('offline'); });
  assert.equal(result.checked, 0);
  assert.equal(result.fresh, false);
  assert.equal(result.promotions.length, 5);
});
test('Helios price comes from source text; challenge pages do not pass verification', async () => {
  const result = await loadPromotions(async url => url.includes('kup-bilet-wczesniej')
    ? '<p>wtorkowymi seansami w cenie 21,90 zł</p>' : '<h1>Verify you are human</h1>');
  assert.equal(result.checked, 1);
  assert.equal(result.promotions.find(p => p.id === 'helios-super-tuesday').ticketPrice, 21.9);
  assert.equal(result.fresh, false);
});
