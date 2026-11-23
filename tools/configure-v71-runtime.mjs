import fs from 'node:fs';
import path from 'node:path';
const url = String(process.env.VITE_BACKEND_URL || '').trim();
if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
  throw new Error('VITE_BACKEND_URL must be a supported Apps Script deployment URL, or omitted.');
}
const dest = path.resolve('frontend/public/v71/runtime-config.js');
fs.writeFileSync(dest, '// Public API URL only. Never put credentials in a public frontend.\n' +
  'window.__V71_API_BASE_URL__ = ' + JSON.stringify(url) + ';\n', 'utf8');
console.log('v71 mirror:', url ? 'configured with existing read-only API URL' : 'unconfigured');
