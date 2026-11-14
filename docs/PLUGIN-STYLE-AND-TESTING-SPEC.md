# WME Plugin UI Style and Browser Testing Specification

Status: guiding specification
Source application: WME NLSC Overlay v0.4.1
Audience: developers creating a new WME SDK userscript or plugin that should feel visually related to WME NLSC Overlay

## 1. Purpose

This document extracts the reusable UI language and testing approach of WME NLSC Overlay. It is a design contract, not a requirement to copy NLSC-specific behavior, labels, data sources, or class names.

A conforming plugin should:

- mount its primary UI through the WME SDK sidebar;
- inherit WME's foreground color and theme variables wherever possible;
- use the compact spacing, rounded controls, interaction states, and color semantics defined below;
- keep domain state outside the rendering code and update every UI surface through one controller or state interface;
- verify behavior with Vitest and `jsdom`;
- verify the built bundle in a browser against a deterministic mock WME fixture;
- perform a final headed-browser check in real WME before release.

## 2. Source-of-truth files in this app

| Concern | Reference |
| --- | --- |
| WME SDK initialization and tab registration | `src/index.ts` |
| Main sidebar markup and styles | `src/sidebar.ts` |
| Floating panel styles and interaction | `src/floatbox.ts` |
| Modal and footer-link styles | `src/terms.ts` |
| Shared UI/state synchronization | `src/controller.ts` |
| Persistent settings | `src/state.ts` |
| Sidebar DOM behavior tests | `tests/unit/sidebar.test.ts` |
| Floating-panel behavior tests | `tests/unit/floatbox.test.ts` |
| Dialog behavior tests | `tests/unit/terms.test.ts` |
| Mock WME SDK page | `tests/fixtures/mock-wme-sdk.html` |
| Fixture HTTP server | `tests/fixtures/serve.mjs` |
| Playwright configuration | `playwright.config.ts` |
| Real-WME browser launcher | `tests/manual/launch-wme.mjs` |
| Real-WME DOM verifier | `tests/manual/verify-sidebar.mjs` |

## 3. Design principles

### 3.1 Use WME as the visual shell

Do not establish a separate app-wide font, foreground color, or theme. The plugin should inherit those from WME. Use WME variables with safe fallbacks:

```css
background: var(--background_default, #fff);
border-color: var(--hairline, rgba(128, 128, 128, 0.3));
color: inherit;
```

Use explicit `[wz-theme="dark"]` overrides only where a fallback surface or border would otherwise be wrong. The current app uses `#1f2024` for elevated dark surfaces.

### 3.2 Keep the interface compact

The sidebar is a dense tool surface, not a marketing page. Its base size is `13px`, section headings are `14px`, controls generally occupy `22px` in height, and spacing is mostly in the `6–12px` range.

### 3.3 Make state visible by shape and color

Do not rely on color alone:

- an on/off setting is a pill switch;
- a special action or pressed state is a square icon button;
- a destructive action is a plain icon button with a red hover treatment;
- drag order uses a grip plus a blue insertion line;
- numeric sliders always have an adjacent percentage or value label.

### 3.4 Keep one state model behind every view

The current sidebar and floating panel are two views over the same controller. User actions call controller methods, and controller subscriptions update all rendered views. A new plugin should follow the same pattern rather than directly coordinating one DOM component with another.

### 3.5 Namespace everything

Replace `abc` in the examples with a short, unique plugin prefix. Namespace:

- CSS classes, such as `.abc-card`;
- style element IDs, such as `abc-sidebar-styles`;
- local-storage keys;
- WME SDK `scriptId`;
- test selectors that are specific to the plugin.

Do not reuse the source app's `nlsc-` prefix in another plugin.

## 4. Visual tokens

### 4.1 Core palette

| Token | Value | Meaning |
| --- | --- | --- |
| Primary | `#2d6cdf` | primary buttons, focus, selected outlines, drop targets, links |
| Primary hover | `#2558b5` | primary-button hover |
| Primary active | `#1f4895` | primary-button press |
| Success/on | `#34c759` | enabled toggle |
| Special/raised | `#ff9500` | active “special mode” or “bring to front” state |
| Destructive | `#ff3b30` | remove/close hover foreground |
| Destructive wash | `rgba(255,59,48,0.12)` | remove/close hover background |
| Muted control | `rgba(120,120,128,0.32)` | switch or slider track |
| Dark elevated surface | `#1f2024` | popover, modal, floating panel in dark theme |
| Standard shadow | `0 1px 3px rgba(0,0,0,0.25)` | thumbs and small raised elements |
| Popover shadow | `0 6px 20px rgba(0,0,0,0.18)` | popovers |
| Floating shadow | `0 6px 24px rgba(0,0,0,0.28)` | floating tools |
| Modal shadow | `0 16px 48px rgba(0,0,0,0.32)` | modal dialogs |

