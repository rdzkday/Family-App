/*
 * Salin public/core.js ke semua tempat yang memakainya, supaya satu sumber kebenaran:
 *   - supabase/functions/kantong/core.mjs  (Edge Function, ditambah export)
 *   - kantong/apps-script/Core.gs          (backend lama Google Sheets)
 * Jalankan: node kantong/tools/build_core.js   (test_core.js memeriksa semuanya sinkron)
 */
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var src = fs.readFileSync(path.join(ROOT, 'public/core.js'), 'utf8');
var targets = module.exports.targets = {
  'supabase/functions/kantong/core.mjs': '// DIBUAT OTOMATIS dari public/core.js. Jangan diedit di sini. Jalankan: node kantong/tools/build_core.js\n' +
    src.replace("if (typeof module !== 'undefined' && module.exports) module.exports = KantongCore;\n", '') +
    'export default KantongCore;\n',
  'kantong/apps-script/Core.gs': src
};
if (require.main === module) {
  Object.keys(targets).forEach(function (f) { fs.writeFileSync(path.join(ROOT, f), targets[f]); console.log('ditulis', f); });
}
