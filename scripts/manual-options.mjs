import { resolve } from 'node:path';

export const MANUAL_HELP = `Usage:
  npm run build
  npm run build -- --manual [--browser edge|chrome|/path/to/executable] [--port 9225] [--url WME_URL]

Manual mode opens a dedicated persistent browser profile. Sign in to WME first,
then press Enter in this terminal to attach and inject the built userscript.
Keep the command running to inject the latest build after each WME refresh.
WME_BROWSER_PATH and WME_URL supply defaults for --browser and --url.
Chrome/Edge and other Chromium browsers are supported; Firefox/Safari are not.
`;

export function isWmeUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.waze.com'
      && /^\/(?:[^/]+\/)?editor(?:\/|$)/.test(url.pathname)
      && !/^\/(?:[^/]+\/)?editor\/(?:sdk|profile)(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}

export function parseBuildOptions(args, env = process.env) {
  const options = {manual:false, help:false, browser:env.WME_BROWSER_PATH || 'edge',
    port:9225, url:env.WME_URL || 'https://www.waze.com/editor?env=row&lon=121.5155452&lat=25.0465418&zoomLevel=18'};
  let custom = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--manual') options.manual = true;
    else if (flag === '--help' || flag === '-h') options.help = true;
    else if (['--browser','--port','--url'].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
      custom = true;
      if (flag === '--port') {
        if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error('--port must be an integer from 1024 to 65535.');
        options.port = Number(value);
      } else options[flag.slice(2)] = value;
    } else throw new Error(`Unknown build option: ${flag}. Use --help for usage.`);
  }
  if (custom && !options.manual && !options.help) throw new Error('Browser options require --manual.');
  if (options.manual && !isWmeUrl(options.url)) throw new Error('--url must be a production WME editor URL (not SDK documentation or a profile).');
  return options;
}

export function browserExecutable(browser, platform = process.platform, env = process.env) {
  if (browser !== 'edge' && browser !== 'chrome') {
    if (platform === 'darwin' && browser.endsWith('.app')) {
      const name = browser.split('/').at(-1).slice(0,-4);
      return resolve(browser, 'Contents', 'MacOS', name);
    }
    return browser;
  }
  if (platform === 'darwin') return browser === 'edge'
    ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (platform === 'win32') return browser === 'edge'
    ? `${env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`
    : `${env.PROGRAMFILES || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`;
  return browser === 'edge' ? 'microsoft-edge' : 'google-chrome';
}