The source app also uses the following high-contrast optional preset colors: `#ff3b30`, `#ff9500`, `#ffcc00`, `#34c759`, `#00c7ff`, and `#ff2d92`.

### 4.2 Typography

| Element | Specification |
| --- | --- |
| Sidebar base | `font-size: 13px` |
| Section heading | `14px`, weight `600`, letter spacing `0.01em` |
| Primary label | weight `600`, line height `1.25` |
| Secondary label | `0.82em`, opacity `0.65` |
| Value label | `12px`, opacity `0.75`, tabular numerals |
| Small helper/popover label | `11px`, opacity `0.7` |
| Modal title | `15px`, weight `600` |
| Modal body | `13px`, line height `1.65` |

Use WME's inherited font family. Long labels should wrap in sidebar cards or truncate with an ellipsis in constrained floating panels.

### 4.3 Spacing, radii, and motion

| Use | Specification |
| --- | --- |
| Sidebar horizontal gutter | `12px` |
| Card padding | `10px 12px` |
| Card separation | `6px 0` margin |
| Card/popover/floating radius | `10px` |
| Select/primary button radius | `8px` |
| Small icon-button radius | `6px` |
| Modal radius | `12px` |
| Row gap | `10px` in cards; `8px` in compact panels |
| Standard state transition | `150ms` |
| Toggle transition | `200ms` |
| Press feedback | scale to `0.92–0.97` for `50ms` |

Animation should communicate immediate control feedback only. Avoid decorative motion.

## 5. Layout and component specifications

### 5.1 WME sidebar panel

Register the tab only after the WME SDK is ready:

```ts
const pageWindow: any = (window as any).unsafeWindow ?? window;
await pageWindow.SDK_INITIALIZED;

const sdk = pageWindow.getWmeSdk({
  scriptId: "wme-example-plugin",
  scriptName: "WME Example Plugin",
});

const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();
tabLabel.textContent = "Example";
tabPane.classList.add("abc-panel");
```

The `unsafeWindow` fallback matters for Tampermonkey because WME globals may exist on the real page window rather than the userscript sandbox.

Apply the panel gutter yourself because the SDK tab pane may be a bare container:

```css
.abc-panel {
  padding: 0 12px;
  font-size: 13px;
}

.abc-panel h4 {
  margin: 8px 0 12px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
```

Recommended vertical order:

1. plugin name and optional version;
2. the most important global action or picker;
3. repeatable cards or settings sections;
4. secondary settings;
5. legal/help/about footer.

Place high-frequency controls above the fold.

### 5.2 Primary button

- Padding: `6px 14px`.
- Radius: `8px`.
- Background: primary blue.
- Text: white, `13px`, weight `600`.
- Hover: primary-hover blue.
- Active: primary-active blue plus `scale(0.97)`.
- Use a semantic `<button type="button">`.

### 5.3 Select

- Grow to fill the row: `flex: 1; min-width: 0`.
- Padding: `6px 10px`.
- Radius: `8px`.
- Use inherited text color and WME background.
- On focus, use a primary border and a `3px` translucent blue ring.

### 5.4 Card

- `position: relative` so an anchored popover can live inside it.
- Margin `6px 0`, padding `10px 12px`, radius `10px`.
- Use a one-pixel WME hairline border; do not add a normal card background unless the content requires a raised surface.
- Header is a flex row with `align-items: center` and a `10px` gap.
- The name block uses `flex: 1; min-width: 0` so controls retain their size.

For sortable cards:

- make only the grip initiate dragging;
- set the full row as draggable only while the pointer is held on the grip;
- reduce the dragged card to `0.45` opacity;
- show a `3px` primary-blue insertion line above or below the target;
- ensure sliders, color controls, and toggles never accidentally start a drag.

### 5.5 Toggle switch

- Outer size: `38 × 22px`.
- Track: full pill, muted gray when off, success green when on.
- Thumb: `18 × 18px`, positioned `2px` from the edge, white with the standard shadow.
- Checked translation: `16px`.
- Keep the native checkbox in the DOM and visually hide it.
- Give keyboard focus a `3px` translucent green ring.
- Wrap the checkbox and visual track in a `<label>` so the whole switch is clickable.

