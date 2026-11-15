import type { AsyncWmeSDK } from '@waze-editor/sdk-typings';
import { SCRIPT_ID, SCRIPT_NAME } from './constants';
import { Controller } from './controller';
import { bindMap } from './adapter';
import { mountSidebar } from './sidebar';
import { injectStyles } from './styles';
import { mountFloatingPanel } from './floating-panel';

// The official global declaration currently omits the documented async overload.
type PageWindow = Window & { unsafeWindow?: Window; spoMounted?: boolean };
async function main() {
  const page = (window as PageWindow).unsafeWindow ?? window;
  if ((page as PageWindow).spoMounted) return;
  (page as PageWindow).spoMounted = true;
  try {
    await page.SDK_INITIALIZED;
    const getSdk = page.getWmeSdk as unknown as (options: { scriptId: string; scriptName: string; mode: 'async' }) => AsyncWmeSDK;
    if (!getSdk) throw new Error('WME SDK is unavailable.');
    const sdk = getSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME, mode: 'async' });
    if (!await sdk.State.isReady()) await sdk.Events.once({ eventName: 'wme-ready' });
    injectStyles();
    const controller = new Controller();
    await bindMap(sdk, controller);
    const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();
    tabLabel.textContent = '台灣速限標牌疊圖'; tabLabel.classList.add('spo-tab-label'); mountSidebar(tabPane, controller);
    mountFloatingPanel(controller, await sdk.Map.getMapViewportElement());
    void controller.restoreFile();
  } catch (error) { (page as PageWindow).spoMounted = false; console.error(`[${SCRIPT_ID}]`, error); }
}
void main();
