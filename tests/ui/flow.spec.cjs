// Kontrolowane odpowiedzi window.cinema pozwalają testować interfejs bez połączeń sieciowych.
const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const pageUrl = pathToFileURL(
  path.resolve(__dirname, "../../desktop/ui/index.html"),
).href;
async function setup(page, mode = "success") {
  await page.addInitScript((mode) => {
    window.requests = [];
    window.cinema = {
      search: async (input) => {
        window.requests.push(input);
        if (mode === "error")
          throw new Error("Brak połączenia. Spróbuj ponownie.");
        if (mode === "pending") return new Promise(() => {});
        return {
          city: input.city,
          unavailableSources:
            mode === "partial" || mode === "unavailable" ? ["Multikino"] : [],
          screenings:
            mode === "empty" || mode === "unavailable"
              ? []
              : [
                  {
                    id: 0,
                    title: "Zażółć gęślą jaźń",
                    movieKey: "zazolc gesla jazn",
                    time: "18:30",
                    cinema: "Kino Łódź",
                    address: "",
                    ticketUrl: "https://example.org/bilety",
                  },
                  {
                    id: 1,
                    title: "Zażółć gęślą jaźń",
                    movieKey: "zazolc gesla jazn",
                    time: "20:00",
                    cinema: "Kino Świat",
                    address: "Żółta 1",
                    ticketUrl: "https://example.org/bilety",
                  },
                  {
                    id: 2,
                    title: "<img src=x onerror=alert(1)>",
                    movieKey: "unsafe title",
                    time: "21:00",
                    cinema: "Kino",
                    address: "Test",
                    ticketUrl: "",
                  },
                ],
        };
      },
      detail: async () => ({ address: "ul. Żółta ąęśćńóźż 1" }),
      openTicket: async (url) => {
        window.openedTicket = url;
      },
      openMovie: async (key) => {
        window.openedMovie = key;
      },
      openPromotion: async (id) => {
        window.openedPromotion = id;
      },
      cancel: async () => {
        window.cancelled = true;
      },
      promote: async () => {
        window.promoted = true;
      },
      quit: async () => {},
    };
  }, mode);
  await page.goto(pageUrl);
}

