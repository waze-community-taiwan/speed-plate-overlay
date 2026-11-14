import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const profile = new URL('../../.wme-test-profile-normal/', import.meta.url).pathname;
await mkdir(profile, { recursive: true });
// Launch the browser normally. Attach the verifier only after manual login.
const browser = spawn(process.env.WME_BROWSER_PATH ?? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', [
  `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9224',
  process.env.WME_URL ?? 'https://www.waze.com/editor?env=row&lon=121.5155452&lat=25.0465418&zoomLevel=18',
], { stdio: 'ignore' });
browser.on('error', error => { console.error(error); process.exitCode = 1; });
console.log('Normal Edge test window opened. Log in via Waze QR code or your usual supported method.');
await new Promise(resolve => browser.on('exit', resolve));
