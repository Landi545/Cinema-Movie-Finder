// Kontroler widoków z index.html; wywołania silnika przechodzą przez preload.cjs.
const $ = (id) => document.getElementById(id);
const stages = ["city", "date", "movies", "screenings", "detail"];
// Licznik generation odrzuca spóźnione odpowiedzi po anulowaniu lub zmianie kroku.
let city = "",
  date = "",
  rows = [],
  selected = null,
  generation = 0,
  currentStage = "city";
let movieGroups = [];
let currentMovieKey = "";
const pendingPrices = new WeakMap();
let searchPending = false;
let connectionLost = false;
let cancellation = Promise.resolve();
let previousStage = "city";
let promotionsPending = false;
let lastPromotionsRefresh = 0;
const PROMOTIONS_REFRESH_INTERVAL = 15 * 60 * 1000;
let calendarPending = false;
let calendarMonth = new Date();
let calendarItems = [];
let previousPlanningStage = "city";
let activePromotionId = localStorage.getItem("activePromotionId") || "";
const api = window.cinema;
// Oferty mają jawne warunki i oficjalne źródła; nie wyliczamy ceny, której kino nie potwierdziło.
let promotions = [
  {
    "id": "cinema-festival-2026",
    "featured": true,
    "chain": "Helios · Multikino · Cinema City",
    "title": "Święto Kina",
    "price": "Bilety po 15 zł",
    "state": "24–25 października",
    "facts": [
      "Wszystkie trzy duże sieci w Polsce",
      "Seanse 24 i 25 października 2026",
      "Cinema City: także IMAX, 4DX i ScreenX"
    ],
    "note": "Wydarzenia specjalne są wyłączone. Przy zakupie online może zostać doliczona opłata serwisowa.",
    "networks": [
      "helios",
      "multikino",
      "cinema city"
    ],
    "start": "2026-10-24",
    "end": "2026-10-25",
    "links": [
      [
        "Multikino",
        "https://www.multikino.pl/newsy/swieto-kina-powraca-caly-weekend-z-filmami-za-15-zl"
      ],
      [
        "Helios",
        "https://helios.pl/zory/kino-helios/aktualnosci/swietokina-21934"
      ],
      [
        "Cinema City",
        "https://www.cinema-city.pl/static/pl/pl/blog/swieto-kina-2026-bilety-na-wszystkie-seanse-za-15-zlotych"
      ]
    ]
  },
  {
    "id": "helios-super-tuesday",
    "chain": "Helios",
    "title": "Superwtorek",
    "price": "Bilety po 19,90 zł",
    "state": "Każdy wtorek",
    "facts": [
      "Wtorkowe seanse w kinach Helios",
      "Cena biletu: 19,90 zł",
      "Oferta dotyczy regularnego repertuaru"
    ],
    "note": "Wybrane wydarzenia specjalne i dopłaty mogą nie być objęte ofertą. Cenę potwierdź podczas zakupu.",
    "networks": [
      "helios"
    ],
    "kind": "weekday",
    "weekday": 2,
    "links": [
      [
        "Warunki Heliosa",
        "https://helios.pl/katowice/kino-helios/aktualnosci/kup-bilet-wczesniej-i-oszczedzaj-33"
      ]
    ]
  },
  {
    "id": "helios-advance",
    "chain": "Helios",
    "title": "Wcześniej kupujesz, więcej zyskujesz",
    "price": "Nawet 11 zł mniej",
    "state": "Oferta stała",
    "facts": [
      "Kup bilet co najmniej dzień przed seansem",
      "Największa zniżka przy zakupie minimum 4 dni wcześniej",
      "Oferta obowiązuje poza Superwtorkiem"
    ],
    "note": "Obniżka zależy od terminu zakupu, nie od filmu. Nie obejmuje koncertów i projektów specjalnych; możliwe są dopłaty za sale Dream i okulary 3D.",
    "networks": [
      "helios"
    ],
    "kind": "general",
    "trackable": false,
    "links": [
      [
        "Warunki Heliosa",
        "https://helios.pl/katowice/kino-helios/aktualnosci/kup-bilet-wczesniej-i-oszczedzaj-33"
      ]
    ],
    "savings": [
      [
        "1 dzień wcześniej",
        "2 zł"
      ],
      [
        "2 dni wcześniej",
        "4 zł"
      ],
      [
        "3 dni wcześniej",
        "7 zł"
      ],
      [
        "4 dni lub więcej",
        "11 zł"
      ]
    ]
  },
  {
    "id": "cinema-city-wednesday",
    "chain": "Cinema City",
    "title": "Kinowa Środa",
    "price": "Tańsze bilety w środę",
    "state": "Każda środa",
    "facts": [
      "Cena według cennika wybranego kina",
      "Oferta obowiązuje wyłącznie w środy",
      "Z wyłączeniem świąt i dni ustawowo wolnych"
    ],
    "note": "Nie obowiązuje w święta. Wydarzenia specjalne mogą mieć inną cenę.",
    "networks": [
      "cinema city"
    ],
    "kind": "weekday",
    "weekday": 3,
    "links": [
      [
        "Warunki Cinema City",
        "https://www.cinema-city.pl/static/pl/pl/bilety-ulgowe"
      ]
    ]
  },
  {
    "id": "multikino-online",
    "chain": "Multikino",
    "title": "Kup online i zapłać mniej",
    "price": "Najtańsze miejsca w strefie Promo",
    "state": "Oferta stała",
    "facts": [
      "Zakup na stronie lub w aplikacji Multikina",
      "Cena zależy od kina i miejsca",
      "Pula miejsc Promo jest ograniczona"
    ],
    "note": "Oferta ogólna kina — aplikacja nie może przypisać jej do konkretnego filmu ani zagwarantować dostępności miejsca.",
    "networks": [
      "multikino"
    ],
    "kind": "general",
    "trackable": false,
    "links": [
      [
        "Warunki Multikina",
        "https://www.multikino.pl/newsy/kupuj-taniej-online"
      ]
    ]
  }
];
const pluralRules = new Intl.PluralRules("pl");
const counted = (count, one, few, many) =>
  `${count} ${{ one, few, many, other: many }[pluralRules.select(count)]}`;