for (const width of [320, 390, 430]) {
  test(`phone ${width}px keeps the full selection flow within the screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    const fits = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await fits();
    await page.locator("#cities button").first().click();
    await fits();
    await page.locator("#today").click();
    await page.locator("#movies .choice").first().click();
    await fits();
    await page.locator("#screenings .choice").first().click();
    await expect(page.locator("#detail-panel")).toBeVisible();
    await fits();
    await page.locator("#ticket").click();
    expect(await page.evaluate(() => window.openedTicket)).toBe(
      "https://example.org/bilety",
    );
  });
}
test("mouse-only flow preserves Polish letters and original fields", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Łódź", exact: true }).click();
  await page.getByRole("button", { name: /^Dzisiaj/ }).click();
  await expect(page.locator("#movies .choice")).toHaveCount(2);
  await expect(page.locator("#movies img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Zażółć gęślą jaźń", exact: true })
    .click();
  await expect(page.locator("#screenings .choice")).toHaveCount(2);
  await page.getByRole("button", { name: "18:30 Kino Łódź" }).click();
  await expect(page.locator("#detail-address")).toHaveText(
    "ul. Żółta ąęśćńóźż 1",
  );
  await page.getByRole("button", { name: "Otwórz bilety" }).click();
  expect(await page.evaluate(() => window.openedTicket)).toBe(
    "https://example.org/bilety",
  );
  await page.getByRole("button", { name: "Wróć do seansów" }).click();
  await page.getByRole("button", { name: "Wróć do filmów" }).click();
  await page.getByRole("button", { name: "Szukaj dalej", exact: true }).click();
  await expect(page.locator("#city-panel")).toBeVisible();
});
test("custom city and date, empty repertory and returning to date", async ({
  page,
}) => {
  await setup(page, "empty");
  await page.getByLabel("Miasto", { exact: true }).fill("Bielsko-Biała");
  await page.getByRole("button", { name: "Dalej", exact: false }).click();
  await page.getByLabel("Inna data").fill("2028-02-29");
  await page.getByRole("button", { name: "Pokaż filmy" }).click();
  await expect(page.locator("#empty")).toBeVisible();
  expect(await page.evaluate(() => window.requests[0])).toEqual({
    city: "Bielsko-Biała",
    date: "2028-02-29",
  });
  await page.getByRole("button", { name: "Zmień datę" }).click();
  await expect(page.locator("#date-panel")).toBeVisible();
});
test("network error returns to usable controls", async ({ page }) => {
  await setup(page, "error");
  await page.getByRole("button", { name: "Łódź", exact: true }).click();
  await page.getByRole("button", { name: /^Jutro/ }).click();
  await expect(page.getByRole("alert")).toContainText("Brak połączenia");
  await expect(page.locator("#date-panel")).toBeVisible();
});
test("cancel returns to date and compact window does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 600 });
  await setup(page, "pending");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Łódź", exact: true }).click();
  await page.getByRole("button", { name: /^Dzisiaj/ }).click();
  await page.getByRole("button", { name: "Anuluj pobieranie" }).click();
  await expect(page.locator("#date-panel")).toBeVisible();
  expect(await page.evaluate(() => window.cancelled)).toBe(true);
});

test("source failure is not presented as no screenings", async ({ page }) => {
  await setup(page, "unavailable");
  await page.getByRole("button", { name: "Szczecin", exact: true }).click();
  await page.getByRole("button", { name: /^Jutro/ }).click();
  await expect(page.locator("#empty")).toContainText(
    "To nie oznacza braku seansów",
  );
  await expect(page.locator("#status")).toHaveText("Problem z pobieraniem");
});

test("partial source failure keeps usable film results", async ({ page }) => {
  await setup(page, "partial");
  await page.getByRole("button", { name: "Szczecin", exact: true }).click();
  await page.getByRole("button", { name: /^Jutro/ }).click();
  await expect(page.locator("#source-warning")).toContainText("Multikino");
  await expect(page.locator("#movies .choice")).toHaveCount(2);
});

test("promotion shortcut opens a ready-to-share post and previous steps are clickable", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Nagłośnij projekt na X" }).click();
  expect(await page.evaluate(() => window.promoted)).toBe(true);
  await page.getByRole("button", { name: "Warszawa", exact: true }).click();
  await page.getByRole("button", { name: /^Dzisiaj/ }).click();
  await expect(page.locator("#movies-panel")).toBeVisible();
  await page.locator('#steps [data-stage="date"]').click();
  await expect(page.locator("#date-panel")).toBeVisible();
  expect(
    await page
      .locator('#steps [data-stage="movies"]')
      .getAttribute("aria-disabled"),
  ).toBe("true");
});

// Sprawdzamy nowe filtrowanie na tych samych danych, z których powstaje wybór seansu.
test("film cards show real counts and filtering tolerates missing Polish accents", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Łódź", exact: true }).click();
  await page.locator("#today").click();
  await expect(page.locator("#movies .choice").first()).toContainText(
    "2 seanse · 2 kina",
  );
  await expect(page.locator("#movies .choice").first()).toContainText("18:30");
  await page.getByLabel("Znajdź film").fill(" ZAZOLC ");
  await expect(page.locator("#movies .choice:visible")).toHaveCount(1);
  await expect(page.locator("#filter-count")).toHaveText("1 z 2");
  await page.getByLabel("Znajdź film").fill("Nieistniejący film");
  await expect(page.locator("#filter-empty")).toBeVisible();
  await expect(page.locator("#empty")).toBeHidden();
  await page.getByLabel("Znajdź film").fill("");
  await expect(page.locator("#movies .choice:visible")).toHaveCount(2);
  await expect(page.locator("#filter-empty")).toBeHidden();
  await page.locator("#movies .choice").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#screenings .choice")).toHaveCount(2);
  await expect(page.locator("#screenings-summary")).toContainText(
    "2 seanse do wyboru",
  );
  await page.locator('#steps [data-stage="date"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#date-panel")).toBeVisible();
  await page.locator("#tomorrow").click();
  await expect(page.getByLabel("Znajdź film")).toHaveValue("");
  await expect(page.locator("#movies .choice:visible")).toHaveCount(2);
});

test("phone choices remain large and readable across the full flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  const size = (selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => ({
        font: parseFloat(getComputedStyle(element).fontSize),
        height: element.getBoundingClientRect().height,
      }));
  const city = await size("#cities button");
  expect(city.font).toBeGreaterThanOrEqual(18);
  expect(city.height).toBeGreaterThanOrEqual(52);
  await page.locator("#cities button").first().click();
  await page.locator("#today").click();
  expect((await size("#movies strong")).font).toBeGreaterThanOrEqual(20);
  await page.locator("#movies .choice").first().click();
  expect((await size("#screenings strong")).font).toBeGreaterThanOrEqual(26);
  await page.locator("#screenings .choice").first().click();
  await expect(page.locator("#detail-address")).not.toHaveText(
    "Pobieranie adresu…",
  );
  expect((await size("#detail-address")).font).toBeGreaterThanOrEqual(18);
  expect((await size("#ticket")).height).toBeGreaterThanOrEqual(60);
});

test("promotion tab explains offers and marks matching screenings", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 9, 23, 12) });
  await setup(page);
  await page.locator("#promotions-open").click();
  await expect(page.locator("#promotions-panel")).toBeVisible();
  await expect(page.locator(".promotion-card")).toHaveCount(5);
  await expect(page.locator(".promotion-card").first()).toContainText(
    "24–25 października",
  );
  await page.getByRole("button", { name: "Multikino ↗" }).click();
  expect(await page.evaluate(() => openedPromotion)).toBe("https://www.multikino.pl/newsy/swieto-kina-powraca-caly-weekend-z-filmami-za-15-zl");
  await page
    .locator(".promotion-card")
    .first()
    .getByRole("button", { name: "Śledź tę promocję" })
    .click();
  await expect(page.locator("#city-panel")).toBeVisible();
  await page.getByRole("button", { name: "Łódź", exact: true }).click();
  await expect(page.getByLabel("Inna data")).toHaveValue("2026-10-24");
  await page.evaluate(() => {
    cinema.search = async (input) => ({
      city: input.city,
      screenings: [
        {
          id: 0,
          title: "Lalka",
          movieKey: "lalka",
          time: "18:30",
          cinema: "Multikino Łódź",
          address: "",
          ticketUrl: "https://example.org/bilet",
        },
        {
          id: 1,
          title: "Film studyjny",
          movieKey: "studyjny",
          time: "20:00",
          cinema: "Kino niezależne",
          address: "",
          ticketUrl: "",
        },
      ],
    });
  });
  await page.getByRole("button", { name: "Pokaż filmy" }).click();
  await expect(page.locator(".movie-entry").first()).toContainText(
    "Ten film wchodzi w promocję: Święto Kina",
  );
  await expect(page.locator(".movie-card").first()).toHaveClass(/promotion-eligible/);
  await expect(page.locator(".movie-entry").nth(1)).not.toContainText(
    "wchodzi w promocję:",
  );
  await page.getByRole("button", { name: "Lalka", exact: true }).click();
  await expect(page.locator("#screenings .promotion-eligible")).toHaveCount(1);
  await page.locator("#screenings .promotion-eligible").click();
  await expect(page.locator("#detail-promotion")).toContainText(
    "Ostateczną cenę",
  );
});
// Granice pory dnia sprawdzamy lokalnym zegarem, bez zależności od godziny uruchomienia testu.
for (const [hour, greeting, period, icon] of [
  [5, "DOBRY WIECZÓR", "EVENING.", "☾"],
  [6, "DZIEŃ DOBRY", "DAY.", "☀"],
  [17, "DZIEŃ DOBRY", "DAY.", "☀"],
  [18, "DOBRY WIECZÓR", "EVENING.", "☾"],
]) {
  test(`local greeting and today icon agree at ${hour}:00`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 9, 22, hour, 0) });
    await setup(page);
    await expect(page.locator("#greeting")).toHaveText(greeting);
    await expect(page.locator("#screen-period")).toHaveText(period);
    await expect(page.locator("#today-icon")).toHaveText(icon);
    await expect(page.locator("#tomorrow .date-icon")).toBeEmpty();
  });
}

test("greeting updates across evening and midnight without reloading", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 9, 22, 17, 59, 50) });
  await setup(page);
  await page.clock.fastForward(60000);
  await expect(page.locator("#greeting")).toHaveText("DOBRY WIECZÓR");
  await page.clock.fastForward(6 * 60 * 60 * 1000);
  await expect(page.locator("#today-label")).toHaveText("23 października 2026");
  await page.clock.fastForward(6 * 60 * 60 * 1000);
  await expect(page.locator("#greeting")).toHaveText("DZIEŃ DOBRY");
});

test("offline search shows connection message and retries only on request", async ({
  page,
  context,
}) => {
  await setup(page);
  await context.setOffline(true);
  await page.locator("#cities button").first().click();
  await page.locator("#today").click();
  await expect(page.locator("#connection-status")).toBeVisible();
  await expect(page.locator("#connection-status")).toContainText(
    "Problem z połączeniem",
  );
  await expect(page.locator("#retry-search")).toBeDisabled();
  expect(await page.evaluate(() => requests.length)).toBe(0);
  await context.setOffline(false);
  await expect(page.locator("#retry-search")).toBeEnabled();
  expect(await page.evaluate(() => requests.length)).toBe(0);
  await page.locator("#retry-search").click();
  await expect(page.locator("#movies-panel")).toBeVisible();
  expect(await page.evaluate(() => requests.length)).toBe(1);
});

test("losing connection cancels the pending search and ignores its late reply", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.evaluate(() => {
    cinema.search = () =>
      new Promise((resolve) => {
        window.finishSearch = resolve;
      });
  });
  await page.locator("#cities button").first().click();
  await page.locator("#today").click();
  await expect(page.locator("#loading-panel")).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator("#connection-status")).toContainText(
    "Problem z połączeniem",
  );
  expect(await page.evaluate(() => cancelled)).toBe(true);
  await page.evaluate(() => finishSearch({ city: "Warszawa", screenings: [] }));
  await expect(page.locator("#loading-panel")).toBeVisible();
  await page.locator("#cancel").click();
  await expect(page.locator("#date-panel")).toBeVisible();
});

test("poster failures keep a neat fallback and movie lookup does not select a screening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route("https://img.helios.pl/good.jpg", (route) =>
    route.fulfill({
      path: path.resolve("desktop/ui/icon.png"),
      contentType: "image/png",
    }),
  );
  await page.route("https://www.multikino.pl/missing.jpg", (route) =>
    route.abort(),
  );
  await setup(page);
  await page.evaluate(() => {
    cinema.search = async (input) => ({
      city: input.city,
      screenings: [
        {
          id: 0,
          title: "Dobry film",
          movieKey: "good",
          time: "18:00",
          cinema: "Kino",
          posterUrl: "https://img.helios.pl/good.jpg",
        },
        {
          id: 1,
          title: "Brak obrazu",
          movieKey: "missing",
          time: "19:00",
          cinema: "Kino",
          posterUrl: "https://www.multikino.pl/missing.jpg",
        },
        {
          id: 2,
          title: "Obcy obraz",
          movieKey: "foreign",
          time: "20:00",
          cinema: "Kino",
          posterUrl: "https://example.org/random.jpg",
        },
      ],
    });
  });
  await page.locator("#cities button").first().click();
  await page.locator("#today").click();
  const entries = page.locator(".movie-entry");
  await expect(entries.nth(0).locator("img")).toBeVisible();
  expect(
    await entries
      .nth(0)
      .locator("img")
      .evaluate((img) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await entries.nth(1).scrollIntoViewIfNeeded();
  await expect(entries.nth(1).locator("img")).toHaveCount(0);
  await expect(entries.nth(1).locator(".poster-caption")).toHaveText("W KINIE");
  await expect(entries.nth(2).locator("img")).toHaveCount(0);
  await entries.nth(0).locator(".movie-info").click();
  expect(await page.evaluate(() => openedMovie)).toBe("good");
  await expect(page.locator("#movies-panel")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
