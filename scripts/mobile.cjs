// Generowane projekty zawierają tylko obudowę; źródła interfejsu i silnika są wspólne.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const platform = process.argv[2];
if (platform && platform !== 'android') throw new Error('Wybierz android.');
fs.mkdirSync('dist/mobile', { recursive: true });
fs.mkdirSync('dist/mobile/licenses', { recursive: true });
fs.copyFileSync('LICENSE', 'dist/mobile/licenses/CinemaMovieFinder.txt');
fs.copyFileSync('mobile/compatibility.html', 'dist/mobile/compatibility.html');
for (const name of ['core', 'app', 'browser', 'android']) {
  fs.copyFileSync(`node_modules/@capacitor/${name}/LICENSE`, `dist/mobile/licenses/capacitor-${name}.txt`);
}
if (fs.existsSync('build/native/licenses')) fs.cpSync('build/native/licenses', 'dist/mobile/licenses', { recursive: true });
for (const name of ['index.html', 'style.css', 'app.js', 'icon.png', 'promotions.json']) fs.copyFileSync(`desktop/ui/${name}`, `dist/mobile/${name}`);
const html = fs.readFileSync('dist/mobile/index.html', 'utf8')
  .replace('<script src="app.js"', '<script src="mobile.js" defer></script>\n    <script src="app.js"')
  .replace("connect-src 'none'", "connect-src 'self' https://localhost capacitor://localhost https://raw.githubusercontent.com");
fs.writeFileSync('dist/mobile/index.html', html);
buildSync({ entryPoints: ['mobile/app.js'], outfile: 'dist/mobile/mobile.js', bundle: true, target: ['safari15', 'chrome100'] });
// Ten sam próg co most natywny; nie polegamy na wersji Chrome komputera autora.
buildSync({ entryPoints: ['desktop/ui/app.js'], outfile: 'dist/mobile/app.js', target: ['chrome100'] });
if (!platform) process.exit(0);
const cap = (...args) => execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', ...args], { stdio: 'inherit' });
if (!fs.existsSync(platform)) cap('add', platform);
cap('sync', platform);
const { version } = require('../package.json');
// Wykorzystujemy największy obraz PNG z istniejącej ikony Windows.
const ico = fs.readFileSync('package/windows/icon.ico');
const entry = 6 + (ico.readUInt16LE(4) - 1) * 16;
const offset = ico.readUInt32LE(entry + 12);
const icon = ico.subarray(offset, offset + ico.readUInt32LE(entry + 8));
if (platform === 'android') {
  const file = 'android/app/build.gradle';
  const [major, minor, patch] = version.split('.').map(Number);
  let gradle = fs.readFileSync(file, 'utf8').replace(/versionCode \d+/, `versionCode ${major * 1000000 + minor * 1000 + patch}`).replace(/versionName "[^"]+"/, `versionName "${version}"`);
  if (!gradle.includes('mobile/android.gradle')) gradle += "\napply from: '../../mobile/android.gradle'\n";
  fs.writeFileSync(file, gradle);
  const res = 'android/app/src/main/res';
  fs.writeFileSync(`${res}/drawable/cinema_icon.png`, icon);
  fs.writeFileSync(`${res}/drawable/cinema_foreground.xml`, '<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@drawable/cinema_icon" android:inset="18%" />');
  fs.writeFileSync(`${res}/values/cinema.xml`, '<resources><color name="cinema_paper">#f5f3ef</color></resources>');
  for (const directory of fs.readdirSync(res).filter(name => name.startsWith('mipmap-'))) {
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      const png = `${res}/${directory}/${name}.png`, xml = `${res}/${directory}/${name}.xml`;
      if (fs.existsSync(png)) fs.writeFileSync(png, icon);
      if (fs.existsSync(xml)) fs.writeFileSync(xml, '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/cinema_paper"/><foreground android:drawable="@drawable/cinema_foreground"/></adaptive-icon>');
    }
  }
  const styles = `${res}/values/styles.xml`;
  fs.writeFileSync(styles, fs.readFileSync(styles, 'utf8').replace('@drawable/splash', '@color/cinema_paper'));
}
