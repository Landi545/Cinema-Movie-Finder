const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Backend, validSearch, safeUrl } = require('./bridge.cjs');

// Keep Electron's user-data location deterministic so the uninstaller can remove
// only this application's data and never a shared Electron directory.
app.setName('Cinema Movie Finder');

const page = path.join(__dirname, 'ui', 'index.html');
// Udostępniamy publiczne repozytorium; użytkownik sam zatwierdza post na X.
const promotionUrl = `https://x.com/intent/post?text=${encodeURIComponent('Zobaczcie Cinema Movie Finder — prostą aplikację do znajdowania seansów kinowych w Polsce. Sprawdźcie projekt i dajcie znać, co myślicie! https://github.com/Landi545/Cinema-Movie-Finder')}`;
let backend;
let tickets = new Set();
// IPC przyjmujemy wyłącznie z głównej ramki lokalnego interfejsu.
function trusted(event) {
  if (event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== pathToFileURL(page).href)
    throw new Error('Niedozwolone żądanie.');
}
app.whenReady().then(() => {
  const executable = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'cinema_movie_finder.exe')
    : path.join(__dirname, '..', 'package', 'windows', 'payload', 'Cinema Movie Finder Files', 'cinema_movie_finder.exe');
  backend = new Backend(executable);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle('search', async (event, input) => {
    trusted(event);
    if (!validSearch(input)) throw new Error('Podaj miasto i poprawną datę.');
    tickets.clear();
    const result = await backend.request({ command: 'search', city: input.city, date: input.date });
    // Przeglądarka może otworzyć tylko adres otrzymany w bieżących wynikach.
    tickets = new Set(result.screenings.map(row => row.ticketUrl).filter(safeUrl));
    return result;
  });
  ipcMain.handle('detail', (event, id) => {
    trusted(event);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error('Wybierz seans ponownie.');
    return backend.request({ command: 'detail', id });
  });
  ipcMain.handle('cancel', event => { trusted(event); backend.stop(); tickets.clear(); });
  ipcMain.handle('open-ticket', async (event, url) => {
    trusted(event);
    if (!safeUrl(url) || !tickets.has(url)) throw new Error('Nieprawidłowy adres biletów.');
    await shell.openExternal(url);
  });
  ipcMain.handle('promote', async event => {
    trusted(event);
    await shell.openExternal(promotionUrl);
  });
  ipcMain.handle('quit', event => { trusted(event); app.quit(); });
  const window = new BrowserWindow({
    width: 1100, height: 780, minWidth: 720, minHeight: 600,
    title: 'Cinema Movie Finder', backgroundColor: '#ddd0b7',
    icon: path.join(__dirname, '..', 'package', 'windows', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(page);
});
app.on('before-quit', () => backend?.stop());
app.on('window-all-closed', () => app.quit());
