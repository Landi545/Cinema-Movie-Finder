// Pakowanie wymaga zbudowanego silnika, bibliotek DLL i certyfikatów urzędów certyfikacji.
const path = require('node:path');
const fs = require('node:fs/promises');
async function main() {
  const { packager } = await import('@electron/packager');
  const root = path.resolve(__dirname, '..');
  const native = path.join(root, 'package/windows/payload/Cinema Movie Finder Files');
  await fs.access(path.join(native, 'cinema_movie_finder.exe'));
  const outputs = await packager({
    dir: root, name: 'CinemaMovieFinder', platform: 'win32', arch: 'x64',
    out: path.join(root, 'dist'), overwrite: true, asar: true,
    // Parser HTML jest częścią pakietu, mimo że nie kopiujemy całego node_modules.
    afterCopy: [async ({ buildPath }) => {
      await require('esbuild').build({
        entryPoints: [path.join(root, 'desktop/release-calendar.cjs')],
        outfile: path.join(buildPath, 'desktop/release-calendar.cjs'),
        bundle: true, platform: 'node', format: 'cjs', target: 'node22',
      });
      require('./parser-licenses.cjs')(path.join(buildPath, 'licenses'));
    }],
    icon: path.join(root, 'package/windows/icon.ico'),
    ignore: [/^\/(\.git|\.github|\.vscode|tests|scripts|test-results|playwright-report|output|dist|node_modules|mobile|android|build)(\/|$)/,
      /^\/package\/windows\/(?!icon\.ico$)/, /^\/(main\.cpp|Makefile|playwright\.config\.cjs|package-lock\.json|capacitor\.config\.json)$/],
    win32metadata: { CompanyName: 'Cinema Movie Finder', FileDescription: 'Cinema Movie Finder', ProductName: 'Cinema Movie Finder' }
  });
  await fs.cp(native, path.join(outputs[0], 'resources/backend'), { recursive: true });
  console.log('Packaged:', outputs[0]);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
