// UI tests use local HTML in Chromium; smoke.cjs tests the packaged app.
module.exports = { testDir: './tests/ui', use: { browserName: 'chromium', viewport: { width: 1100, height: 780 } }, reporter: 'list' };