### 5.6 Square state/action button

Use this for a mode such as “pin,” “above,” or “special handling,” not for a boolean preference that belongs in a toggle.

- Size: `26 × 22px`.
- Radius: `6px`.
- Default: transparent, inherited color, `0.6` opacity, one-pixel neutral border.
- Hover: full opacity.
- Active press: `scale(0.94)`.
- Pressed state: orange background and border, white icon, full opacity.
- Express state with `aria-pressed="true|false"` and style from that attribute.
- Use an inline SVG with `currentColor`; mark the SVG `aria-hidden="true"` and put the accessible name on the button.

### 5.7 Remove or close button

- Transparent with no normal border.
- Default opacity around `0.55–0.6`.
- Hover: full opacity, destructive red foreground, pale destructive background.
- Provide a `title`; for an icon-only close button also provide `aria-label`.
- Keep destructive appearance on hover rather than painting every close button red at rest.

### 5.8 Range slider and numeric value

- Place the slider and value in a flex row with a `10px` gap and `8px` top margin.
- Track: `4px` high, neutral gray, `2px` radius.
- Thumb: `18px` circle, white, one-pixel border, standard shadow.
- Value: at least `38px` wide, right aligned, tabular numerals.
- Update the value label on every `input` event.
- Persist continuous values carefully; if storage writes are expensive, render on `input` and commit on `change`.

### 5.9 Swatch and popover

- Swatch: `22px` circle with a neutral border.
- Popover: absolute, aligned near the trigger; `10px` padding and radius; WME background; hairline border; popover shadow.
- Selected chips receive a double ring: a surface-colored inner separation plus a primary-blue outer ring.
- Opening one popover closes any other open plugin popover.
- A document click closes the popover; clicks inside must stop propagation.
- A color-independent glyph or slash should identify an “original/default” option.

### 5.10 Floating tool panel

- Position fixed with a high z-index.
- Width range: `200–320px`.
- Radius `10px`, hairline border, WME background, floating shadow.
- Header doubles as the drag handle and uses a subtly tinted surface.
- Keep the close control excluded from drag initiation.
- Clamp the saved position to the current viewport on mount and after dragging so the handle stays reachable.
- Give the scrollable row area a maximum height (`320px` in the source app).
- If user-set opacity is supported, clamp it to at least `0.1` so the panel cannot disappear completely.

### 5.11 Modal dialog

- Use a fixed full-screen backdrop with `rgba(0,0,0,0.45)` and centered content.
- Modal width: `100%` up to `720px`; maximum height `100%` inside a `24px` backdrop gutter.
- Use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Focus the close button after opening.
- Close on the close button, `Escape`, or backdrop click; clicks inside the modal must not close it.
- Prevent duplicate instances.
- For full keyboard accessibility, a new plugin should also restore focus to the opener and add focus trapping when the dialog contains multiple interactive controls.

## 6. Style injection

The source app keeps each component's CSS beside its renderer and injects it once. This works well for a bundled userscript:

```ts
const STYLE_ID = "abc-sidebar-styles";

function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ABC_STYLES;
  document.head.appendChild(style);
}
```

Rules:

- injection must be idempotent;
- each major surface may own its own style block;
- selectors must start with the plugin prefix;
- avoid styling bare `button`, `input`, or WME classes globally;
- do not use `!important` unless a verified WME rule cannot otherwise be scoped around;
- treat WME CSS custom properties as an integration API with fallbacks, not as guaranteed constants.

## 7. Accessibility contract

At minimum:

- all controls use semantic HTML elements;
- every icon-only button has an accessible name;
- toggle state remains in a native checkbox;
- pressable mode buttons expose `aria-pressed`;
- dialogs expose dialog semantics and close on `Escape`;
- keyboard focus is visibly indicated;
- text and essential state are not communicated by color alone;
- the DOM follows the visual reading order;
- hidden controls are removed from interaction, not merely made transparent.

Recommended improvements over the source app for a new plugin:

- add `aria-label` to range inputs if no visible `<label>` is associated;
- make drag reordering operable by keyboard or provide move-up/move-down alternatives;
- announce order changes and other significant dynamic updates through a polite live region;
- restore focus when a popover or modal closes;
- honor `prefers-reduced-motion` by disabling scale transitions.

## 8. State and rendering architecture

Use four layers:

```text
WME SDK / host APIs
        ↕
adapter or bindings
        ↕
controller + persistent state
        ↕
sidebar / floating panel / modal views
```

