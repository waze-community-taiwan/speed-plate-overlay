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
7. Open **Plate appearance** to choose one of four badge corners (default: **Bottom right**), choose separate **Clockwise badge color** and **Counter-clockwise badge color**, adjust **Plate size** from 25% to 400%, and adjust **Speed value size** from 25% to 200%. Both sliders put 100% at their center while keeping their full ranges; percentage labels and accessible values report the actual size. The 100% / 100% baseline matches the former 100% plate / 150% speed-value appearance. **Reset sizes** restores both to 100%. Long values are fitted inside the circle.
8. Click a plate for a details bubble whose width fits its content, capped at 360px and constrained to the viewport. Expand **Popup columns** to select fields and drag their right-hand **⋮⋮** grips to reorder them. The borderless grips follow NLSC Overlay's styling. Keyboard users can focus a grip and use **Alt + ↑ / ↓**. Field selection and order are saved separately. **Reset order** restores the original CSV column order without changing which fields are selected. Outside clicks, Escape, the close button, or panning dismiss the bubble; click a plate again after changing fields to view the new layout.

Preferences survive reload. CSV records remain in memory only; choose the file again after reloading WME. Invalid replacements preserve the previous valid dataset. Maximum file size is 30 MB. Large datasets can take time to render.

## Data and direction

The sample is `input/plate-data-20261114.csv` (not committed). Required columns accept these names:

| Field | Government header | Other supported headers |
| --- | --- | --- |
| Longitude | 坐標-E-WGS84 | 經度, longitude, lon, lng |
| Latitude | 坐標-N-WGS84 | 緯度, latitude, lat |
| Speed | 牌面內容 | 速限, speed, speed_limit |
| Direction | 牌面方向 | 方向, direction |

Coordinates must be decimal WGS84 degrees. TWD97 coordinates are not silently substituted. Blank, nonnumeric, out-of-range coordinates and inconsistent row widths are counted and skipped. Missing or duplicate headers and unterminated quotes produce an error.

Markers show only the speed inside a red circle. A separate badge uses mirrored clockwise/counterclockwise rotation icons for `順向` / `逆向`, defaulting to green (`#34c759`) and orange (`#ff9500`) respectively. Each direction's color can be changed independently and is saved; the icon color adjusts for contrast. Other direction values show a gray `?` badge. These symbols distinguish the government's forward/reverse road-reference values. They do **not** establish that a road travels geographically clockwise or provide a compass heading. The sample has no bearing field. Keep original direction and road/chainage columns visible when interpreting a plate.

## Design and SDK boundary

`src/controller.ts` owns state; `src/sidebar.ts` and `src/floating-panel.ts` render it; `src/adapter.ts` uses only the public SDK Map and Events APIs. Bootstrap uses the recommended async SDK mode and waits for WME readiness. The official typings omit the async global factory overload, so a narrow factory assertion expresses that documented overload. Settings use a namespaced key; only preferences are serialized. CSV popup text uses `textContent`; SVG marker text is XML-escaped.

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

```sh
node tests/manual/launch-wme.mjs
# Log in in the separate window, then in another terminal:
node tests/manual/verify-wme.mjs
```

Set `WME_BROWSER_PATH` and `WME_URL` to override the launcher defaults. The verifier injects the built script, imports the local sample and captures `test-results/real-wme.png`. It never clicks road features or calls editing APIs. An injected bundle smoke check does not replace a final Tampermonkey installation check.

## Optional distribution alternatives

Local CSV selection is supported and needs no server or userscript network grants. If later sharing one maintained dataset is desirable, publish a licensed, versioned CSV/GeoJSON snapshot with source URL, retrieval date, attribution and checksum. A hosted release asset avoids inflating Git history with frequent dataset updates. A future fetch adapter would need explicit allowed hosts, freshness indicators and network error handling. No remote dataset distribution is enabled by this version.


The interface defaults to Traditional Chinese. Use the language selector to switch to English immediately; the sidebar title remains **台灣速限標牌疊圖**. Language preferences are saved alongside existing settings, without storing CSV records.

The sidebar’s **使用條款 / Usage terms** link opens the usage notice in the selected language. It explains source permissions and attribution, independent verification before editing, read-only behavior, local file handling, and limitations. Each CSV retains its own source license; displaying it does not establish permission to copy its contents into Waze.


## Releases

The sidebar footer shows the installed version and links to its release. Pushes to `main` automatically validate, version, build, and publish the userscript. See [publishing and GitHub setup](docs/GREASY-FORK.md) for the Greasy Fork synchronization URL, one-time webhook setup, manual minor/major bumps, and recovery.
