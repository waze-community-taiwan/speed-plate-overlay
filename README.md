# Taiwan Speed Plate Overlay

A Tampermonkey userscript that displays government speed-limit plates in a separate WME SDK map layer. It never writes road data or calls WME editing/save APIs.

Install from [Greasy Fork](https://greasyfork.org/en/scripts/605482-taiwan-speed-plate-overlay).

## Install and use

1. Install Tampermonkey in your browser. Enable its userscript permission if your browser requests it.
2. Install [Taiwan Speed Plate Overlay from Greasy Fork](https://greasyfork.org/en/scripts/605482-taiwan-speed-plate-overlay). For local development, use Node 22, `npm ci`, and `npm run build`; load `dist/wme-speed-plate-overlay.user.js` in Tampermonkey.
3. Open production WME and log in. Under the Scripts sidebar, choose **台灣速限標牌疊圖**.
4. Choose your downloaded UTF-8 government CSV. Loading a valid file enables its layer. Files are read locally, never uploaded or fetched from a third party.
5. Use **Show speed plates** to hide/show the overlay. The compact stacked-layer icon beside **Force on top** sets the overlay above normal map layers; turning it off restores the SDK-assigned layer order. The icon follows NLSC Overlay's styling and turns orange when pressed.
6. The **Speed Plates** control is shown on the map by default. Drag its header to move it, or focus the title and use arrow keys (Home resets its position). The same stacked-layer icon beside **On top** works without opening the sidebar. The panel follows NLSC Overlay’s floating style: 200px wide, 13px text, a shaded drag header, a separate padded control row, and a transparent SVG close button. Closing/hiding the panel resets its position; restore it with **Show floating controls**. **Floating opacity** adjusts it from 10% to 100%. Its hidden state and opacity are saved; the dragged position lasts until the panel is closed or WME reloads.
7. In the always-expanded **Plate appearance** card, choose **Arrow style** (four directions by default, or the original clockwise/counter-clockwise icons), choose one of four badge corners (default: **Bottom right**), choose separate **Clockwise badge color** and **Counter-clockwise badge color**, adjust **Plate size** from 25% to 400%, and adjust **Speed value size** from 25% to 200%. Both sliders put 100% at their center while keeping their full ranges; percentage labels and accessible values report the actual size. The 100% / 100% baseline matches the former 100% plate / 150% speed-value appearance. **Reset sizes** restores both to 100%. Long values are fitted inside the circle.
8. Click a plate for a details bubble whose width fits its content, capped at 360px and constrained to the viewport. Use the always-expanded **Popup columns** card to select fields and drag their right-hand **⋮⋮** grips to reorder them. The borderless grips follow NLSC Overlay's styling. Keyboard users can focus a grip and use **Alt + ↑ / ↓**. Field selection and order are saved separately. **Reset order** restores the original CSV column order without changing which fields are selected. Outside clicks, Escape, the close button, or panning dismiss the bubble; click a plate again after changing fields to view the new layout.

Preferences and the last successfully imported CSV survive reload. CSV files are saved automatically in IndexedDB on this device, in the current browser profile under the WME origin, and restored after WME is ready. **Clear saved CSV** removes the saved copy and overlay. Invalid replacements preserve the saved dataset as well as the active overlay. The saved copy is a snapshot; changes to the original file require another import. Clearing Waze site data, private browsing, storage eviction, or unavailable storage can require importing again. Storage failures leave a valid imported overlay usable and display a message. Maximum file size is 30 MB. Large datasets can take time to render.

## Data and direction

The sample is `input/plate-data-20261114.csv` (not committed). Required columns accept these names:

| Field | Government header | Other supported headers |
| --- | --- | --- |
| Longitude | 坐標-E-WGS84 | 經度, longitude, lon, lng |
| Latitude | 坐標-N-WGS84 | 緯度, latitude, lat |
| Speed | 牌面內容 | 速限, speed, speed_limit |
| Direction | 牌面方向 | 方向, direction |

Coordinates must be decimal WGS84 degrees. TWD97 coordinates are not silently substituted. Blank, nonnumeric, out-of-range coordinates and inconsistent row widths are counted and skipped. Missing or duplicate headers and unterminated quotes produce an error.

Markers show only the speed inside a red circle. A separate badge uses the numeric part of `公路編號` and `牌面方向`: even highways (台2, 台4, 台6) show → for `順向` and ← for `逆向`; odd highways (台1, 台3) show ↓ for `順向` and ↑ for `逆向`. Branch and temporary-route suffixes use the parent highway number (台2甲 follows 台2). Missing/unrecognized road numbers or directions show `?`. Direction colors default to green (`#34c759`) and orange (`#ff9500`), can be changed independently, and are saved. Clockwise (`順向`) and counter-clockwise (`逆向`) describe the direction the plate faces relative to the source road reference. The optional circular style shows ↻ / ↺ for these values even when no road number is available; the choice is saved and also applies to popup titles. Arrow strokes in both styles automatically use whichever of black or white has higher contrast against the chosen badge color. The explanation below **Arrow style** follows the selected mode. Four-direction arrows show the applicable traffic direction (↑ northbound, → eastbound, ↓ southbound, ← westbound), derived from the highway-number convention. Circular arrows show the plate’s facing direction; approaching traffic travels in the opposite direction. For example, a clockwise-facing plate may face south and apply to northbound traffic. Keep original direction and road/chainage columns visible when interpreting a plate.

## Design and SDK boundary

`src/controller.ts` owns state; `src/sidebar.ts` and `src/floating-panel.ts` render it; `src/adapter.ts` uses only the public SDK Map and Events APIs. Bootstrap uses the recommended async SDK mode and waits for WME readiness. The official typings omit the async global factory overload, so a narrow factory assertion expresses that documented overload. Settings use a namespaced key; preferences use localStorage and the CSV uses a separate IndexedDB database. CSV popup text uses `textContent`; SVG marker text is XML-escaped.

WME can place a transparent interaction layer above the marker DOM. The adapter therefore handles both SDK feature clicks and SDK map clicks through public SDK coordinate conversion. Hit testing follows the chosen badge corner and marker scale. Appearance changes redraw the existing layer using SDK style contexts without re-importing the CSV. No private map objects or WME editing APIs are used.

UI follows `docs/PLUGIN-STYLE-AND-TESTING-SPEC.md`: compact 13px sidebar, 12px gutters, rounded cards, green switch, orange pressed mode, WME theme variables, and keyboard focus styles.

Official references: [initialization and events](https://www.waze.com/editor/sdk/), [Map](https://www.waze.com/editor/sdk/classes/index.SDK.Map.html), [Sidebar](https://www.waze.com/editor/sdk/classes/index.SDK.Sidebar.html), [changelog](https://www.waze.com/editor/sdk/documents/CHANGELOG.html).

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests execute the production bundle against a deterministic SDK fixture. macOS uses installed Edge by default; set `PW_CHANNEL=chromium` and run `npx playwright install chromium` to use Playwright Chromium. Run `npm run test:e2e -- --headed` for visual inspection.

Real WME check, using an isolated profile:

For manual review, build and launch your chosen Chromium browser normally:

```sh
npm run build -- --manual
# Or choose Chrome, Edge, or an executable path:
npm run build -- --manual --browser chrome
npm run build -- --manual --browser "/Applications/Microsoft Edge.app"
```

Sign in to WME in the new window, wait for the map, then press Enter in the terminal. The launcher attaches only after that confirmation and injects the current `dist/` userscript. Open **Scripts → 台灣速限標牌疊圖** to review it. No copy/paste or Tampermonkey installation is needed. This is a development preview; it does not update an installed Tampermonkey script.

Keep the command running to inject after each refresh. To review another change, run `npm run build` in a second terminal, then refresh WME manually when your editing work permits. The injector reads the latest bundle each time. Ctrl+C stops injection; an already injected script remains until refresh.

The dedicated `.wme-manual-profile-9225/` profile retains sign-in and IndexedDB between runs. This is separate from your everyday browser profile. Google SSO acceptance is controlled by Google; the launcher avoids attaching automation during sign-in but cannot guarantee acceptance. If you must sign in again, stop the command and restart the browser with this workflow before authenticating.

`WME_BROWSER_PATH` sets a default browser executable, and `WME_URL` sets the starting production WME URL. CLI flags override these values. Use `--port 9333` for a separate profile/session or if the default port is occupied. The debug connection uses localhost. Chrome, Edge, and other Chromium browsers support this workflow; Firefox and Safari do not. `npm run build -- --help` shows the available flags. Plain `npm run build` remains a build-only command.

For the existing automated real-WME smoke check:

```sh
node tests/manual/launch-wme.mjs
# Log in in the separate window, then in another terminal:
node tests/manual/verify-wme.mjs
```

Set `WME_BROWSER_PATH` and `WME_URL` to override the launcher defaults. The verifier injects the built script, imports the local sample and captures `test-results/real-wme.png`. It never clicks road features or calls editing APIs. An injected bundle smoke check does not replace a final Tampermonkey installation check.

## Optional distribution alternatives

Local CSV selection is supported and needs no server or userscript network grants. If later sharing one maintained dataset is desirable, publish a licensed, versioned CSV/GeoJSON snapshot with source URL, retrieval date, attribution and checksum. A hosted release asset avoids inflating Git history with frequent dataset updates. A future fetch adapter would need explicit allowed hosts, freshness indicators and network error handling. No remote dataset distribution is enabled by this version.


The interface defaults to Traditional Chinese. Use the language selector to switch to English immediately; the sidebar title remains **台灣速限標牌疊圖**. Language preferences are saved alongside existing settings, separately from the saved CSV.

The sidebar’s **使用條款 / Usage terms** link opens the usage notice in the selected language. It explains source permissions and attribution, independent verification before editing, read-only behavior, local file handling, and limitations. Each CSV retains its own source license; displaying it does not establish permission to copy its contents into Waze.


## Releases

The sidebar footer shows the installed version and links to its release. Pushes to `main` automatically validate, version, build, and publish the userscript. See [publishing and GitHub setup](docs/GREASY-FORK.md) for the Greasy Fork synchronization URL, one-time webhook setup, manual minor/major bumps, and recovery.
