// Osobna anonimowa sesja Multikina; nie korzystamy z konta użytkownika ani nie zapisujemy tokenów.
function createPriceHttp() {
  let cookie = '', expires = 0, pending;
  async function guest() {
    if (cookie && Date.now() < expires) return;
    if (!pending) pending = (async () => {
      const r = await fetch('https://www.multikino.pl/api/microservice/auth/token', { method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw Error('Sesja kina niedostępna');
      cookie = r.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
      expires = Date.now() + 240000;
    })().finally(() => { pending = null; });
    await pending;
  }
  return async url => {
    const booking = url.startsWith('https://www.multikino.pl/api/microservice/booking/');
    if (booking) await guest();
    const r = await fetch(url, { headers: booking ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(10000) });
    if (!r.ok) { if (r.status === 401) expires = 0; throw Error('Cena niedostępna'); }
    return r.json();
  };
}
module.exports = { createPriceHttp };
