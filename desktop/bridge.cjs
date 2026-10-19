const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');

// Most do desktop/backend.h: jeden proces i najwyżej jedno oczekujące żądanie.
class Backend {
  constructor(executable, spawnProcess = spawn) {
    this.executable = executable;
    this.spawnProcess = spawnProcess;
    this.child = null;
    this.pending = null;
  }
  start() {
    const child = this.spawnProcess(this.executable, ['--gui'], {
      cwd: path.dirname(this.executable), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      // Zdarzenia starego procesu nie mogą zakończyć żądania nowej sesji.
      if (this.child !== child || !this.pending) return;
      let result;
      try { result = JSON.parse(line); }
      catch { this.stop(new Error('Nie udało się odczytać repertuaru. Spróbuj ponownie.')); return; }
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      if (result.error) pending.reject(new Error(result.error));
      else pending.resolve(result);
    });
    // Odbieramy dane diagnostyczne bez ujawniania pobranej treści interfejsowi.
    child.stderr.resume();
    child.stdin.on('error', () => { if (this.child === child) this.stop(new Error('Połączenie z wyszukiwarką zostało przerwane.')); });
    child.on('error', () => { if (this.child === child) this.stop(new Error('Nie można uruchomić wyszukiwarki. Zainstaluj aplikację ponownie.')); });
    child.on('exit', () => { if (this.child === child) this.stop(new Error('Wyszukiwarka została zamknięta. Wyszukaj ponownie.')); });
  }
  request(message) {
    if (this.pending) return Promise.reject(new Error('Poczekaj na zakończenie pobierania.'));
    if (!this.child) this.start();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(new Error('Pobieranie trwa zbyt długo. Sprawdź internet i spróbuj ponownie.')), 300000);
      this.pending = { resolve, reject, timer };
      this.child.stdin.write(JSON.stringify(message) + '\n', 'utf8');
    });
  }
  // Anulowanie unieważnia proces i odrzuca oczekującą odpowiedź.
  stop(error = new Error('Anulowano pobieranie.')) {
    const child = this.child;
    this.child = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
    if (child) child.kill();
  }
}

// Sprawdzamy dane przed uruchomieniem silnika; C++ dodatkowo sprawdza własne wejście.
function validSearch(input) {
  if (!input || typeof input.city !== 'string' || !input.city.trim() ||
      input.city.length > 100 || /[\x00-\x1f]/.test(input.city) ||
      typeof input.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(input.date)) return false;
  const date = new Date(input.date + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === input.date;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
module.exports = { Backend, validSearch, safeUrl };
