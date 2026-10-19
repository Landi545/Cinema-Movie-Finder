import { registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const engine = registerPlugin('CinemaEngine');
let tickets = new Set();
let generation = 0;
const safeUrl = value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
};
async function request(input) {
  const { json } = await engine.request({ json: JSON.stringify(input) });
  const result = JSON.parse(json);
  if (result.error) throw new Error(result.error);
  return result;
}

// Telefon udostępnia ten sam kontrakt co preload Electron; widoki pozostają wspólne.
window.cinema = {
  async search(input) {
    const token = ++generation;
    tickets.clear();
    const result = await request({ command: 'search', ...input });
    if (token !== generation) throw new Error('Anulowano pobieranie.');
    tickets = new Set(result.screenings.map(row => row.ticketUrl).filter(safeUrl));
    return result;
  },
  detail: id => request({ command: 'detail', id }),
  async cancel() { ++generation; tickets.clear(); await engine.cancel(); },
  async openTicket(url) {
    if (!safeUrl(url) || !tickets.has(url)) throw new Error('Nieprawidłowy adres biletów.');
    await Browser.open({ url });
  },
  promote: () => Browser.open({ url: 'https://x.com/intent/post?text=' + encodeURIComponent('Cinema Movie Finder — znajdź seans w swoim mieście. https://github.com/Landi545/Cinema-Movie-Finder') }),
  quit: () => App.exitApp()
};
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('quit').hidden = true;
});
App.addListener('backButton', () => {
  const panel = document.querySelector('main > section:not([hidden])');
  const back = panel?.querySelector('[data-back], #cancel');
  if (back) back.click();
  else App.exitApp();
});
