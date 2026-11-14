import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const banner = `// ==UserScript==
// @name         Taiwan Speed Plate Overlay
// @namespace    https://github.com/waze-community-taiwan
// @version      ${pkg.version}
// @description  Display government speed-limit plates as a read-only WME map layer.
// @description:zh-TW 在 Waze 地圖編輯器中，以唯讀疊圖顯示政府 CSV 速限標牌。
// @author       Waze Community Taiwan
// @license      MIT
// @homepageURL  https://github.com/waze-community-taiwan/speed-plate-overlay
// @supportURL   https://github.com/waze-community-taiwan/speed-plate-overlay/issues
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @exclude      https://www.waze.com/editor/sdk/*
// @exclude      https://www.waze.com/editor/profile*
// @exclude      https://www.waze.com/*/editor/sdk/*
// @exclude      https://www.waze.com/*/editor/profile*
// @grant        none
// @run-at       document-idle
// ==/UserScript==`;

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL("../src/index.ts", import.meta.url).pathname],
  outfile: new URL("../dist/wme-speed-plate-overlay.user.js", import.meta.url).pathname,
  bundle: true,
  format: "iife",
  target: ["chrome110", "firefox115"],
  banner: { js: banner },
  legalComments: "none",
  minify: false,
  sourcemap: false,
});
