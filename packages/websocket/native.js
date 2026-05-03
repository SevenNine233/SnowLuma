import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.join(__dirname, '..', 'build', 'Release', 'snowluma_ws.node'),
  path.join(__dirname, '..', 'build', 'Debug', 'snowluma_ws.node'),
];

let addon = null;
let lastErr = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    try {
      addon = require(p);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
}
if (!addon) {
  throw new Error(
    'Failed to load native snowluma_ws addon. Run `npm run build` first. ' +
      (lastErr ? `Last error: ${lastErr.message}` : ''),
  );
}

export default addon;