// Wyszukiwanie tytułu toleruje brak polskich znaków, ale nie zmienia tekstu z kina.
const normalizeTitle = (value) =>
  value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .trim();
// Lokalna data kalendarzowa zapobiega przesunięciu dnia podczas konwersji na UTC.
const localISO = (day) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
const prettyDate = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
function show(stage) {
  currentStage = stage;
  for (const section of document.querySelectorAll("main > section"))
    section.hidden = section.id !== stage + "-panel";
  $("error").hidden = true;
  const activeIndex = stages.indexOf(stage === "loading" ? "date" : stage);
  [...$("steps").children].forEach((step, index) => {
    if (index === activeIndex) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    step.dataset.stage = stages[index];
    step.setAttribute("role", "button");
    step.tabIndex = index < stages.indexOf(stage) ? 0 : -1;
    step.setAttribute(
      "aria-disabled",
      index >= stages.indexOf(stage) ? "true" : "false",
    );
  });
  $(stage + "-title")?.focus();
}
function promotionById(id) {
  return promotions.find((promotion) => promotion.id === id && canTrackPromotion(promotion));
}
function canTrackPromotion(promotion) {
  const today = localISO(new Date());
  if (promotion.trackable === false || (promotion.end && promotion.end < today)) return false;
  if (promotion.id === "cinema-city-wednesday" && isHoliday(today)) return false;
  if (promotion.kind === "weekday" || promotion.kind === "wednesday")
    return new Date().getDay() === (promotion.weekday ?? 3);
  return Boolean(promotion.start && promotion.end);
}
function isHoliday(iso) {
  // Ruchome święta w Polsce wypadają w niedzielę, poniedziałek lub czwartek.
  return ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-24", "12-25", "12-26"].includes(iso.slice(5));
}
function cinemaNetwork(name) {
  const normalized = normalizeTitle(name);
  return (
    ["cinema city", "multikino", "helios"].find((network) =>
      normalized.includes(network),
    ) || ""
  );
}
function daysBetween(from, to) {
  return Math.round(
    (new Date(to + "T12:00:00") - new Date(from + "T12:00:00")) / 86400000,
  );
}
function promotionApplies(promotion, row, screeningDate = date, requireTrackingDay = true) {
  if (
    !promotion ||
    (requireTrackingDay && !canTrackPromotion(promotion)) ||
    !screeningDate ||
    !promotion.networks.includes(cinemaNetwork(row.cinema))
  )
    return false;
  if (promotion.start)
    return screeningDate >= promotion.start && screeningDate <= promotion.end;
  if (promotion.id === "cinema-city-wednesday" && isHoliday(screeningDate)) return false;
  if (promotion.kind === "wednesday" || promotion.kind === "weekday")
    return new Date(screeningDate + "T12:00:00").getDay() === (promotion.weekday ?? 3);
  if (promotion.kind === "advance") {
    const ahead = daysBetween(localISO(new Date()), screeningDate);
    return ahead >= 1 && ahead <= 4;
  }
  return promotion.kind === "online";
}
function addPromotionMatch(container, promotion) {
  const match = document.createElement("span");
  match.className = "promotion-match";
  match.textContent = `Ten film wchodzi w promocję: ${promotion.title}`;
  container.append(match);
}
function renderPromotions() {
  if (activePromotionId && !promotionById(activePromotionId)) clearPromotion(false);
  const cards = promotions.filter((p) => !p.end || p.end >= localISO(new Date())).map((promotion) => {
    const ended = promotion.end && promotion.end < localISO(new Date());
    const card = document.createElement("article");
    card.className = `promotion-card${promotion.featured ? " featured" : ""}${promotion.id === activePromotionId ? " selected" : ""}`;
    const top = document.createElement("div");
    top.className = "promotion-top";
    const chain = document.createElement("span");
    chain.className = "promotion-chain";
    chain.textContent = promotion.chain;
    const state = document.createElement("span");
    state.className = "promotion-state";
    state.textContent = ended ? "Oferta zakończona" : promotion.state;
    top.append(chain, state);
    const title = document.createElement("h3");
    title.textContent = promotion.title;
    const price = document.createElement("p");
    price.className = "promotion-price";
    price.textContent = promotion.price;
    const savings = document.createElement("dl");
    savings.className = "promotion-savings";
    if (promotion.savings) {
      savings.setAttribute("aria-label", "Oszczędność przy wcześniejszym zakupie");
      for (const [when, amount] of promotion.savings) {
        const step = document.createElement("div");
        const label = document.createElement("dt");
        label.textContent = when;
        const value = document.createElement("dd");
        value.textContent = `${amount} mniej`;
        step.append(label, value);
        savings.append(step);
      }
    }
    const facts = document.createElement("ul");
    facts.className = "promotion-facts";
    for (const fact of promotion.facts) {
      const item = document.createElement("li");
      item.textContent = fact;
      facts.append(item);
    }
    const note = document.createElement("p");
    note.className = "promotion-note";
    note.textContent = promotion.note;
    const actions = document.createElement("div");
    actions.className = "promotion-actions";
    const use = document.createElement("button");
    use.className = "promotion-use";
    use.type = "button";
    const trackable = promotion.trackable !== false;
    use.textContent = !trackable
      ? "Oferta ogólna kina"
      : ended
        ? "Oferta zakończona"
        : promotion.id === activePromotionId
          ? "✓ Zakończ śledzenie"
          : "Śledź tę promocję";
    if (trackable && !ended && !canTrackPromotion(promotion))
      use.textContent = promotion.weekday === 2 ? "Śledzenie tylko we wtorek" : "Śledzenie tylko w środę (poza świętami)";
    use.disabled = !canTrackPromotion(promotion);
    use.addEventListener("click", () =>
      promotion.id === activePromotionId ? clearPromotion() : usePromotion(promotion),
    );
    if (trackable) actions.append(use);
    else {
      const general = document.createElement("p");
      general.className = "promotion-general";
      general.textContent = "Oferta ogólna kina — nie wymaga śledzenia konkretnego filmu.";
      actions.append(general);
    }
    for (const [label, linkId] of promotion.links) {
      const link = document.createElement("button");
      link.className = "promotion-link";
      link.type = "button";
      link.textContent = `${label} ↗`;
      link.addEventListener("click", () =>
        api
          .openPromotion(linkId)
          .catch(() => error("Nie udało się otworzyć warunków promocji.")),
      );
      actions.append(link);
    }
    card.append(top, title, price);
    if (savings.children.length) card.append(savings);
    card.append(facts, note, actions);
    return card;
  });
  $("promotions").replaceChildren(...cards);
  const selectedPromotion = promotionById(activePromotionId);
  $("tracking-banner").hidden = !selectedPromotion;
  $("tracking-banner-text").textContent = selectedPromotion ? `★ Śledzisz: ${selectedPromotion.title}. Pasujące seanse wyróżniamy na złoto.` : "";
  $("active-promotion").hidden = !selectedPromotion;
  if (selectedPromotion)
    $("active-promotion").textContent =
      `★ Obecnie aktywowano śledzenie promocji „${selectedPromotion.title}”. Pasujące filmy i seanse mają złotą otoczkę.`;
  $("promotion-tracking-label").textContent = selectedPromotion
    ? `Śledzisz: ${selectedPromotion.title}`
    : "Sprawdź, gdzie zapłacisz mniej";
}
function validPromotionCatalog(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100) return false;
  return value.every(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.chain === "string" &&
      typeof item.price === "string" &&
      typeof item.state === "string" &&
      Array.isArray(item.facts) &&
      item.facts.every((fact) => typeof fact === "string") &&
      Array.isArray(item.networks) &&
      item.networks.every((network) => typeof network === "string") &&
      Array.isArray(item.links) &&
      item.links.every((link) => Array.isArray(link) && link.length === 2 && link.every((part) => typeof part === "string")) &&
      (!item.savings || (Array.isArray(item.savings) && item.savings.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((part) => typeof part === "string")))),
  );
}
async function refreshPromotions() {
  if (promotionsPending) return;
  const status = $("promotions-update");
  if (!api?.getPromotions) {
    status.textContent = "Katalog zapisany w aplikacji.";
    return;
  }
  status.textContent = "Pobieramy aktualne oferty z oficjalnych stron kin… To może potrwać do kilku sekund.";
  promotionsPending = true;
  $("promotions-panel").setAttribute("aria-busy", "true");
  try {
    const result = await api.getPromotions();
    if (!validPromotionCatalog(result.promotions)) throw new Error("Niepoprawny katalog.");
    promotions = result.promotions;
    lastPromotionsRefresh = Date.now();
    if (!promotionById(activePromotionId)) clearPromotion(false);
    renderPromotions();
    status.textContent = Number.isInteger(result.checked)
      ? result.checked > 0
        ? `Sprawdzono oficjalne źródła: ${result.checked}/${result.total} ofert. Pozostałe informacje pochodzą z katalogu lokalnego.`
        : "Strony kin są chwilowo niedostępne. Wyświetlamy oferty zapisane w aplikacji."
      : result.fresh
      ? "Pobrano najnowszy dostępny katalog. Aktualne warunki potwierdź na stronie kina."
      : "Nie udało się połączyć. Pokazujemy katalog zapisany w aplikacji.";
    if (result.cached) status.textContent = "Strony kin są chwilowo niedostępne. Pokazujemy ostatni katalog zapisany lokalnie na tym urządzeniu.";
    if (result.stale) status.textContent = "Nie udało się potwierdzić aktualnych ofert. Pokazujemy podstawowy katalog aplikacji — sprawdź warunki na stronie kina.";
  } catch {
    status.textContent = "Nie udało się odświeżyć katalogu. Pokazujemy ostatnie dostępne informacje.";
    status.textContent = "Nie udało się odświeżyć katalogu. Pokazujemy informacje zapisane w aplikacji.";
  } finally {
    promotionsPending = false;
    $("promotions-panel").setAttribute("aria-busy", "false");
  }
}
function openPromotions() {
  previousStage = currentStage === "promotions" ? previousStage : currentStage;
  currentStage = "promotions";
  for (const section of document.querySelectorAll("main > section"))
    section.hidden = section.id !== "promotions-panel";
  $("error").hidden = true;
  renderPromotions();
  refreshPromotions();
  $("promotions-title").focus();
}
function refreshPromotionsIfNeeded() {
  if (currentStage === "promotions" && Date.now() - lastPromotionsRefresh >= PROMOTIONS_REFRESH_INTERVAL)
    refreshPromotions();
}
function calendarDateRange() {
  const from = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const to = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 3, 0);
  return { from: localISO(from), to: localISO(to) };
}
function renderCalendar() {
  const range = calendarDateRange();
  const fromLabel = new Date(range.from + "T12:00:00").toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  const toLabel = new Date(range.to + "T12:00:00").toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  $("calendar-range").textContent = fromLabel + " – " + toLabel;
  const groups = new Map();
  for (const item of calendarItems.filter(item => item.date >= range.from && item.date <= range.to)) {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
  }
  const cards = [...groups.entries()].map(([dateValue, items]) => {
    const day = document.createElement("article");
    day.className = "release-day";
    const heading = document.createElement("h3");
    heading.textContent = prettyDate(dateValue);
    day.append(heading);
    const list = document.createElement("ul");
    for (const item of items) {
      const entry = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const source = document.createElement("a");
      source.href = item.sourceUrl;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.textContent = "Źródło";
      entry.append(title, source);
      list.append(entry);
    }
    day.append(list);
    return day;
  });
  $("calendar-list").replaceChildren(...cards);
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Brak potwierdzonych premier w wybranym okresie.";
    $("calendar-list").append(empty);
  }
}
async function refreshCalendar() {
  if (calendarPending || !api?.getReleaseCalendar) return;
  calendarPending = true;
  $("calendar-panel").setAttribute("aria-busy", "true");
  $("calendar-update").textContent = "Pobieramy najnowszy kalendarz premier…";
  try {
    const result = await api.getReleaseCalendar(calendarDateRange());
    if (!Array.isArray(result.items)) throw new Error("Niepoprawne dane kalendarza.");
    calendarItems = result.items;
    renderCalendar();
    $("calendar-update").textContent = "Źródło sprawdzone: " + new Date(result.checkedAt).toLocaleString("pl-PL") + ".";
  } catch {
    $("calendar-update").textContent = "Nie udało się odświeżyć kalendarza. Spróbuj ponownie za chwilę.";
    renderCalendar();
  } finally {
    calendarPending = false;
    $("calendar-panel").setAttribute("aria-busy", "false");
  }
}
function openCalendar() {
  previousPlanningStage = currentStage;
  currentStage = "calendar";
  for (const section of document.querySelectorAll("main > section"))
    section.hidden = section.id !== "calendar-panel";
  $("error").hidden = true;
  renderCalendar();
  refreshCalendar();
  $("calendar-title").focus();
}
function clearPromotion(render = true) {
  activePromotionId = "";
  localStorage.removeItem("activePromotionId");
  document.querySelectorAll(".promotion-eligible").forEach((element) => element.classList.remove("promotion-eligible"));
  document.querySelectorAll(".promotion-match").forEach((element) => element.remove());
  $("detail-promotion").hidden = true;
  if (render) renderPromotions();
}
function usePromotion(promotion) {
  if (!canTrackPromotion(promotion)) return;
  activePromotionId = promotion.id;
  localStorage.setItem("activePromotionId", activePromotionId);
  renderPromotions();
  if (promotion.start) {
    date = promotion.start > localISO(new Date()) ? promotion.start : localISO(new Date());
    $("date").value = date;
    $("footer-date").textContent = prettyDate(date);
  } else if (promotion.kind === "weekday" || promotion.kind === "wednesday") {
    const target = promotion.weekday ?? 3;
    const next = new Date();
    next.setDate(next.getDate() + ((target - next.getDay() + 7) % 7));
    date = localISO(next);
    $("date").value = date;
    $("footer-date").textContent = prettyDate(date);
  }
  city = "";
  $("city").value = "";
  $("footer-city").textContent = "Wybierz miasto";
  show("city");
  $("tracking-banner").scrollIntoView({ block: "nearest" });
}
function error(message) {
  const text = typeof message === "string" ? message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  ) : "";
  // Nie pokazujemy użytkownikowi wyjątków JavaScript ani szczegółów komunikacji IPC.
  $("error").textContent = navigator.onLine === false
    ? "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie."
    : !text || /TypeError|SyntaxError|fetch failed|ECONN|ENOTFOUND|Cannot read|undefined|null/i.test(text)
      ? "Nie udało się pobrać danych. Spróbuj ponownie za chwilę."
      : text;
  $("error").hidden = false;
  $("status").textContent = "Spróbuj ponownie";
}
function chooseCity(value) {
  city = value.trim().replace(/\s+/g, " ");
  if (!city) return;
  $("city").value = city;
  $("chosen-city").textContent = city;
  $("footer-city").textContent = city;
  refreshDates();
  show("date");
}
function refreshDates() {
  renderPromotions();
  refreshGreeting();
  const today = new Date(),
    tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  $("today-label").textContent = prettyDate(localISO(today));
  $("tomorrow-label").textContent = prettyDate(localISO(tomorrow));
  if (!$("date").value) $("date").value = localISO(today);
}
// Pora dnia zależy od lokalnego zegara; odświeżamy ją także po wybudzeniu urządzenia.
function refreshGreeting() {
  const hour = new Date().getHours();
  const evening = hour >= 18 || hour < 6;
  $("greeting").textContent = evening ? "DOBRY WIECZÓR" : "DZIEŃ DOBRY";
  $("screen-period").textContent = evening ? "EVENING." : "DAY.";
  $("today-icon").textContent = evening ? "☾" : "☀";
  $("brand-greeting").textContent = evening
    ? "Twój dobry wieczór, od pierwszego kliknięcia."
    : "Twój dobry dzień, od pierwszego kliknięcia.";
  $("art-plan").textContent = evening
    ? "TWÓJ WIECZÓR JEST W PLANIE"
    : "TWÓJ DZIEŃ JEST W PLANIE";
  $("loading-period").textContent = evening
    ? "na Twój wieczór."
    : "na Twój dzień.";
  document
    .querySelector(".cinema-art")
    .setAttribute(
      "aria-label",
      evening
        ? "Dobry wieczór zaczyna się w kinie"
        : "Dobry dzień zaczyna się w kinie",
    );
}
function updateConnection() {
  const offline = navigator.onLine === false;
  $("connection-status").hidden = !connectionLost;
  $("connection-status").textContent = offline
    ? "Problem z połączeniem. Sprawdź dostęp do internetu."
    : "Połączenie wróciło. Możesz ponowić wyszukiwanie.";
  $("retry-search").hidden = !connectionLost;
  $("retry-search").disabled = offline;
  document.querySelector(".loading-line").hidden = connectionLost;
  if (connectionLost)
    $("status").textContent = offline
      ? "Problem z połączeniem"
      : "Gotowy do ponowienia";
}
function lostConnection() {
  if (currentStage !== "loading") return;
  ++generation;
  connectionLost = true;
  if (searchPending) cancellation = api.cancel().catch(() => {});
  searchPending = false;
  updateConnection();
}
// Dopuszczamy tylko obrazy z obsługiwanych źródeł, nigdy przypadkowy wynik wyszukiwarki.
function posterUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (["img.helios.pl", "www.multikino.pl", "www.cinema-city.pl"].includes(url.hostname) ||
      url.hostname === "fwcdn.pl" || url.hostname.endsWith(".fwcdn.pl"))
      ? url.href
      : "";
  } catch {
    return "";
  }
}
// Tekst ze stron kin wstawiamy przez textContent, aby nie został zinterpretowany jako HTML.
function choice(title, subtitle, action) {
  const button = document.createElement("button");
  button.className = "choice";
  button.setAttribute("aria-label", subtitle ? `${title} ${subtitle}` : title);
  const label = document.createElement("strong");
  label.textContent = title;
  button.append(label);
  if (subtitle) {
    const sub = document.createElement("span");
    sub.textContent = subtitle;
    button.append(sub);
  }
  button.addEventListener("click", action);
  return button;
}
// Brak plakatu lub błąd obrazu pozostawia lokalną kartę; seanse są zawsze dostępne.
function movieCard(group, index) {
  const button = choice(group.title, "", () =>
    selectMovie(group.key, group.title),
  );
  button.classList.add("movie-card");
  const title = button.firstElementChild;
  const number = document.createElement("span");
  number.className = "poster-number";
  number.textContent = String(index + 1).padStart(2, "0");
  number.setAttribute("aria-hidden", "true");
  const poster = document.createElement("span");
  poster.className = "movie-poster";
  poster.setAttribute("aria-hidden", "true");
  const reel = document.createElement("span");
  reel.className = "poster-reel";
  reel.textContent = "✦";
  const caption = document.createElement("span");
  caption.className = "poster-caption";
  caption.textContent = "W KINIE";
  poster.append(number, reel, caption);
  const source = group.screenings
    .map((row) => posterUrl(row.posterUrl))
    .find(Boolean);
  if (source) {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => image.classList.add("loaded"));
    image.addEventListener("error", () => image.remove());
    image.src = source;
    poster.append(image);
  }
  const copy = document.createElement("span");
  copy.className = "movie-copy";
  const meta = document.createElement("span");
  meta.className = "movie-meta";
  meta.id = `movie-meta-${index}`;
  const cinemas = new Set(group.screenings.map((row) => row.cinema)).size;
  meta.textContent = `${counted(group.screenings.length, "seans", "seanse", "seansów")} · ${counted(cinemas, "kino", "kina", "kin")}`;
  button.setAttribute("aria-describedby", meta.id);
  const times = document.createElement("span");
  times.className = "movie-times";
  times.setAttribute("aria-label", "Przykładowe godziny seansów");
  const uniqueTimes = [
    ...new Set(group.screenings.map((row) => row.time)),
  ].sort();
  for (const time of uniqueTimes.slice(0, 3)) {
    const chip = document.createElement("span");
    chip.textContent = time;
    times.append(chip);
  }
  if (uniqueTimes.length > 3) {
    const more = document.createElement("span");
    more.textContent = `+${uniqueTimes.length - 3}`;
    times.append(more);
  }
  copy.append(title, meta, times);
  const activePromotion = promotionById(activePromotionId);
  if (
    activePromotion &&
    group.screenings.some((row) => promotionApplies(activePromotion, row))
  ) {
    button.classList.add("promotion-eligible");
    addPromotionMatch(copy, activePromotion);
  }
  const arrow = document.createElement("span");
  arrow.className = "card-arrow";
  arrow.textContent = "↗";
  arrow.setAttribute("aria-hidden", "true");
  button.replaceChildren(poster, copy, arrow);
  const entry = document.createElement("article");
  entry.className = "movie-entry";
  const info = document.createElement("button");
  info.className = "movie-info";
  info.type = "button";
  info.textContent = "O filmie ↗";
  info.setAttribute(
    "aria-label",
    `O filmie: ${group.title} — wyszukaj w przeglądarce`,
  );
  info.addEventListener("click", async () => {
    try {
      await api.openMovie(group.key);
    } catch {
      error("Nie udało się otworzyć wyszukiwarki. Spróbuj ponownie.");
    }
  });
  entry.append(button, info);
  return entry;
}
function filterMovies() {
  const query = normalizeTitle($("movie-filter").value);
  let visible = 0;
  [...$("movies").children].forEach((card, index) => {
    card.hidden = !normalizeTitle(movieGroups[index].title).includes(query);
    if (!card.hidden) ++visible;
  });
  $("filter-empty").hidden = !movieGroups.length || visible > 0;
  $("filter-count").textContent = query
    ? `${visible} z ${movieGroups.length}`
    : `${counted(movieGroups.length, "film", "filmy", "filmów")} do wyboru`;
}
// Grupujemy po movieKey, zachowując poszczególne seanse i odnośniki do biletów.
async function search(iso) {
  if (!api) {
    error("Uruchom aplikację ze skrótu Cinema Movie Finder.");
    return;
  }
  date = iso;
  $("date").value = date;
  $("footer-date").textContent = prettyDate(date);
  $("status").textContent = "Pobieranie repertuaru…";
  show("loading");
  connectionLost = false;
  updateConnection();
  if (navigator.onLine === false) {
    lostConnection();
    return;
  }
  const request = ++generation;
  try {
    await cancellation;
    if (request !== generation) return;
    searchPending = true;
    const result = await api.search({ city, date });
    if (request !== generation) return;
    // Nie traktujemy uszkodzonej odpowiedzi jako pustego repertuaru.
    if (!result || !Array.isArray(result.screenings) || typeof result.city !== "string" ||
        result.screenings.some(row => !row || !Number.isSafeInteger(row.id) ||
          typeof row.movieKey !== "string" || typeof row.title !== "string" ||
          typeof row.cinema !== "string" || typeof row.time !== "string"))
      throw new Error("Nie udało się odczytać repertuaru. Spróbuj ponownie za chwilę.");
    rows = result.screenings;
    const unavailable = Array.isArray(result.unavailableSources)
      ? [...new Set(result.unavailableSources.filter(value => typeof value === "string"))] : [];
    city = result.city;
    $("footer-city").textContent = city;
    $("search-label").textContent = `${city} / ${prettyDate(date)}`;
    const movies = new Map();
    for (const row of rows) {
      if (!movies.has(row.movieKey))
        movies.set(row.movieKey, {
          key: row.movieKey,
          title: row.title,
          screenings: [],
        });
      movies.get(row.movieKey).screenings.push(row);
    }
    movieGroups = [...movies.values()];
    $("movies").replaceChildren(...movieGroups.map(movieCard));
    $("movie-filter").value = "";
    $("movie-filter-bar").hidden = !movieGroups.length;
    $("movie-count").textContent = counted(
      movieGroups.length,
      "film",
      "filmy",
      "filmów",
    );
    filterMovies();
    $("empty").hidden = rows.length > 0;
    $("empty").textContent = unavailable.length
      ? `Nie udało się pobrać pełnego repertuaru (${unavailable.join(", ")}). To nie oznacza braku seansów. Spróbuj ponownie lub sprawdź strony kin.`
      : "Nie znaleziono seansów na ten dzień. Repertuar może jeszcze nie być opublikowany. Sprawdź inną datę lub strony kin.";
    let warning = $("source-warning");
    if (!warning) {
      warning = document.createElement("p");
      warning.id = "source-warning";
      warning.className = "hint";
      $("movies").before(warning);
    }
    warning.hidden = !rows.length || !unavailable.length;
    warning.textContent = `Część źródeł jest niedostępna: ${unavailable.join(", ")}. Lista seansów może być niepełna.`;
    const sourceDetails = unavailable.map((source) => {
      if (/filmweb/i.test(source)) return "Filmweb nie odpowiedział podczas pobierania repertuaru; mogą brakować seansów kin, których nie zwróciły źródła kinowe.";
      if (/cinema city/i.test(source)) return "Cinema City nie odpowiedziało; mogą brakować jego kin i seansów.";
      if (/helios/i.test(source)) return "Helios nie odpowiedział; mogą brakować jego kin i seansów.";
      if (/multikino/i.test(source)) return "Multikino nie odpowiedziało; mogą brakować jego kin i seansów.";
      return `${source} nie odpowiedziało; część seansów może być niewidoczna.`;
    }).join(" ");
    if (unavailable.length) {
      warning.textContent = `Lista może być niepełna · ${unavailable.join(", ")}. Pozostałe seanse są dostępne.`;
      warning.title = sourceDetails;
      warning.setAttribute("role", "status");
    }
    $("status").textContent = rows.length
      ? `Filmy: ${movies.size} / Seanse: ${rows.length}`
      : "Brak seansów";
    if (!rows.length && unavailable.length)
      $("status").textContent = "Problem z pobieraniem";
    show("movies");
  } catch (problem) {
    if (request === generation) {
      show("date");
      error(problem?.message);
    }
  } finally {
    if (request === generation) searchPending = false;
  }
}
function screeningPrice(row) {
  if (Number.isFinite(row.price) && row.price >= 0)
    return { label: `${row.priceFrom ? "od " : ""}${row.price.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`, note: row.priceNote || "Zwykłe miejsce" };
  if (navigator.onLine === false)
    return { label: "—", note: "Połącz się z internetem, aby sprawdzić cenę" };
  if (api?.prices && /helios|multikino|cinema city/i.test(row.cinema) && !row.priceChecked)
    return { label: "…", note: "Pobieranie ceny" };
  return { label: "—", note: row.priceNote || "Cena niedostępna online" };
}
function selectMovie(key, title, loadPrices = true) {
  currentMovieKey = key;
  $("screenings-title").textContent = title;
  const screenings = rows
    .filter((row) => row.movieKey === key)
    .sort((a, b) => a.time.localeCompare(b.time));
  $("screenings-summary").textContent =
    `${city} · ${prettyDate(date)} · ${counted(screenings.length, "seans", "seanse", "seansów")} do wyboru`;
  const activePromotion = promotionById(activePromotionId);
  $("screenings").replaceChildren(
    ...screenings.map((row) => {
      const button = choice(row.time, row.cinema, () => selectScreening(row));
      button.classList.add("screening-card");
      button.querySelector("strong").className = "screening-time";
      button.querySelector("span").className = "screening-cinema";
      const price = screeningPrice(row);
      const priceTag = document.createElement("span");
      priceTag.className = "screening-price";
      priceTag.textContent = price.label;
      const caption = document.createElement("small");
      caption.textContent = price.note;
      priceTag.append(caption);
      button.append(priceTag);
      if (activePromotion && promotionApplies(activePromotion, row)) {
        button.classList.add("promotion-eligible");
        addPromotionMatch(button, activePromotion);
        button.setAttribute(
          "aria-label",
          `${row.time} ${row.cinema}, pasuje do promocji ${activePromotion.title}`,
        );
      }
      return button;
    }),
  );
  show("screenings");
  // Ponowienie jest dostępne bez wychodzenia z filmu; poprawne ceny pozostają widoczne.
  // Przycisk pozostaje widoczny dla każdego brakującego odczytu, także gdy
  // źródło zakończyło próbę bez ceny albo odpowiedź właśnie jest oczekiwana.
  $("retry-prices").hidden = !api?.prices || !screenings.some(row =>
    !Number.isFinite(row.price) && /helios|multikino|cinema city/i.test(row.cinema));
  $("retry-prices").disabled = navigator.onLine === false || Boolean(pendingPrices.get(rows)?.has(key));
  if (loadPrices && navigator.onLine !== false && api?.prices && screenings.some(row =>
      (!row.priceChecked || (row.priceRetryAt && Date.now() >= row.priceRetryAt)) && /helios|multikino|cinema city/i.test(row.cinema))) {
    const sourceRows = rows;
    let pending = pendingPrices.get(sourceRows);
    if (!pending) { pending = new Map(); pendingPrices.set(sourceRows, pending); }
    if (pending.has(key)) return;
    $("retry-prices").disabled = true;
    const request = api.prices(key).then(updates => {
      if (rows !== sourceRows) return;
      for (const update of updates) {
        const row = rows.find(item => item.id === update.id && item.movieKey === key);
        if (row) Object.assign(row, update);
      }
    }).catch(() => {
      if (rows === sourceRows) screenings.forEach(row => {
        row.priceChecked = true;
        row.priceStatus = "unavailable";
        row.priceRetryAt = Date.now() + 30000;
        row.priceNote = "Nie udało się pobrać ceny online";
      });
    }).finally(() => {
      pending.delete(key);
      if (rows !== sourceRows) return;
      if (currentStage === "screenings" && currentMovieKey === key) selectMovie(key, title, false);
      if (currentStage === "detail" && selected?.movieKey === key) renderTicketDetails(selected);
    });
    pending.set(key, request);
  }
}
$("retry-prices").addEventListener("click", () => {
  if (navigator.onLine === false || !api?.prices) return;
  const movie = rows.find(row => row.movieKey === currentMovieKey);
  if (!movie) return;
  if (pendingPrices.get(rows)?.has(currentMovieKey)) return;
  for (const row of rows) {
    if (row.movieKey === currentMovieKey && !Number.isFinite(row.price)) {
      row.priceChecked = false;
      delete row.priceRetryAt;
    }
  }
  // Wymuś nową próbę tylko dla brakujących cen; poprawne ceny pozostają.
  selectMovie(currentMovieKey, movie.title, true);
});
function renderTicketDetails(row) {
  const price = screeningPrice(row);
  $("detail-price").textContent = `${price.label} · ${price.note}`;
  const filmweb = /^https?:\/\/([^/]+\.)?filmweb\.pl\//i.test(row.ticketUrl);
  $("ticket").textContent = filmweb ? "Otwórz repertuar ↗" : "Otwórz bilety ↗";
  $("ticket").hidden = !/^https?:\/\//i.test(row.ticketUrl);
  $("ticket-note").textContent = $("ticket").hidden ? "Brak odnośnika do biletów." : filmweb
    ? "Nie znaleziono jednoznacznego odnośnika do zakupu w kinie. Otworzymy repertuar."
    : "Oficjalna strona zakupu biletu otworzy się w przeglądarce.";
}
// Szczegóły pokazujemy od razu, a brakujący adres pobieramy osobnym żądaniem.
async function selectScreening(row) {
  selected = row;
  $("detail-title").textContent = row.title;
  $("detail-time").textContent = `${prettyDate(date)}, ${row.time}`;
  $("detail-cinema").textContent = row.cinema;
  $("detail-address").textContent = row.address || "Pobieranie adresu…";
  const activePromotion = promotionById(activePromotionId);
  const applies = activePromotion && promotionApplies(activePromotion, row);
  $("detail-promotion").hidden = !applies;
  if (applies)
    $("detail-promotion").textContent =
      `★ Ten seans pasuje do promocji „${activePromotion.title}”. Ostateczną cenę i wyłączenia sprawdź przed płatnością.`;
  show("detail");
  renderTicketDetails(row);
  if (row.address) return;
  const request = ++generation;
  document.querySelectorAll("#detail-panel [data-back]").forEach((button) => {
    button.disabled = true;
  });
  try {
    const detail = await api.detail(row.id);
    if (request === generation)
      $("detail-address").textContent =
        detail.address || "Nie udało się pobrać adresu kina.";
  } catch {
    if (request === generation)
      $("detail-address").textContent =
        "Nie udało się pobrać adresu kina. Sprawdź stronę repertuaru lub biletów.";
  } finally {
    document.querySelectorAll("#detail-panel [data-back]").forEach((button) => {
      button.disabled = false;
    });
  }
}
$("city-form").addEventListener("submit", (event) => {
  event.preventDefault();
  chooseCity($("city").value);
});
for (const button of $("cities").children)
  button.addEventListener("click", () => chooseCity(button.textContent));
