export function injectStyles() {
  if (document.getElementById('spo-styles')) return;
  const style = document.createElement('style'); style.id = 'spo-styles';
  style.textContent = `
  .spo-panel {padding:0 12px;font-size:13px;color:inherit}
  .spo-panel h4 {font-size:14px;margin:8px 0 12px;font-weight:600}
  .spo-card {border:1px solid var(--hairline, #aaa6);border-radius:10px;padding:10px 12px;margin:6px 0}
  .spo-panel p {font-size:11px;line-height:1.6;overflow-wrap:anywhere}
  .spo-file {display:block;width:100%;margin-top:8px;font:inherit}
  .spo-row {display:flex;align-items:center;justify-content:space-between;gap:10px}
  .spo-switch {position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0}
  .spo-switch input {position:absolute;opacity:0;width:100%;height:100%;margin:0}
  .spo-switch span {display:block;border-radius:22px;background:rgba(120,120,128,.32);height:22px;pointer-events:none}
  .spo-switch span:after {content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;background:white;border-radius:50%;box-shadow:0 1px 3px #0004;transition:transform 200ms}
  .spo-switch input:checked + span {background:#34c759}
  .spo-switch input:checked + span:after {transform:translateX(16px)}
  .spo-switch input:focus-visible + span {outline:3px solid #34c75966}
  .spo-top-row {margin-top:10px}
  .spo-top {display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:26px;height:22px;min-height:22px;padding:0;border:1px solid rgba(128,128,128,.35);border-radius:6px;background:transparent;color:inherit;cursor:pointer;opacity:.6;transition:opacity 150ms,background-color 150ms,color 150ms,border-color 150ms,transform 50ms}
  .spo-top:hover {opacity:1}
  .spo-top:active {transform:scale(.94)}
  .spo-top[aria-pressed=true] {background:#ff9500;color:white;border-color:#ff9500;opacity:1}
  .spo-panel .spo-top:focus-visible,.spo-floating .spo-top:focus-visible {outline:none;box-shadow:0 0 0 3px rgba(255,149,0,.35)}
  .spo-top svg {width:14px;height:14px;display:block;pointer-events:none}
  .spo-columns label {display:flex;align-items:flex-start;gap:8px;margin:6px 0;overflow-wrap:anywhere}
  .spo-columns input {flex-shrink:0;margin:2px 0 0}
  .spo-column-row {display:flex;align-items:center;gap:4px}
  .spo-column-row label {flex:1;min-width:0}
  .spo-column-row label span {overflow-wrap:anywhere;min-width:0}
  .spo-drag-handle {display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:grab;padding:0 2px;opacity:.45;font-size:16px;line-height:1;letter-spacing:-3px;user-select:none}
  .spo-drag-handle:hover {opacity:.85}
  .spo-drag-handle:active {cursor:grabbing}
  .spo-dragging {opacity:.45}
  .spo-drop-before {box-shadow:inset 0 3px #2d6cdf}
  .spo-drop-after {box-shadow:inset 0 -3px #2d6cdf}
  .spo-reset-order,.spo-reset-size {margin-top:8px;border-radius:6px;border:1px solid var(--hairline,#aaa6);background:transparent;color:inherit;font:inherit;padding:3px 8px;cursor:pointer}
  .spo-reset-order:disabled {opacity:.4;cursor:default}
  .spo-order-status {display:block;font-size:11px;opacity:.75}
  .spo-range-label,.spo-appearance-label {display:block;margin-top:12px;font-weight:400}
  .spo-range {display:flex;align-items:center;gap:10px;margin-top:8px}
  .spo-range input {flex:1;min-width:0;margin:0;-webkit-appearance:none;appearance:none;height:4px;background:rgba(120,120,128,.3);border-radius:2px;outline:none}
  .spo-range input::-webkit-slider-thumb {-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer}
  .spo-range input::-moz-range-thumb {width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer}
  .spo-range input:focus-visible::-webkit-slider-thumb {box-shadow:0 0 0 3px rgba(45,108,223,.3)}
  .spo-color-row {margin-top:10px;font-weight:400}
  .spo-color-row input {width:28px;height:22px;flex-shrink:0;border:1px solid rgba(128,128,128,.35);border-radius:4px;padding:0;background:transparent;cursor:pointer}
  .spo-range output {font-size:12px;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
  .spo-appearance-label select {display:block;width:100%;margin-top:6px;padding:6px 10px;border:1px solid var(--hairline,#aaa6);border-radius:8px;background:var(--background_default,#fff);color:inherit;font:inherit}
  .spo-floating-setting {margin-top:12px}
  .spo-panel :focus-visible,.spo-popup :focus-visible,.spo-floating :focus-visible {outline:3px solid #2d6cdf88;outline-offset:2px}
  .spo-popup {position:fixed;z-index:10001;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 24px));max-height:55vh;overflow:auto;background:var(--background_default,#fff);color:inherit;border:1px solid var(--hairline,#aaa6);border-radius:10px;padding:12px;box-shadow:0 6px 20px #0003;font-size:13px}
  .spo-popup-header {display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .spo-popup-header strong {min-width:0;overflow-wrap:anywhere}
  .spo-popup-header .spo-close {flex-shrink:0;float:none}
  [wz-theme=dark] .spo-popup,[wz-theme=dark] .spo-floating,[wz-theme=dark] .spo-appearance-label select {background:var(--background_default,#1f2024)}
  .spo-popup dt {font-weight:600;margin-top:6px;overflow-wrap:anywhere}.spo-popup dd {margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
  .spo-close {display:inline-flex;align-items:center;justify-content:center;float:right;width:26px;height:26px;padding:0;border-radius:8px;background:rgba(120,120,128,.12);border:1px solid var(--hairline,#aaa6);color:inherit;font:inherit;font-size:20px;line-height:1;cursor:pointer;transition:background 150ms,color 150ms}.spo-close:hover {color:#ff3b30;background:#ff3b301f}
  .spo-floating {position:fixed;z-index:10000;box-sizing:border-box;width:200px;max-width:calc(100vw - 24px);border:1px solid var(--hairline,rgba(128,128,128,.3));border-radius:10px;background:var(--background_default,#fff);color:inherit;box-shadow:0 6px 24px rgba(0,0,0,.28);font:inherit;font-size:13px;overflow:hidden}
  .spo-floating[hidden] {display:none}
  .spo-floating-header {display:flex;align-items:center;gap:8px;padding:2px 12px;border-bottom:1px solid var(--hairline,rgba(128,128,128,.2));background:rgba(128,128,128,.08);cursor:move;touch-action:none;user-select:none}
  .spo-floating-header strong {flex:1;min-width:0;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .spo-floating-dragging .spo-floating-header {cursor:move}
  .spo-floating .spo-close {box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;float:none;flex-shrink:0;width:22px;height:22px;border-radius:6px;border:0;background:transparent;color:inherit;padding:0;opacity:.6;transition:opacity 150ms,background-color 150ms,transform 50ms}
  .spo-floating .spo-close:hover {opacity:1;background:rgba(128,128,128,.18)}
  .spo-floating .spo-close:active {transform:scale(.92)}
  .spo-floating .spo-close:focus-visible {outline:none;box-shadow:0 0 0 3px rgba(255,149,0,.35)}
  .spo-floating .spo-close svg {width:13px;height:13px;display:block;pointer-events:none}
  .spo-floating-rows {padding:6px 8px;max-height:320px;overflow-y:auto}
  .spo-floating-row {display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:6px}
  .spo-floating-label {flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  [wz-theme=dark] .spo-floating {background:#1f2024;border-color:rgba(255,255,255,.12)}
  [wz-theme=dark] .spo-floating-header {border-bottom-color:rgba(255,255,255,.1);background:rgba(255,255,255,.05)}
  .spo-terms-footer {margin-top:16px;padding-top:10px;border-top:1px solid var(--hairline,#aaa6);text-align:center;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}
  .spo-version {color:inherit;opacity:.65;font-size:11px;border:1px solid var(--hairline,#aaa6);border-radius:6px;padding:1px 5px;text-decoration:none;font-variant-numeric:tabular-nums}
  .spo-version:hover {opacity:1}
  .spo-terms-link {border:0;background:none;color:#2d6cdf;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:2px 6px}
  .spo-modal-backdrop {position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}
  .spo-modal {display:flex;flex-direction:column;width:100%;max-width:720px;max-height:100%;background:var(--background_default,#fff);color:inherit;border-radius:12px;box-shadow:0 16px 48px #0005;font-size:13px}
  .spo-modal header {display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--hairline,#aaa6)}
  .spo-modal h2 {flex:1;font-size:15px;font-weight:600;margin:0}
  .spo-modal-body {overflow:auto;padding:14px 18px 18px;line-height:1.65}
  .spo-modal h3 {font-size:13.5px;margin:16px 0 6px;font-weight:600}
  .spo-modal h3:first-child {margin-top:0}.spo-modal p {margin:0 0 8px}
  .spo-terms-meta {border-top:1px solid var(--hairline,#aaa6);padding-top:12px;opacity:.7;font-size:11.5px}
  .spo-modal :focus-visible {outline:3px solid #2d6cdf88;outline-offset:2px}
  [wz-theme=dark] .spo-modal {background:var(--background_default,#1f2024)}
  @media(prefers-reduced-motion:reduce){.spo-switch span:after,.spo-top,.spo-floating .spo-close {transition:none}.spo-top:active,.spo-floating .spo-close:active {transform:none}}`;
  document.head.append(style);
}
