// Odczyt cen nie tworzy koszyka, rezerwacji ani nie blokuje fotela.
const { cinemaCityPrice, resolveCinemaCity } = require('./cinema-city-prices.cjs');
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
const money = value => Number.isFinite(value) && value >= 0;
function multikinoStandard(data) {
  const tickets = (data.result || []).filter(g => g.isDefaultTicketGroup && g.isApplicable !== false)
    .flatMap(g => g.tickets || []).filter(t => t.isApplicable !== false && !t.isPackage && /\bstandard\b/i.test(t.name) && money(t.priceInCents) && money(t.feePriceInCents));
  if (!tickets.length) return null;
  const amounts = [...new Set(tickets.map(t => t.priceInCents + t.feePriceInCents))].sort((a, b) => a - b);
  if (!amounts.length) return null;
  return {
    price: amounts[0] / 100,
    basePrice: tickets.find(t => t.priceInCents + t.feePriceInCents === amounts[0]).priceInCents / 100,
    priceFrom: amounts.length > 1,
    priceNote: amounts.length > 1 ? 'Standard · najniższa cena online' : 'Standard · z opłatą online',
    priceSource: 'multikino',
  };
}
function heliosStandard(tickets) {
  if (!Array.isArray(tickets)) return null;
  // Bilety z kuponem, kartą i ulgi nie są ceną zwykłego biletu.
  const available = tickets.filter(t => !/ulg|senior|student|dziec|rodzin|karta|kupon|voucher|kod|grup/i.test(t.name || '') && !t.flgUnlimited && money(t.priceWithMandatoryExtraFees));
  const regular = available.filter(t => /normal|standard|wtorek|wczes|przedsprzedaz|bilet|swi[eę]to/i.test(normalize(t.name)));
  const choices = regular.length ? regular : available.length === 1 ? available : [];
  if (!choices.length) return null;
  const sorted = [...choices].sort((a, b) => a.priceWithMandatoryExtraFees - b.priceWithMandatoryExtraFees);
  return {
    price: sorted[0].priceWithMandatoryExtraFees,
    basePrice: sorted[0].price,
    priceFrom: new Set(choices.map(t => t.priceWithMandatoryExtraFees)).size > 1,
    priceNote: new Set(choices.map(t => t.priceWithMandatoryExtraFees)).size > 1
      ? 'Zwykłe miejsce · najniższa cena online'
      : 'Zwykłe miejsce · z opłatą online',
    priceSource: 'helios',
  };
}
function multikinoPrice(data) {
  const standard = multikinoStandard(data);
  if (standard) return standard;
  // Kina z fotelami Lux nie mają taryfy o nazwie Standard. Korzystamy wyłącznie
  // z publicznej grupy biletów danego seansu, bez pakietów, kart i rezerwacji.
  const zones = ['lux', 'ultra lux', 'premium', 'vip', 'promo', 'super promo',
    'lux promo', 'lux super promo', 'vip promo', 'vip super promo'];
  const candidates = (data.result || []).filter(group => group.isDefaultTicketGroup &&
    group.isApplicable !== false && !group.isReservationGroup)
    .flatMap(group => group.tickets || []).filter(ticket => ticket.isApplicable !== false &&
      !ticket.isPackage && !ticket.cardNumber && money(ticket.priceInCents) && money(ticket.feePriceInCents))
    .map(ticket => ({ ticket, zone: normalize(ticket.name).replace(/^bilet strefa /, '') }))
    .filter(item => zones.includes(item.zone));
  if (!candidates.length) return null;
  // Preferujemy zwykłą strefę Lux. Kolejne warianty są fallbackiem, nie domysłem ceny.
  candidates.sort((a, b) => zones.indexOf(a.zone) - zones.indexOf(b.zone) ||
    (a.ticket.priceInCents + a.ticket.feePriceInCents) - (b.ticket.priceInCents + b.ticket.feePriceInCents));
  const { ticket, zone } = candidates[0];
  const amounts = new Set(candidates.filter(item => item.zone === zone)
    .map(item => item.ticket.priceInCents + item.ticket.feePriceInCents));
  return { price: (ticket.priceInCents + ticket.feePriceInCents) / 100,
    basePrice: ticket.priceInCents / 100, priceFrom: amounts.size > 1,
    priceNote: `${ticket.name.replace(/^bilet\s+/i, '')} · z opłatą online`, priceSource: 'multikino' };
}
function officialUrl(value, host, pattern) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password && !u.port && pattern.test(u.pathname) ? u : null; } catch { return null; }
}
function createPriceService(request, reportFailure = () => {}) {
  const cache = new Map();
  function get(url) {
    const previous = cache.get(url);
    if (previous && Date.now() - previous.time < 120000) return previous.promise;
    // Ograniczamy pamięć podczas długiego przeglądania wielu miast i dat.
    for (const [key, entry] of cache) if (Date.now() - entry.time >= 120000) cache.delete(key);
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
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
    const result = { id: row.id, priceChecked: true, priceStatus: 'unavailable', priceNote: 'Nie udało się ustalić ceny online' };
    try {
      if (/cinema city/i.test(row.cinema)) {
        const id = await resolveCinemaCity(row, city, date, get);
        if (!id) return result;
        const base = `https://tickets.cinema-city.pl/api/presentations/${id}`;
        const [details, tariffs] = await Promise.all([get(base), get(`${base}/ticketGroups`)]);
        const presentation = details.presentation;
        if (presentation?.dateTime?.slice(0, 10) !== date ||
            (row.time && presentation.dateTime.slice(11, 16) !== row.time)) return result;
        const price = cinemaCityPrice(tariffs, presentation);
        if (price) Object.assign(result, price, { priceStatus: 'available',
          ticketUrl: `https://tickets.cinema-city.pl/api/order/${id}?lang=pl` });
      } else if (/multikino/i.test(row.cinema)) {
        const url = await resolveMultikino(row, city, date);
        if (!url) return result;
        result.ticketUrl = url;
        const parts = new URL(url).pathname.split('/');
        const data = await get(`https://www.multikino.pl/api/microservice/booking/Session/${parts[3]}/${parts[5]}/tickets`);
        const parsed = multikinoPrice(data);
        if (parsed) Object.assign(result, parsed, { priceStatus: 'available' });
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
        // Format sali nie unieważnia ceny: IMAX/DREAM mają własne taryfy seansu.
        // Najpierw sprawdzamy pojedynczy fotel domyślny, potem nazwane strefy.
        // Sofy i miejsca dla wózków nie są zamiennikiem pojedynczego biletu.
        const groups = new Map((screen.groups || []).map(group => [group.id, group]));
        const seats = (screen.seats || []).filter(seat => {
          const group = groups.get(seat.groupId);
          return String(seat.kind) === '0' && !seat.wheelchairSeat && seat.symbol && /^[\w-]+$/.test(seat.id) &&
            (!seat.groupId || (group && /standard|dream|vip|premium|komfort/i.test(group.name || '') &&
              !/couch|wheelchair|sofa/i.test(`${group.type} ${group.name}`)));
        }).sort((a, b) => Number(Boolean(a.groupId)) - Number(Boolean(b.groupId)));
        const checked = new Set();
        for (const seat of seats) {
          const groupKey = seat.groupId || 'default';
          if (checked.has(groupKey)) continue;
          checked.add(groupKey);
          if (checked.size > 4) break;
          const tickets = await get(`${base}/screening/${session}/tickets?seatIds=${seat.id}`);
          const price = heliosStandard(tickets);
          if (!price) continue;
          const groupName = seat.groupId ? groups.get(seat.groupId).name : screen.defaultSeatGroupName || 'Miejsce pojedyncze';
          const format = [screening.printType, screen.feature].filter(Boolean);
          const label = [...new Set([...format, groupName])].join(' · ');
          Object.assign(result, price, { priceStatus: 'available',
            priceNote: `${label} · ${price.priceFrom ? 'od, ' : ''}z opłatą online` });
          break;
        }
        if (result.priceStatus !== 'available') result.priceNote = 'Kino nie udostępniło ceny pojedynczego biletu';
      }
    } catch (error) {
      // Diagnostyka nie zawiera ciasteczek ani adresów sesji i nigdy nie blokuje wyniku.
      try { reportFailure({ source: /helios/i.test(row.cinema) ? 'Helios' : /cinema city/i.test(row.cinema) ? 'Cinema City' : 'Multikino',
        status: error.status || null, kind: error.name || 'Error',
        code: error.cause?.code || error.code || null }); } catch {}
      // Awaria sieci nie blokuje repertuaru; po chwili można ponowić odczyt ceny.
      result.priceRetryAt = Date.now() + 30000;
      result.priceNote = 'Cena chwilowo niedostępna · sprawdź na stronie kina';
    }
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
module.exports = { createPriceService, multikinoStandard, multikinoPrice, heliosStandard };
