// Odczyt cen nie tworzy koszyka, rezerwacji ani nie blokuje fotela.
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
const money = value => Number.isFinite(value) && value >= 0;
function multikinoStandard(data) {
  const tickets = (data.result || []).filter(g => g.isDefaultTicketGroup && g.isApplicable !== false)
    .flatMap(g => g.tickets || []).filter(t => t.isApplicable !== false && !t.isPackage && /\bstandard\b/i.test(t.name) && money(t.priceInCents) && money(t.feePriceInCents));
  if (!tickets.length) return null;
  const amounts = [...new Set(tickets.map(t => t.priceInCents + t.feePriceInCents))];
  if (amounts.length !== 1) return null;
  return { price: amounts[0] / 100, basePrice: tickets[0].priceInCents / 100, priceNote: 'Standard · z opłatą online', priceSource: 'multikino' };
}
function heliosStandard(tickets) {
  if (!Array.isArray(tickets)) return null;
  // Bilety z kuponem, kartą i ulgi nie są ceną zwykłego biletu.
  const available = tickets.filter(t => !/ulg|senior|student|dziec|rodzin|karta|kupon|voucher|kod|grup/i.test(t.name || '') && !t.flgUnlimited && money(t.priceWithMandatoryExtraFees));
  const regular = available.filter(t => /normal|standard|wtorek|wczes|przedsprzedaz|bilet|swi[eę]to/i.test(normalize(t.name)));
  const choices = regular.length ? regular : available.length === 1 ? available : [];
  if (!choices.length || new Set(choices.map(t => t.priceWithMandatoryExtraFees)).size !== 1) return null;
  return { price: choices[0].priceWithMandatoryExtraFees, basePrice: choices[0].price, priceNote: 'Zwykłe miejsce · z opłatą online', priceSource: 'helios' };
}
function officialUrl(value, host, pattern) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password && !u.port && pattern.test(u.pathname) ? u : null; } catch { return null; }
}
function createPriceService(request) {
  const cache = new Map();
  function get(url) {
    const previous = cache.get(url);
    if (previous && Date.now() - previous.time < 120000) return previous.promise;
    const promise = request(url).catch(error => { cache.delete(url); throw error; });
    cache.set(url, { time: Date.now(), promise });
    return promise;
  }
  async function resolveMultikino(row, city, date) {
    const direct = officialUrl(row.ticketUrl, 'www.multikino.pl', /^\/rezerwacja-biletow\/podsumowanie\/\w+\/\w+\/\w+$/);
    if (direct) return direct.href;
    const directory = await get('https://www.multikino.pl/api/microservice/showings/cinemas');
    const venues = (directory.result || []).flatMap(g => g.cinemas || []).filter(c => normalize('Multikino ' + c.cinemaName) === normalize(row.cinema));
    if (venues.length !== 1) return null;
    const venue = venues[0];
    const films = await get(`https://www.multikino.pl/api/microservice/showings/cinemas/${encodeURIComponent(venue.cinemaId)}/films?showingDate=${date}T00:00:00&minEmbargoLevel=3&includesSession=true&includeSessionAttributes=true`);
    const matches = (films.result || []).filter(f => normalize(f.filmTitle) === normalize(row.title))
      .flatMap(f => (f.showingGroups || []).flatMap(g => g.sessions || []))
      .filter(s => s.startTime?.slice(0, 10) === date && s.startTime.slice(11, 16) === row.time && s.isBookingAvailable !== false);
    if (matches.length !== 1) return null;
    const url = new URL(matches[0].bookingUrl, 'https://www.multikino.pl').href;
    return officialUrl(url, 'www.multikino.pl', /^\/rezerwacja-biletow\/podsumowanie\/\w+\/\w+\/\w+$/)?.href || null;
  }
  async function resolveHelios(row, city, date) {
    const direct = officialUrl(row.ticketUrl, 'bilety.helios.pl', /^\/screen\/[\w-]+$/);
    if (direct) return direct.href;
    const directory = await get('https://api.helios.pl/api/v1/cinemas');
    const name = value => normalize(value).replace(normalize(city), '').trim();
    const venues = (directory.data || []).filter(c => normalize(c.location?.city) === normalize(city) && name(c.header) === name(row.cinema));
    if (venues.length !== 1) return null;
    const data = (await get(`https://api.helios.pl/api/v1/cinemas/${venues[0].id}/screenings`)).data;
    const matches = [];
    for (const [key, group] of Object.entries(data?.screenings?.[date] || {})) {
      const movie = data.movies?.[key] || data.events?.[key];
      for (const s of group.screenings || []) {
        const title = movie?.title || movie?.name || s.screeningMovies?.[0]?.movie?.title || s.screeningMovies?.[0]?.movie?.name;
        if (normalize(title) === normalize(row.title) && s.timeFrom?.slice(0,10) === date && s.timeFrom.slice(11,16) === row.time)
          matches.push(s);
      }
    }
    if (matches.length !== 1 || !matches[0].sourceId || !matches[0].cinemaSourceId) return null;
    return `https://bilety.helios.pl/screen/${encodeURIComponent(matches[0].sourceId)}?cinemaId=${encodeURIComponent(matches[0].cinemaSourceId)}`;
  }
  async function priceRow(row, city, date) {
    const result = { id: row.id, priceChecked: true };
    try {
      if (/multikino/i.test(row.cinema)) {
        const url = await resolveMultikino(row, city, date);
        if (!url) return result;
        result.ticketUrl = url;
        const parts = new URL(url).pathname.split('/');
        const data = await get(`https://www.multikino.pl/api/microservice/booking/Session/${parts[3]}/${parts[5]}/tickets`);
        Object.assign(result, multikinoStandard(data));
      } else if (/helios/i.test(row.cinema)) {
        const url = await resolveHelios(row, city, date);
        if (!url) return result;
        result.ticketUrl = url;
        const parsed = new URL(url), cinema = parsed.searchParams.get('cinemaId'), session = parsed.pathname.split('/').pop();
        if (!/^[\w-]+$/.test(cinema || '') || !/^[\w-]+$/.test(session)) return result;
        const base = `https://restapi.helios.pl/api/cinema/${cinema}`;
        const screening = await get(`${base}/screening/${session}`);
        if (!/^[\w-]+$/.test(screening.screenId || '')) return result;
        const screen = await get(`${base}/screen/${screening.screenId}`);
        if (!/standard/i.test(screen.defaultSeatGroupName || '') || /dream|vip|imax/i.test(screen.feature || '')) return result;
        const seat = screen.seats?.find(s => s.kind === '0' && !s.groupId && !s.wheelchairSeat && s.symbol && /^[\w-]+$/.test(s.id));
        if (!seat) return result;
        const tickets = await get(`${base}/screening/${session}/tickets?seatIds=${seat.id}`);
        Object.assign(result, heliosStandard(tickets));
      }
    } catch { /* Awaria jednego źródła nie blokuje pozostałych cen ani oficjalnego odnośnika. */ }
    return result;
  }
  async function prices(rows, city, date) {
    // Ograniczona równoległość chroni źródła; wynik dotyczy wyłącznie wybranego filmu.
    const output = new Array(rows.length);
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (index < rows.length) { const i = index++; output[i] = await priceRow(rows[i], city, date); }
    }));
    return output;
  }
  return { prices };
}
module.exports = { createPriceService, multikinoStandard, heliosStandard };
