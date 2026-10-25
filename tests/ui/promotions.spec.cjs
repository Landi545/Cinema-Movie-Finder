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
            { id: "a", date: range.from, title: "Film premierowy", sourceUrl: "https://www.wikidata.org/entity/Q1" },
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