$("today").addEventListener("click", () => search(localISO(new Date())));
$("tomorrow").addEventListener("click", () => {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  search(localISO(day));
});
$("date-form").addEventListener("submit", (event) => {
  event.preventDefault();
  search($("date").value);
});
$("movie-filter").addEventListener("input", filterMovies);
for (const [index, step] of [...$("steps").children].entries()) {
  step.dataset.stage = stages[index];
  step.setAttribute("role", "button");
  step.tabIndex = -1;
  step.setAttribute("aria-disabled", "true");
}
for (const step of $("steps").children) {
  step.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      step.click();
    }
  });
  step.addEventListener("click", () => {
    const target = step.dataset.stage;
    if (!target || stages.indexOf(target) >= stages.indexOf(currentStage))
      return;
    ++generation;
    show(target);
    if (target === "city") $("status").textContent = "Gotowy do wyszukiwania";
  });
}
for (const button of document.querySelectorAll("[data-back]"))
  button.addEventListener("click", () => {
    show(button.dataset.back);
    if (button.dataset.back === "city")
      $("status").textContent = "Gotowy do wyszukiwania";
  });
$("cancel").addEventListener("click", async () => {
  ++generation;
  searchPending = false;
  cancellation = api.cancel().catch(() => {});
  await cancellation;
  show("date");
  $("status").textContent = "Anulowano pobieranie";
});
$("ticket").addEventListener("click", async () => {
  try {
    await api.openTicket(selected.ticketUrl);
  } catch {
    error("Nie udało się otworzyć strony biletów. Spróbuj ponownie.");
  }
});
$("quit").addEventListener("click", () => api.quit());
$("promotions-open").addEventListener("click", openPromotions);
$("calendar-open").addEventListener("click", openCalendar);
$("calendar-close").addEventListener("click", () => show(previousPlanningStage));
$("calendar-previous").addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() - 1);
  renderCalendar();
  refreshCalendar();
});
$("calendar-next").addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() + 1);
  renderCalendar();
  refreshCalendar();
});
$("tracking-stop").addEventListener("click", () => clearPromotion());
$("promotions-close").addEventListener("click", () => show(previousStage));
const promote = document.createElement("button");
promote.id = "promote";
promote.className = "promo-card";
promote.type = "button";
promote.setAttribute("aria-label", "Nagłośnij projekt na X");
promote.innerHTML =
  '<span class="x-logo" aria-hidden="true">𝕏</span><span><b>Nagłośnij projekt</b><small>Gotowy post na X</small></span><span class="promo-arrow" aria-hidden="true">↗</span>';
promote.addEventListener("click", async () => {
  try {
    await api.promote();
  } catch {
    error("Nie udało się otworzyć gotowego posta na X.");
  }
});
document
  .querySelector("footer")
  .insertBefore(promote, document.querySelector(".stamp"));
const planningRail = document.querySelector(".planning-rail");
refreshDates();
renderPromotions();
setInterval(refreshDates, 60000);
setInterval(refreshPromotionsIfNeeded, 60000);
window.addEventListener("focus", refreshDates);
window.addEventListener("focus", refreshPromotionsIfNeeded);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshDates();
    refreshPromotionsIfNeeded();
  }
});
window.addEventListener("offline", lostConnection);
window.addEventListener("online", () => {
  if (currentStage === "loading") updateConnection();
});
$("retry-search").addEventListener("click", () => search(date));