The view should:

- render from current state;
- call controller methods in response to events;
- subscribe to controller changes and update itself;
- avoid directly mutating map objects, WME SDK state, or another view.

The adapter should translate controller changes into WME SDK or map operations. This separation makes `jsdom` tests fast and makes the WME fixture small.

## 9. Testing strategy

Testing has three layers. Do not replace one layer with another: each catches a different failure class.

### 9.1 Layer 1: Vitest unit and DOM behavior tests

Use Vitest with file-level `jsdom` where a test renders DOM:

```ts
// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
```

Test observable behavior, not private helper functions. Recommended coverage:

- initial values are rendered from state;
- click, `change`, and `input` events call the controller with normalized values;
- controller events update all applicable controls;
- enabled/disabled and pressed states update their DOM attributes;
- repeated render or mount operations do not duplicate styles or panels;
- dialog close methods work;
- persistence writes the expected serializable state;
- drag operations exclude nested controls and clamp persisted positions;
- empty, long-label, invalid-value, and missing-optional-feature cases render safely.

Use real controller objects with small fake host bindings where practical. Use `vi.fn()` at the WME/map boundary. Inject a detached root for floating surfaces so tests can query the exact mount target.

Run:

```bash
npm test
npm run test:watch
```

### 9.2 Layer 2: deterministic browser fixture

Build a standalone mock WME page that supplies only the APIs the plugin needs:

- `window.SDK_INITIALIZED` as a resolved promise;
- `window.getWmeSdk()` with `Sidebar`, `LayerSwitcher`, and `Events` stubs as required;
- a tab strip and tab-pane container;
- minimal host/map objects if the plugin integrates with OpenLayers;
- canned network responses for catalogs or remote configuration;
- the built userscript loaded from `/dist/`.

The source app's `tests/fixtures/mock-wme-sdk.html` demonstrates this architecture. It executes the production bundle, not TypeScript source, and uses a proxy window to make the local page appear to have WME's hostname for the userscript's host gate.

The fixture server should serve only the fixture directory and the build output directory, reject traversal, and avoid live third-party services for plugin UI tests.

Recommended commands:

```bash
npm run build
npm run serve:fixtures
```

Then open:

```text
http://localhost:8765/mock-wme-sdk.html
```

Browser verification checklist:

- the plugin tab appears and can be activated;
- there are no console errors;
- heading, picker, cards, secondary settings, and footer appear in the specified order;
- controls have the specified hover, active, pressed, focus, and disabled/hidden states;
- long names do not push fixed-size controls out of the panel;
- popovers remain inside a usable viewport area;
- light and dark WME themes are both legible;
- keyboard-only navigation reaches every control;
- resizing the viewport does not strand floating panels;
- reload restores persisted state.

### 9.3 Layer 3: Playwright browser automation

Playwright should start the fixture server through `webServer`, open the SDK fixture, and assert the visible plugin behavior. Prefer role, label, and stable plugin-owned selectors over DOM position.

Example:

```ts
import { expect, test } from "@playwright/test";

test("plugin renders and its primary control works", async ({ page }) => {
  await page.goto("/mock-wme-sdk.html");

  const panel = page.locator(".abc-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: /Example Plugin/ })).toBeVisible();

  await panel.getByRole("checkbox", { name: "Enable feature" }).check();
  await expect(panel.getByRole("checkbox", { name: "Enable feature" })).toBeChecked();

  await expect(page.locator(".abc-card")).toHaveCount(1);
});
```

Add focused tests for:

- sidebar registration and initial layout;
- every primary control path;
- state synchronization between WME, sidebar, and any floating view;
- modal and popover open/close behavior;
- drag/reorder or keyboard alternatives;
- persistence after reload;
- dark-theme rendering by setting `wz-theme="dark"` on the fixture root;
- viewport constraints at narrow and standard desktop widths.

Run headless for normal development and CI:

```bash
npm run test:e2e
```

Open a real browser for inspection and debugging:

```bash
HEADLESS=false npm run test:e2e -- --project=chromium
# or
npx playwright test --headed --project=chromium
```

Useful visual-debug options:

```bash
npx playwright test --ui
npx playwright test --debug
npx playwright show-report
```

Capture a screenshot on failure or at explicit visual checkpoints. Keep screenshot baselines only if the team is willing to review and deliberately update them; otherwise use screenshots as diagnostic artifacts and make semantic/layout assertions the release gate.

### 9.4 Layer 4: real WME smoke verification

