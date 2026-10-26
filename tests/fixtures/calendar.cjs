// Minimalny dokument źródła: prawdziwe nazwy pól, wyłącznie fikcyjne dane testowe.
function calendarPage(films = []) {
  return '<div class="premieresList">' + films.map(film =>
    '<div class="premieresList__dayRange" data-date="' + film.date + '">' +
    '<div class="previewFilm" data-film-id="' + (film.id || "1") + '">' +
    '<a class="preview__link" href="/film/Test-2026-' + (film.id || "1") + '">' + film.title + '</a>' +
    '<img class="poster__image" src="' + (film.bannerUrl || "") + '">' +
    '<div class="preview__duration">1h 40m</div>' +
    '<div class="preview__detail--genres"><h3><span>Komedia</span></h3></div>' +
    '<div class="preview__detail--director"><h3>Ala &amp; Jan</h3></div>' +
    '</div></div>',
  ).join("") + '</div>';
}
module.exports = { calendarPage };
