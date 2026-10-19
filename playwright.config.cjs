// Testy interfejsu używają lokalnego HTML w Chromium; smoke.cjs sprawdza gotową paczkę.
module.exports = { testDir: './tests/ui', use: { browserName: 'chromium', viewport: { width: 1100, height: 780 } }, reporter: 'list' };