The fixture proves the integration contract you modeled; it cannot prove that WME has not changed. Before release, run the built bundle in real WME using a normal browser profile.

The source app's manual harness uses this sequence:

1. build the userscript;
2. launch Microsoft Edge as a normal child process with a persistent profile and a remote-debugging port;
3. attach Playwright over Chrome DevTools Protocol (CDP);
4. add a `GM_xmlhttpRequest` polyfill backed by Node fetch because WME CSP can block direct page fetches;
5. wait for the WME SDK and map globals before injecting the bundle, approximating Tampermonkey's `document-idle` timing;
6. log in and inspect the real WME sidebar;
7. run a second CDP script that checks important DOM order, visibility, and computed layout.

Source-app commands:

```bash
npm run build
node tests/manual/launch-wme.mjs

# In another terminal while the browser is running:
node tests/manual/verify-sidebar.mjs
```

The current launcher is macOS/Edge-specific because it contains an absolute Edge application path. A new plugin should move the browser path, CDP port, profile directory, WME URL, and plugin selectors into configuration or environment variables.

Real-WME release smoke checks:

- WME loads normally before and after plugin injection;
- the SDK tab registers exactly once;
- the UI inherits the actual WME light/dark theme;
- host CSS has not changed the plugin's sizes or overflow unexpectedly;
- the browser console has no plugin exceptions or rejected promises;
- every SDK-backed action changes WME as intended;
- WME-originated changes flow back into plugin controls;
- the userscript manager build behaves the same way as the injected build;
- no overlay blocks critical WME controls at common viewport sizes.

## 10. Important current-state note

In this source repository, `tests/e2e/mock-wme.spec.ts` currently verifies only that the standalone OpenLayers map fixture renders. It does **not** yet exercise the plugin sidebar in `mock-wme-sdk.html`.

For a new plugin, treat the SDK fixture tests described above as the target testing standard. Do not infer that `npm run test:e2e` verifies the whole current NLSC UI until a Playwright spec explicitly opens `mock-wme-sdk.html` and asserts it.

## 11. Suggested new-plugin structure

```text
src/
  index.ts              # WME bootstrap and SDK registration
  controller.ts         # state transitions and subscriptions
  state.ts              # defaults, validation, persistence
  sidebar.ts            # sidebar renderer + scoped styles
  floating-panel.ts     # optional secondary view
  dialog.ts             # optional modal
tests/
  unit/
    controller.test.ts
    state.test.ts
    sidebar.test.ts
    floating-panel.test.ts
    dialog.test.ts
  e2e/
    plugin-ui.spec.ts
  fixtures/
    mock-wme-sdk.html
    serve.mjs
  manual/
    launch-wme.mjs
    verify-plugin.mjs
playwright.config.ts
vitest.config.ts
rollup.config.mjs
metablock.json
```

## 12. Definition of done for a new plugin

### Design

- [ ] All plugin selectors and storage keys are uniquely namespaced.
- [ ] The sidebar uses a `13px` base, `12px` gutter, and the token values in this document.
- [ ] WME theme variables are used with fallbacks.
- [ ] Light and dark themes are readable.
- [ ] Toggle, action, destructive, slider, card, popover, and modal states are visually distinct.
- [ ] Keyboard focus is visible and icon-only controls are named.
- [ ] Long labels and narrow sidebar widths remain usable.

### Architecture

- [ ] WME SDK initialization works through `unsafeWindow ?? window`.
- [ ] The view calls a controller rather than WME/map objects directly.
- [ ] Multiple views subscribe to the same state changes.
- [ ] Style injection and UI mounting are idempotent.
- [ ] Persistent values are validated and clamped before rendering.

### Automated verification

- [ ] `npm run build` succeeds.
- [ ] `npm test` covers state and DOM behavior.
- [ ] Playwright opens the mock WME SDK fixture and exercises the built bundle.
- [ ] E2E tests assert the plugin UI, not only the map fixture.
- [ ] CI saves traces, screenshots, or the HTML report on failure.

### Browser verification

- [ ] Headed fixture inspection passes in Chromium.
- [ ] No fixture-page console errors are present.
- [ ] Real-WME smoke verification passes with the production bundle.
- [ ] Actual WME theme, overflow, SDK events, and userscript sandbox behavior are verified.

## 13. Adoption rule

Copy the visual decisions and testing architecture, not the source plugin's identity. A new plugin should have its own name, prefix, labels, state schema, WME SDK `scriptId`, and domain-specific controls while remaining recognizably part of the same UI family.
