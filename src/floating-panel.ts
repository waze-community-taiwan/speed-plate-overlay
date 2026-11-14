import { localize } from './i18n';
import type { Controller } from './controller';
import { TOP_LAYER_BUTTON } from './top-button';

export function mountFloatingPanel(controller: Controller, viewport: HTMLElement) {
  document.querySelector('.spo-floating')?.remove();
  const panel = document.createElement('section');
  panel.className = 'spo-floating'; panel.setAttribute('aria-label', 'Speed plate layer controls');
  panel.innerHTML = `<header class="spo-floating-header"><strong role="button" tabindex="0" aria-label="Move floating controls" title="Drag to move. Arrow keys move; Home resets position.">Speed Plates</strong><button class="spo-close" type="button" title="Hide floating controls" aria-label="Hide floating controls"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></header>
    <div class="spo-floating-rows"><div class="spo-floating-row"><span class="spo-floating-label">On top</span>${TOP_LAYER_BUTTON}</div></div>`;
  document.body.append(panel);
  panel.querySelector<HTMLButtonElement>('.spo-close')!.onclick = () => controller.settings({ floatingControls: false });
  const top = panel.querySelector<HTMLButtonElement>('.spo-top')!;
  top.onclick = () => controller.settings({ forceOnTop: !controller.state.forceOnTop });
  let customPosition: {x:number; y:number} | null = null;
  let drag: {pointerId:number; startX:number; startY:number; x:number; y:number} | null = null;
  const header = panel.querySelector('header')!;
  const position = () => {
    if (panel.hidden) return;
    const rect = viewport.getBoundingClientRect();
    const minX = Math.min(Math.max(12,innerWidth-panel.offsetWidth-12),Math.max(12,rect.left+12));
    const minY = Math.min(Math.max(12,innerHeight-panel.offsetHeight-12),Math.max(12,rect.top+12));
    const maxX = Math.max(minX,Math.min(rect.right,innerWidth)-panel.offsetWidth-12);
    const maxY = Math.max(minY,Math.min(rect.bottom,innerHeight)-panel.offsetHeight-12);
    const x = Math.max(minX,Math.min(customPosition?.x ?? minX,maxX));
    const y = Math.max(minY,Math.min(customPosition?.y ?? rect.bottom-panel.offsetHeight-64,maxY));
    if (customPosition) customPosition = {x,y};
    panel.style.left = `${x}px`; panel.style.top = `${y}px`;
  };
  const stopDrag = () => { drag = null; panel.classList.remove('spo-floating-dragging'); };
  header.onpointerdown = event => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
    event.preventDefault(); event.stopPropagation();
    const rect = panel.getBoundingClientRect();
    drag = {pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:rect.left,y:rect.top};
    header.setPointerCapture(event.pointerId); panel.classList.add('spo-floating-dragging');
  };
  header.onpointermove = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    customPosition = {x:drag.x+event.clientX-drag.startX,y:drag.y+event.clientY-drag.startY}; position();
  };
  header.onpointerup = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation(); stopDrag();
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
  };
  header.onpointercancel = stopDrag; header.onlostpointercapture = stopDrag;
  header.querySelector('strong')!.onkeydown = event => {
    if (event.key === 'Home') { event.preventDefault(); customPosition = null; position(); return; }
    const directions: Record<string,[number,number]> = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction = directions[event.key]; if (!direction) return;
    event.preventDefault(); event.stopPropagation(); const rect = panel.getBoundingClientRect(), step = event.shiftKey ? 1 : 10;
    customPosition = {x:rect.left+direction[0]*step,y:rect.top+direction[1]*step}; position();
  };
  const unsubscribe = controller.subscribe(() => {
    localize(panel, controller.state.language);
    if (!controller.state.floatingControls) { customPosition = null; stopDrag(); }
    panel.hidden = !controller.state.floatingControls;
    panel.style.opacity = String(controller.state.floatingOpacity);
    top.setAttribute('aria-pressed', String(controller.state.forceOnTop)); position();
  });
  const observer = new ResizeObserver(position); observer.observe(viewport);
  window.addEventListener('resize', position);
  return () => { unsubscribe(); observer.disconnect(); window.removeEventListener('resize', position); panel.remove(); };
}
