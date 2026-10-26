const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const catalog = require("../../desktop/ui/promotions.json");
const pageUrl = pathToFileURL(path.resolve(__dirname, "../../desktop/ui/index.html")).href;

async function setup(page, day = 23, month = 9) {
  await page.clock.install({ time: new Date(2026, month, day, 12) });
  await page.addInitScript((catalog) => {
    window.promotionRequests = 0;
    window.releaseCalendarRequests = 0;
    window.cinema = {
      getPromotions: async () => {
        window.promotionRequests++;
        return { promotions: catalog, fresh: true };
      },
      openPromotion: async () => {},
      getReleaseCalendar: async (range) => {
        window.releaseCalendarRequests++;
        return {
          checkedAt: "2026-10-25T12:00:00.000Z",
          items: [
            { id: "a", date: range.from, title: "Film premierowy", genres: ["Horror"], description: "Elegancki opis filmu.", bannerUrl: "icon.png", sourceUrl: "https://www.filmweb.pl/film/Test-2026-1" },
          ],
        };
      },
    };
  }, catalog);
  await page.goto(pageUrl);
}

test("release calendar is reachable from the planning tools and stays usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  await page.locator("#calendar-open").click();
  await expect(page.locator("#calendar-panel")).toBeVisible();
  await expect(page.locator(".release-day")).toContainText("Film premierowy");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => window.releaseCalendarRequests)).toBe(1);
  await page.locator("#calendar-next").click();
  await expect(page.locator("#calendar-range")).toContainText("listopad");
  expect(await page.evaluate(() => window.releaseCalendarRequests)).toBe(2);
});

test("missing calendar bridge is an actionable error rather than an empty catalogue", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { delete window.cinema.getReleaseCalendar; });
  await page.locator("#calendar-open").click();
  await expect(page.locator("#calendar-update")).toContainText("Brak połączenia z modułem");
  await expect(page.locator("#calendar-list")).toContainText("Nie udało się pobrać");
  await expect(page.locator("#calendar-panel")).toHaveAttribute("aria-busy", "false");
});

test("switching planning tools never traps the user away from search", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  for (const order of [["promotions", "calendar"], ["calendar", "promotions"]]) {
    for (const tool of order) await page.locator("#" + tool + "-open").click();
    await page.getByRole("button", { name: "← Szukaj seansu", exact: true }).click();
    await expect(page.locator("#city-panel")).toBeVisible();
    await expect(page.locator("#promotions-panel")).toBeHidden();
    await expect(page.locator("#calendar-panel")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("calendar sorting and genre filter work locally without another download", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.cinema.getReleaseCalendar = async () => { window.releaseCalendarRequests++; return { checkedAt: new Date().toISOString(), items: [
      { id: "1", date: "2026-10-02", title: "Zeta", genres: ["Horror"], bannerUrl: "icon.png" },
      { id: "2", date: "2026-10-02", title: "Alfa", genres: ["Komedia"], bannerUrl: "icon.png" },
    ] }; };
  });
  await page.locator("#calendar-open").click();
  expect(await page.evaluate(() => window.releaseCalendarRequests)).toBe(1);
  await page.locator("#calendar-sort").selectOption("date-desc");
  await expect(page.locator(".release-copy strong")).toHaveText(["Alfa", "Zeta"]);
  await page.locator("#calendar-genre").selectOption("Horror");
  await expect(page.locator(".release-copy strong")).toHaveText(["Zeta"]);
  await page.locator("#calendar-genre").selectOption("all");
  await page.locator("#calendar-search").fill("al");
  await expect(page.locator(".release-copy strong")).toHaveText(["Alfa"]);
  expect(await page.evaluate(() => window.releaseCalendarRequests)).toBe(1);
});

