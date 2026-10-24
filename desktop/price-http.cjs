// Osobna anonimowa sesja Multikina; nie korzystamy z konta użytkownika ani nie zapisujemy tokenów.
function createPriceHttp(request = fetch) {
  let cookie = '', expires = 0, pending;
  async function guest() {
    if (cookie && Date.now() < expires) return;
    if (!pending) pending = (async () => {
      const r = await request('https://www.multikino.pl/api/microservice/auth/token', { method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw Error('Sesja kina niedostępna');
      cookie = r.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
      expires = Date.now() + 240000;
    })().finally(() => { pending = null; });
    await pending;
  }
  return async url => {
    const booking = url.startsWith('https://www.multikino.pl/api/microservice/booking/');
    // Jedno ponowienie odczytu przy chwilowej awarii; nie ponawiamy blokad 403/429.
    // Sesję anonimową odnawiamy tylko po 401, bez tworzenia koszyka ani rezerwacji.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (booking) await guest();
        const r = await request(url, { headers: booking ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(10000) });
        if (r.status === 401 && booking && attempt === 0) { expires = 0; continue; }
        if (!r.ok) {
          const error = new Error('Cena chwilowo niedostępna. Sprawdź ją na stronie kina.');
          error.status = r.status;
          error.host = new URL(url).hostname;
          error.retryable = r.status >= 500 && r.status <= 599;
          throw error;
        }
        const data = await r.json();
        if (!data || typeof data !== 'object') throw new SyntaxError('Niepoprawna odpowiedź kina');
        return data;
      } catch (error) {
        if (attempt || error.retryable === false || error instanceof SyntaxError) throw error;
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
  };
}
module.exports = { createPriceHttp };
