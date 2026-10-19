// Generowane projekty zawierają tylko obudowę; źródła interfejsu i silnika są wspólne.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const platform = process.argv[2];
if (platform && !['android', 'ios'].includes(platform)) throw new Error('Wybierz android lub ios.');
fs.mkdirSync('dist/mobile', { recursive: true });
for (const name of ['index.html', 'style.css', 'app.js']) fs.copyFileSync(`desktop/ui/${name}`, `dist/mobile/${name}`);
const html = fs.readFileSync('dist/mobile/index.html', 'utf8')
  .replace('<script src="app.js"', '<script src="mobile.js" defer></script>\n    <script src="app.js"')
  .replace("connect-src 'none'", "connect-src 'self' https://localhost capacitor://localhost");
fs.writeFileSync('dist/mobile/index.html', html);
buildSync({ entryPoints: ['mobile/app.js'], outfile: 'dist/mobile/mobile.js', bundle: true, target: ['safari15', 'chrome100'] });
if (!platform) process.exit(0);
const cap = (...args) => execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', ...args], { stdio: 'inherit' });
if (!fs.existsSync(platform)) cap('add', platform, ...(platform === 'ios' ? ['--packagemanager', 'Cocoapods'] : []));
cap('sync', platform);
const { version } = require('../package.json');
if (platform === 'android') {
  const file = 'android/app/build.gradle';
  const [major, minor, patch] = version.split('.').map(Number);
  let gradle = fs.readFileSync(file, 'utf8').replace(/versionCode \d+/, `versionCode ${major * 1000000 + minor * 1000 + patch}`).replace(/versionName "[^"]+"/, `versionName "${version}"`);
  if (!gradle.includes('mobile/android.gradle')) gradle += "\napply from: '../../mobile/android.gradle'\n";
  fs.writeFileSync(file, gradle);
} else {
  const file = 'ios/App/App.xcodeproj/project.pbxproj';
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
}
