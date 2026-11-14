import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/mock-wme-sdk.html', [new URL('./mock-wme-sdk.html', import.meta.url), 'text/html']],
  ['/dist/wme-speed-plate-overlay.user.js', [new URL('../../dist/wme-speed-plate-overlay.user.js', import.meta.url), 'text/javascript']],
]);
createServer(async (req, res) => {
  const file = files.get(req.url?.split('?')[0]);
  if (!file) { res.writeHead(404).end(); return; }
  try { res.setHeader('Content-Type', file[1]); res.end(await readFile(file[0])); }
  catch { res.writeHead(404).end(); }
}).listen(8765, '127.0.0.1');
