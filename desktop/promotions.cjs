// Katalog jest odświeżany bezpośrednio z oficjalnych stron, bez zależności od publikacji na GitHubie.
const defaults = require('./ui/promotions.json');
async function loadPromotions(readText) {
  const urls = [...new Set(defaults.flatMap(p => p.links.map(link => link[1])))];
  const pages = new Map(await Promise.all(urls.map(async url => {
    try {
      const html = await readText(url);
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
      return [url, text];
    } catch { return [url, '']; }
  })));
  let checked = 0;
  const promotions = defaults.map(original => {
    const p = structuredClone(original);
    const texts = p.links.map(link => pages.get(link[1]) || '');
    const source = texts.join(' ');
    let valid = false;
    if (p.id === 'helios-super-tuesday') {
      const match = source.match(/wtorkowymi seansami w cenie\s+(\d+[,.]\d{2})\s*zł/i);
      if (match) { p.ticketPrice = Number(match[1].replace(',', '.')); p.price = `Bilety po ${match[1]} zł`; valid = true; }
    } else if (p.id === 'helios-advance') {
      valid = /4 dni/.test(source) && /11 zł mniej/.test(source) && /2 zł mniej/.test(source) && /7 zł mniej/.test(source);
    } else if (p.id === 'cinema-festival-2026') {
      valid = texts.some(text => /24\s*(?:i|–|-)\s*25 października/.test(text) && /15 zł/.test(text));
    } else if (p.id === 'cinema-city-wednesday') {
      valid = /Kinowa Środa/i.test(source) && /wyłącznie w środy/i.test(source);
    } else if (p.id === 'multikino-online') {
      valid = /Promo/.test(source) && /online/i.test(source);
    }
    p.sourceChecked = valid;
    if (valid) checked++;
    return p;
  });
  return { promotions, fresh: checked === promotions.length, checked, total: promotions.length };
}
module.exports = { loadPromotions };
