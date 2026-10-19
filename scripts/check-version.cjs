// Blokujemy wydanie, gdy wersje pakietu, pliku blokady zależności, instalatora i tagu się różnią.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lockJson = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const installer = fs.readFileSync(path.join(root, 'package/windows/CinemaMovieFinder.iss'), 'utf8');
const version = packageJson.version;
const errors = [];

if (lockJson.version !== version || lockJson.packages?.['']?.version !== version)
  errors.push(`package-lock.json does not match package.json (${version})`);
if (!installer.includes(`#define AppVersion "${version}"`))
  errors.push(`Inno Setup script does not contain AppVersion ${version}`);

const ref = process.env.GITHUB_REF ?? '';
if (ref.startsWith('refs/tags/v') && ref !== `refs/tags/v${version}`)
  errors.push(`Git tag ${ref} does not match project version v${version}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Version consistency check passed: v${version}`);