for (const width of [320, 390, 1100]) {
  test(`calendar days form a single chronological list with unique films and decoded posters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.evaluate(() => {
      window.cinema.getReleaseCalendar = async () => ({ checkedAt: new Date().toISOString(), items: [
        { id: "2", date: "2026-10-09", title: "Drugi dzień", metadata: "Komedia · 1h 40m", bannerUrl: "icon.png" },
        { id: "1", date: "2026-10-02", title: "Pierwsza premiera", bannerUrl: "icon.png" },
        { id: "1", date: "2026-10-03", title: "Duplikat", bannerUrl: "icon.png" },
        { id: "3", date: "2026-10-02", title: "Druga premiera tego samego dnia", bannerUrl: "icon.png" },
      ] });
    });
    await page.locator("#calendar-open").click();
    const days = page.locator(".release-day");
    await expect(days).toHaveCount(2);
    await expect(days.first().locator("li")).toHaveCount(2);
    await expect(page.locator(".release-copy strong")).toHaveText(["Druga premiera tego samego dnia", "Pierwsza premiera", "Drugi dzień"]);
    expect(await days.locator("time").evaluateAll(nodes => nodes.map(node => node.dateTime))).toEqual(["2026-10-02", "2026-10-09"]);
    const first = await days.nth(0).boundingBox();
    const second = await days.nth(1).boundingBox();
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(second.x).toBe(first.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".release-banner").first().scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(".release-banner").first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  });
}

test("catalog downloads on opening only; advance savings are readable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  expect(await page.evaluate(() => window.promotionRequests)).toBe(0);
  await page.locator("#promotions-open").click();
  await expect(page.locator("#promotions-update")).toContainText("Pobrano najnowszy dostępny katalog");
  expect(await page.evaluate(() => window.promotionRequests)).toBe(1);
  const advance = page.locator(".promotion-card").filter({ hasText: "Wcześniej kupujesz" });
  await expect(advance.locator(".promotion-savings > div")).toHaveCount(4);
  await expect(advance.locator(".promotion-savings > div").last()).toContainText("4 dni lub więcej");
  await expect(advance.locator(".promotion-general")).toContainText("Oferta ogólna kina");
  await expect(advance.locator(".promotion-use")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [day, month, tuesday, wednesday] of [[23, 9, false, false], [27, 9, true, false], [28, 9, false, true], [11, 10, false, false]]) {
  test(`weekly tracking respects day and holidays: ${month + 1}/${day}`, async ({ page }) => {
    await setup(page, day, month);
    await page.locator("#promotions-open").click();
    const tue = page.locator(".promotion-card").filter({ has: page.getByRole("heading", { name: "Superwtorek", exact: true }) }).locator(".promotion-use");
    const wed = page.locator(".promotion-card").filter({ has: page.getByRole("heading", { name: "Kinowa Środa", exact: true }) }).locator(".promotion-use");
    expect(await tue.isEnabled()).toBe(tuesday);
    expect(await wed.isEnabled()).toBe(wednesday);
  });
}

test("tracking expires after midnight and ended promotions disappear", async ({ page }) => {
  await setup(page, 28);
  await page.locator("#promotions-open").click();
  await expect(page.getByRole("heading", { name: "Święto Kina", exact: true })).toHaveCount(0);
  await page.locator(".promotion-card").filter({ has: page.getByRole("heading", { name: "Kinowa Środa", exact: true }) }).getByRole("button", { name: "Śledź tę promocję" }).click();
  await expect(page.locator("#promotion-tracking-label")).toContainText("Kinowa Środa");
  await page.clock.setSystemTime(new Date(2026, 9, 29, 0, 1));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#promotion-tracking-label")).not.toContainText("Śledzisz");
});

test("missing prices can recover without repeating the search or hiding a valid price", async ({ page }) => {
  await setup(page, 23);
  await page.evaluate(() => {
    window.priceAttempts = 0;
    window.cinema.search = async () => ({ city: "Szczecin", screenings: [
      { id: 0, title: "Lalka", movieKey: "lalka", cinema: "Multikino Szczecin", time: "10:00" },
      { id: 1, title: "Lalka", movieKey: "lalka", cinema: "Helios Outlet Park", time: "11:45" }
    ] });
    window.cinema.prices = async () => ++window.priceAttempts === 1
      ? [{ id: 0, price: 21, priceChecked: true }, { id: 1, priceChecked: true, priceNote: "Cena chwilowo niedostępna" }]
      : [{ id: 1, price: 16.5, priceChecked: true }];
  });
  await page.locator("#cities button").first().click();
  await page.locator("#date").fill("2026-10-25");
  await page.locator("#date-form button").click();
  await page.locator(".movie-card").first().click();
  await expect(page.locator("#retry-prices")).toBeEnabled();
  await expect(page.locator(".screening-price").first()).toContainText("21,00 zł");
  await page.locator("#retry-prices").click();
  await expect(page.locator(".screening-price").nth(1)).toContainText("16,50 zł");
  await expect(page.locator(".screening-price").first()).toContainText("21,00 zł");
  await expect(page.locator("#retry-prices")).toBeHidden();
});

test("price retry is placed beside the return-to-movies action", async ({ page }) => {
  await setup(page, 23);
  await page.evaluate(() => {
    window.cinema.search = async () => ({ city: "Szczecin", screenings: [{ id: 0, title: "Lalka", movieKey: "lalka", cinema: "Helios Outlet Park", time: "18:30" }] });
    window.cinema.prices = async () => [{ id: 0, priceChecked: true, priceNote: "Cena chwilowo niedostępna" }];
  });
  await page.locator("#cities button").first().click();
  await page.locator("#date").fill("2026-10-25");
  await page.locator("#date-form button").click();
  await page.locator(".movie-card").first().click();
  await expect(page.locator("#retry-prices")).toBeVisible();
  const retry = await page.locator("#retry-prices").boundingBox();
  const back = await page.locator("[data-back=movies]").boundingBox();
  expect(retry.x).toBeGreaterThan(back.x);
});

test("offer prices are independent of tracking; activation returns to city with a visible banner", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page, 23);
  await page.evaluate(() => {
    window.cinema.search = async () => ({ city: "Katowice", screenings: [{ id: 0, title: "Lalka", movieKey: "lalka", cinema: "Multikino Katowice", time: "18:30", address: "Test 1", ticketUrl: "https://www.multikino.pl" }] });
    window.cinema.prices = async () => [{ id: 0, price: 18, priceChecked: true, priceNote: "Standard · z opłatą online", ticketUrl: "https://www.multikino.pl/rezerwacja-biletow/podsumowanie/0001/HO1/1" }];
  });
  await page.locator("#cities button").first().click();
  await page.locator("#date").fill("2026-10-24");
  await page.locator("#date-form button").click();
  await page.locator(".movie-card").first().click();
  await expect(page.locator(".screening-price")).toContainText("18,00 zł");
  await expect(page.locator(".screening-price")).toContainText("Standard");
  await expect(page.locator("#screenings .promotion-eligible")).toHaveCount(0);
  await expect(page.locator(".screening-ticket-hint")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#promotions-open").click();
  await page.locator(".featured .promotion-use").click();
  await expect(page.locator("#city-panel")).toBeVisible();
  await expect(page.locator("#city")).toHaveValue("");
  await expect(page.locator("#tracking-banner")).toContainText("Święto Kina");
  await page.locator("#cities button").first().click();
  await page.locator("#date-form button").click();
  await page.locator(".movie-card").first().click();
  await expect(page.locator("#screenings .promotion-eligible")).toHaveCount(1);
  await expect(page.locator(".screening-price")).toContainText("18,00 zł");
});
