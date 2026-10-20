// Kontroler widoków z index.html; wywołania silnika przechodzą przez preload.cjs.
const $ = id => document.getElementById(id);
const stages = ['city', 'date', 'movies', 'screenings', 'detail'];
// Licznik generation odrzuca spóźnione odpowiedzi po anulowaniu lub zmianie kroku.
let city = '', date = '', rows = [], selected = null, generation = 0, currentStage = 'city';
const api = window.cinema;
// Lokalna data kalendarzowa zapobiega przesunięciu dnia podczas konwersji na UTC.
const localISO = day => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
const prettyDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
function show(stage) {
  currentStage = stage;
  for (const section of document.querySelectorAll('main > section')) section.hidden = section.id !== stage + '-panel';
  $('error').hidden = true;
  [...$('steps').children].forEach((step, index) => {
    if (index === stages.indexOf(stage)) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
    step.dataset.stage = stages[index];
    step.setAttribute('role', 'button');
    step.tabIndex = index < stages.indexOf(stage) ? 0 : -1;
    step.setAttribute('aria-disabled', index >= stages.indexOf(stage) ? 'true' : 'false');
  });
  $(stage + '-title')?.focus();
}
function error(message) {
  $('error').textContent = message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  $('error').hidden = false;
  $('status').textContent = 'Spróbuj ponownie';
}
function chooseCity(value) {
  city = value.trim().replace(/\s+/g, ' ');
  if (!city) return;
  $('city').value = city;
  $('chosen-city').textContent = city;
  $('footer-city').textContent = city;
  refreshDates();
  show('date');
}
function refreshDates() {
  const today = new Date(), tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  $('today-label').textContent = prettyDate(localISO(today));
  $('tomorrow-label').textContent = prettyDate(localISO(tomorrow));
  if (!$('date').value) $('date').value = localISO(today);
}
// Tekst ze stron kin wstawiamy przez textContent, aby nie został zinterpretowany jako HTML.
function choice(title, subtitle, action) {
  const button = document.createElement('button');
  button.className = 'choice';
  button.setAttribute('aria-label', subtitle ? `${title} ${subtitle}` : title);
  const label = document.createElement('strong');
  label.textContent = title;
  button.append(label);
  if (subtitle) { const sub = document.createElement('span'); sub.textContent = subtitle; button.append(sub); }
  button.addEventListener('click', action);
  return button;
}
// Grupujemy po movieKey, zachowując poszczególne seanse i odnośniki do biletów.
async function search(iso) {
  if (!api) { error('Uruchom aplikację ze skrótu Cinema Movie Finder.'); return; }
  date = iso;
  $('date').value = date;
  $('footer-date').textContent = prettyDate(date);
  $('status').textContent = 'Pobieranie repertuaru…';
  show('loading');
  const request = ++generation;
  try {
    const result = await api.search({ city, date });
    if (request !== generation) return;
    rows = result.screenings;
    const unavailable = result.unavailableSources || [];
    city = result.city;
    $('footer-city').textContent = city;
    $('search-label').textContent = `${city} / ${prettyDate(date)}`;
    const movies = new Map();
    for (const row of rows) if (!movies.has(row.movieKey)) movies.set(row.movieKey, row.title);
    $('movies').replaceChildren(...[...movies].map(([key, title]) => choice(title, '', () => selectMovie(key, title))));
    $('empty').hidden = rows.length > 0;
    $('empty').textContent = unavailable.length
      ? `Nie udało się pobrać pełnego repertuaru (${unavailable.join(', ')}). To nie oznacza braku seansów. Spróbuj ponownie lub sprawdź strony kin.`
      : 'Nie znaleziono seansów na ten dzień. Repertuar może jeszcze nie być opublikowany. Sprawdź inną datę lub strony kin.';
    let warning = $('source-warning');
    if (!warning) { warning = document.createElement('p'); warning.id = 'source-warning'; warning.className = 'hint'; $('movies').before(warning); }
    warning.hidden = !rows.length || !unavailable.length;
    warning.textContent = `Część źródeł jest niedostępna: ${unavailable.join(', ')}. Lista seansów może być niepełna.`;
    $('status').textContent = rows.length ? `Filmy: ${movies.size} / Seanse: ${rows.length}` : 'Brak seansów';
    if (!rows.length && unavailable.length) $('status').textContent = 'Problem z pobieraniem';
    show('movies');
  } catch (problem) { if (request === generation) { show('date'); error(problem.message); } }
}
function selectMovie(key, title) {
  $('screenings-title').textContent = title;
  $('screenings').replaceChildren(...rows.filter(row => row.movieKey === key).map(row => choice(row.time, row.cinema, () => selectScreening(row))));
  show('screenings');
}
// Szczegóły pokazujemy od razu, a brakujący adres pobieramy osobnym żądaniem.
async function selectScreening(row) {
  selected = row;
  $('detail-title').textContent = row.title;
  $('detail-time').textContent = `${prettyDate(date)}, ${row.time}`;
  $('detail-cinema').textContent = row.cinema;
  $('detail-address').textContent = row.address || 'Pobieranie adresu…';
  const filmweb = /^https?:\/\/([^/]+\.)?filmweb\.pl\//i.test(row.ticketUrl);
  $('ticket').textContent = filmweb ? 'Otwórz repertuar ↗' : 'Otwórz bilety ↗';
  $('ticket').hidden = !/^https?:\/\//i.test(row.ticketUrl);
  $('ticket-note').textContent = $('ticket').hidden ? 'Brak odnośnika do biletów.' : (filmweb ? 'Repertuar otworzy się w przeglądarce. Bezpośredni zakup może być niedostępny.' : 'Strona biletów otworzy się w Twojej przeglądarce.');
  show('detail');
  if (row.address) return;
  const request = ++generation;
  document.querySelectorAll('#detail-panel [data-back]').forEach(button => { button.disabled = true; });
  try {
    const detail = await api.detail(row.id);
    if (request === generation) $('detail-address').textContent = detail.address || 'Nie udało się pobrać adresu kina.';
  } catch { if (request === generation) $('detail-address').textContent = 'Nie udało się pobrać adresu kina. Sprawdź stronę repertuaru lub biletów.'; }
  finally { document.querySelectorAll('#detail-panel [data-back]').forEach(button => { button.disabled = false; }); }
}
$('city-form').addEventListener('submit', event => { event.preventDefault(); chooseCity($('city').value); });
for (const button of $('cities').children) button.addEventListener('click', () => chooseCity(button.textContent));
$('today').addEventListener('click', () => search(localISO(new Date())));
$('tomorrow').addEventListener('click', () => { const day = new Date(); day.setDate(day.getDate() + 1); search(localISO(day)); });
$('date-form').addEventListener('submit', event => { event.preventDefault(); search($('date').value); });
for (const [index, step] of [...$('steps').children].entries()) {
  step.dataset.stage = stages[index];
  step.setAttribute('role', 'button');
  step.tabIndex = -1;
  step.setAttribute('aria-disabled', 'true');
}
for (const step of $('steps').children) {
  step.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      step.click();
    }
  });
  step.addEventListener('click', () => {
    const target = step.dataset.stage;
    if (!target || stages.indexOf(target) >= stages.indexOf(currentStage)) return;
    ++generation;
    show(target);
    if (target === 'city') $('status').textContent = 'Gotowy do wyszukiwania';
  });
}
for (const button of document.querySelectorAll('[data-back]')) button.addEventListener('click', () => { show(button.dataset.back); if (button.dataset.back === 'city') $('status').textContent = 'Gotowy do wyszukiwania'; });
$('cancel').addEventListener('click', async () => { ++generation; await api.cancel(); show('date'); $('status').textContent = 'Anulowano pobieranie'; });
$('ticket').addEventListener('click', async () => { try { await api.openTicket(selected.ticketUrl); } catch { error('Nie udało się otworzyć strony biletów. Spróbuj ponownie.'); } });
$('quit').addEventListener('click', () => api.quit());
const promote = document.createElement('button');
promote.id = 'promote';
promote.className = 'promo-card';
promote.type = 'button';
promote.setAttribute('aria-label', 'Nagłośnij projekt na X');
promote.innerHTML = '<span class="x-logo" aria-hidden="true">𝕏</span><span><b>Nagłośnij projekt</b><small>Gotowy post na X</small></span><span class="promo-arrow" aria-hidden="true">↗</span>';
promote.addEventListener('click', async () => { try { await api.promote(); } catch { error('Nie udało się otworzyć gotowego posta na X.'); } });
document.querySelector('footer').insertBefore(promote, document.querySelector('.stamp'));
refreshDates();
