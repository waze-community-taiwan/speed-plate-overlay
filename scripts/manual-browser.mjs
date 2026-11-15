import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { browserExecutable, isWmeUrl } from './manual-options.mjs';

const bundlePath = new URL('../dist/wme-speed-plate-overlay.user.js', import.meta.url);

// Each navigation reads the current build. No installation or WME edits are needed.
export async function installManualInjection(browser, {matches = isWmeUrl, bundle = bundlePath, log = console.log} = {}) {
  const subscriptions = [];
  function watch(page) {
    let generation = 0;
    async function inject() {
      const token = ++generation;
      if (!matches(page.url())) return;
      try {
        await page.waitForFunction(() => !!window.SDK_INITIALIZED && typeof window.getWmeSdk === 'function', null, {timeout:120000});
        const source = await readFile(bundle, 'utf8');
        if (token !== generation || page.isClosed() || !matches(page.url())) return;
        if (await page.evaluate(() => !!window.spoMounted)) {
          log('Speed Plate Overlay is already loaded. To review a new build, refresh WME. Disable any installed copy in this test profile.');
          return;
        }
        await page.addScriptTag({content:source});
        await page.waitForSelector('.spo-file', {state:'attached', timeout:30000});
        log('Built userscript loaded. Open Scripts → 台灣速限標牌疊圖.');
      } catch (error) {
        if (token === generation && !page.isClosed()) log(`Manual injection: ${error.message}. Wait for WME to finish loading, then refresh to retry.`);
      }
    }
    page.on('domcontentloaded', inject);
    subscriptions.push(() => { generation++; page.off('domcontentloaded', inject); });
    void inject();
  }
  for (const context of browser.contexts()) {
    context.on('page', watch);
    subscriptions.push(() => context.off('page', watch));
    for (const page of context.pages()) watch(page);
  }
  return () => subscriptions.forEach(unsubscribe => unsubscribe());
}

async function ensureFreePort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`Port ${port} is already in use. Close the previous manual browser or use --port with another number.`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => server.close(resolve));
}

export async function runManualBrowser(options) {
  if (!process.stdin.isTTY) throw new Error('Manual mode needs an interactive terminal. Run npm run build -- --manual in your terminal.');
  await ensureFreePort(options.port);
  const profile = fileURLToPath(new URL(`../.wme-manual-profile-${options.port}/`, import.meta.url));
  await mkdir(profile, {recursive:true});
  const executable = browserExecutable(options.browser);
  // Deliberately launch normally and attach only after the user finishes SSO.
  const child = spawn(executable, [
    `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${options.port}`, '--no-first-run', options.url,
  ], {stdio:'ignore', detached:true});
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', error => reject(new Error(`Could not launch ${executable}: ${error.message}. Set --browser to your browser executable.`))); });
  child.unref();
  console.log(`Opened ${executable}\nDedicated profile: ${profile}\nSign in to WME in that window and wait for the map to load.`);
  console.log('No automation is attached during sign-in. Google SSO acceptance still depends on Google and your browser.');
  const input = createInterface({input:process.stdin, output:process.stdout});
  try { await input.question('After signing in, press Enter here to inject the built userscript: '); }
  finally { input.close(); }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${options.port}`, {timeout:15000});
  const unsubscribe = await installManualInjection(browser);
  console.log('Manual review is active. Keep this terminal running. Refresh WME after rebuilding to load the latest bundle. Ctrl+C stops injection.');
  await new Promise(resolve => {
    const stop = () => { unsubscribe(); child.unref(); resolve(); };
    browser.once('disconnected', stop);
    process.once('SIGINT', () => { stop(); process.exit(0); });
    process.once('SIGTERM', () => { stop(); process.exit(0); });
  });
}
