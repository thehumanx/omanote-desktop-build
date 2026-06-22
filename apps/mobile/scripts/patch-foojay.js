/**
 * Patches foojay-resolver-convention from 0.5.0 → 0.9.0 inside
 * @react-native/gradle-plugin so it works with Gradle 9.x.
 *
 * Gradle 9 removed JvmVendorSpec.IBM_SEMERU. foojay 0.9.0 uses the new
 * string-based vendor API and works with Gradle 9.x.
 *
 * This runs automatically after every `npm install` via the postinstall hook.
 */

const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '../node_modules/@react-native/gradle-plugin/settings.gradle.kts'
);

if (!fs.existsSync(target)) {
  console.log('[patch-foojay] File not found, skipping.');
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
const patched = original.replace(
  /foojay-resolver-convention"\)\.version\("[^"]+"\)/,
  'foojay-resolver-convention").version("0.9.0")'
);

if (original === patched) {
  console.log('[patch-foojay] Already patched or pattern not found, skipping.');
} else {
  fs.writeFileSync(target, patched);
  console.log('[patch-foojay] ✓ foojay updated to 0.9.0 (Gradle 9 compatible)');
}
