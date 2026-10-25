// Katalog jest odświeżany bezpośrednio z oficjalnych stron, bez zależności od publikacji na GitHubie.
const defaults = require('./ui/promotions.json');
// Cache jest wyłącznie awaryjnym fallbackiem. Nie utrzymujemy starego katalogu
// przez tygodnie bez ponownej próby pobrania źródeł.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function readCache(cache) {
  if (!cache?.read) return null;
  try {
    const value = await cache.read();
    return Array.isArray(value.promotions) && value.promotions.length ? value : null;
  } catch {
    return null;
  }
}

async function writeCache(cache, value) {
  if (!cache?.write) return;
  try {
    await cache.write({ savedAt: new Date().toISOString(), promotions: value.promotions });
  } catch {
    // Cache jest opcjonalny i nie może zablokować wyświetlenia ofert.
  }
}

async function loadPromotions(readText, cache) {
  const cached = await readCache(cache);
  const cachedAt = cached?.savedAt ? Date.parse(cached.savedAt) : NaN;
  const cacheAge = Date.now() - cachedAt;
  const cacheIsRecent = Number.isFinite(cachedAt) && cacheAge >= 0 && cacheAge <= CACHE_MAX_AGE_MS;
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
    if (Array.isArray(p.verification) && p.verification.length) {
      valid = p.verification.every(rule => {
        try {
          return typeof rule.pattern === 'string' && new RegExp(rule.pattern, rule.flags || 'i').test(source);
        } catch {
          return false;
        }
      });
    } else if (p.id === 'helios-super-tuesday') {
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
  const result = { promotions, fresh: checked === promotions.length, checked, total: promotions.length, cached: false };
  if (checked > 0) await writeCache(cache, result);
  if (checked === 0 && cached && cacheIsRecent) {
    const cachedById = new Map(cached.promotions.map(promotion => [promotion.id, promotion]));
    return {
      promotions: defaults.map(promotion => cachedById.get(promotion.id) || promotion),
      fresh: false,
      checked: 0,
      total: defaults.length,
      cached: true,
      cachedAt: cached.savedAt,
      stale: false,
    };
  }
  if (checked === 0 && cached && !cacheIsRecent) {
    // Stary katalog nie powinien udawać aktualnych informacji po długiej awarii.
    return { promotions: defaults, fresh: false, checked: 0, total: defaults.length,
      cached: false, stale: true, cachedAt: cached.savedAt };
  }
  return result;
}
module.exports = { loadPromotions };
