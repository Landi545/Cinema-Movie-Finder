// Publiczne odczyty taryf: nie tworzymy zamówienia i nie blokujemy foteli.
const normalize = value => String(value || '').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
const money = value => Number.isFinite(value) && value >= 0;

function cinemaCityPrice(data, presentation) {
  if (!data?.ticketGroups || !presentation || presentation.isMemberSaleOnly || presentation.soldout) return null;
  const fee = data.serviceCharge;
  if (!fee || !money(fee.amountPerOrder) || fee.percentRatePerOrder !== 0) return null;
  const candidates = [];
  for (const group of Object.values(data.ticketGroups)) {
    for (const ticket of group.tickets || []) {
      // Pomijamy ulgi, kupony, bilety zależne od innych biletów i pakiety wieloosobowe.
      if (ticket.code || ticket.ref1prompt || ticket.ref2prompt || ticket.requiredTicketId ||
          ticket.membershipLoyaltyId || ticket.membershipLoyaltyTicketId || ticket.multiplyFactor !== 1 ||
          ticket.minQty > 1 || ticket.maxQty === 0 || !money(ticket.price) || !money(ticket.basePrice) ||
          !money(ticket.serviceCharge) || Math.abs(ticket.price - ticket.basePrice - ticket.serviceCharge) > 0.011 ||
          !/^(normalny|regular|standard|vip|normalny vip|swieto kina|cinema day)$/.test(normalize(ticket.name))) continue;
      const special = /vip|imax|4dx|screenx|premium/i.test(group.name || '');
      candidates.push({ ticket, group, special });
    }
  }
  // Gdy nie ma zwykłej strefy, korzystamy z taryfy VIP/innej sali tego samego seansu.
  candidates.sort((a, b) => Number(a.special) - Number(b.special) || a.ticket.price - b.ticket.price);
  if (!candidates.length) return null;
  const { ticket, group } = candidates[0];
  const formats = (presentation.featureAttributes || []).filter(value => /vip|imax|4dx|screenx/i.test(value));
  const groupLabel = /vip|imax|4dx|screenx|premium/i.test(group.name || '') ? group.name : '';
  const label = [...new Set([ticket.name, ...formats, groupLabel].filter(Boolean))].join(' · ');
  // Pole price JUŻ zawiera opłatę za bilet. Opłaty za zamówienie liczymy dla jednej osoby.
  return { price: Math.round((ticket.price + fee.amountPerOrder) * 100) / 100,
    basePrice: ticket.basePrice, priceSource: 'cinema-city',
    priceFrom: Object.values(group.seatModifiers || {}).some(value => Number(value) !== 0) ||
      candidates.some(item => item.ticket.price !== ticket.price),
    priceNote: `${label} · z opłatą online` };
}

async function resolveCinemaCity(row, city, date, get) {
  try {
    const url = new URL(row.ticketUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port) {
      const match = url.hostname === 'www.cinema-city.pl'
        ? url.pathname.match(/^\/pl\/booking-router\/launch\/\d+\/(\d+)$/)
        : url.hostname === 'tickets.cinema-city.pl' ? url.pathname.match(/^\/(?:api\/)?order\/(\d+)$/) : null;
      if (match) return match[1];
    }
  } catch {}
  // Fallback dla wierszy z Filmwebu: dokładne kino, tytuł, data i godzina.
  const base = 'https://www.cinema-city.pl/pl/data-api-service/v1/quickbook/10103/';
  const directory = await get(`${base}cinemas/with-event/until/${date}`);
  const name = normalize(row.cinema).replace(/^cinema city /, '');
  const venues = (directory.body?.cinemas || []).filter(venue => normalize(venue.displayName) === name);
  if (venues.length !== 1) return null;
  const data = (await get(`${base}film-events/in-cinema/${venues[0].id}/at-date/${date}`)).body;
  const films = new Set((data?.films || []).filter(film => normalize(film.name) === normalize(row.title)).map(film => film.id));
  const events = (data?.events || []).filter(event => films.has(event.filmId) &&
    event.eventDateTime?.slice(0, 10) === date && event.eventDateTime.slice(11, 16) === row.time && !event.soldOut);
  return events.length === 1 && /^\d+$/.test(events[0].id) ? events[0].id : null;
}
module.exports = { cinemaCityPrice, resolveCinemaCity };
