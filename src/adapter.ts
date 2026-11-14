import { t } from './i18n';
import type { AsyncWmeSDK, SdkWazeFeature } from '@waze-editor/sdk-typings';
import { orderedColumns, type Controller } from './controller';
import type { SpeedPlateRecord } from './types';
import { LAYER_NAME, TOP_Z_INDEX } from './constants';
import { badgeOffset, plateGraphic } from './marker';

export function directionSymbol(direction: string): string {
  return direction === '順向' ? '↻' : direction === '逆向' ? '↺' : '?';
}

export async function bindMap(sdk: AsyncWmeSDK, controller: Controller) {
  await sdk.Map.addLayer({ layerName: LAYER_NAME, styleContext: {
    plateGraphic: ({ feature }: { feature?: SdkWazeFeature }) => plateGraphic(String(feature?.properties.label ?? ''), String(feature?.properties.direction ?? ''), controller.state),
    markerSize: () => 56 * controller.state.plateScale,
  }, styleRules: [{ style: { externalGraphic: '${plateGraphic}', graphicWidth: '${markerSize}', graphicHeight: '${markerSize}',
    graphicOpacity: 1, cursor: 'pointer' } }] });
  const normalZ = await sdk.Map.getLayerZIndex({ layerName: LAYER_NAME });
  sdk.Events.trackLayerEvents({ layerName: LAYER_NAME });
  let records: SpeedPlateRecord[] | undefined;
  let markerStyle = '';
  let selected: SpeedPlateRecord | undefined;
  let popup: HTMLElement | undefined;
  let generation = 0;
  const close = () => { generation++; popup?.remove(); popup = undefined; selected = undefined; };
  const show = async (record: SpeedPlateRecord) => {
    close(); selected = record;
    const token = generation;
    const pixel = await sdk.Map.getPixelFromLonLat({ lonLat: { lon: record.longitude, lat: record.latitude } });
    if (token !== generation) return;
    popup = document.createElement('section'); popup.className = 'spo-popup';
    popup.setAttribute('role', 'region'); popup.setAttribute('aria-label', t(controller.state.language, 'Speed plate details'));
    const button = document.createElement('button'); button.className = 'spo-close'; button.textContent = '×';
    button.type = 'button'; button.title = t(controller.state.language, 'Close details'); button.setAttribute('aria-label', t(controller.state.language, 'Close details')); button.onclick = close;
    const title = document.createElement('strong'); title.textContent = `${record.speed} km/h · ${directionSymbol(record.direction)} ${record.direction}`;
    const list = document.createElement('dl');
    for (const column of orderedColumns(controller.state).filter(c => controller.state.visibleColumns.includes(c))) {
      const term = document.createElement('dt'); term.textContent = column;
      const value = document.createElement('dd'); value.textContent = record.values[column] ?? ''; list.append(term, value);
    }
    if (!list.children.length) list.textContent = t(controller.state.language, 'Select columns in the Speed Plates sidebar.');
    const header = document.createElement('header'); header.className = 'spo-popup-header'; header.append(title,button);
    popup.append(header, list); document.body.append(popup);
    const bounds = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(12,Math.min(pixel.x+20*controller.state.plateScale+12,innerWidth-bounds.width-12))}px`;
    popup.style.top = `${Math.max(12,Math.min(pixel.y,innerHeight-bounds.height-12))}px`;
    button.focus();
  };
  let queue = Promise.resolve();
  const unsubscribe = controller.subscribe(() => {
    // Serialize asynchronous SDK writes; every job reads the newest state.
    queue = queue.then(async () => {
      const state = controller.state;
      if (records !== state.records) {
        close(); await sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
        if (state.records.length) await sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features: state.records.map(record => ({
          type: 'Feature', id: record.id, geometry: { type: 'Point', coordinates: [record.longitude, record.latitude] },
          properties: { label: record.speed, direction: record.direction },
        })) }); records = state.records;
      }
      const nextStyle = JSON.stringify([state.badgePosition, state.plateScale, state.speedTextScale,state.clockwiseColor,state.counterclockwiseColor]);
      if (markerStyle !== nextStyle) { await sdk.Map.redrawLayer({ layerName: LAYER_NAME }); markerStyle = nextStyle; }
      await sdk.Map.setLayerZIndex({ layerName: LAYER_NAME, zIndex: state.forceOnTop ? TOP_Z_INDEX : normalZ });
      await sdk.Map.setLayerVisibility({ layerName: LAYER_NAME, visibility: state.enabled && !!state.records.length });
      if (!state.enabled) close(); else if (selected) await show(selected);
    }).catch(error => {
      const message = `Map overlay: ${String(error)}`;
      if (controller.state.error !== message) { controller.state.error = message; controller.emit(); }
      console.error(error);
    });
  });
  const cleanups = [
    sdk.Events.on({ eventName: 'wme-layer-feature-clicked', eventHandler: ({ layerName, featureId }: { layerName: string; featureId: string | number }) => {
      if (layerName !== LAYER_NAME || !controller.state.enabled) return;
      const record = controller.state.records.find(r => r.id === String(featureId));
      if (record) void show(record).catch(console.error);
    } }),
    // WME's transparent interaction layer can receive the pointer above SDK
    // features. Use its public map-click event for geographic hit testing too.
    sdk.Events.on({ eventName: 'wme-map-mouse-click', eventHandler: (event: {lon:number;lat:number;x:number;y:number}) => {
      if (!controller.state.enabled) return;
      const clickGeneration = generation;
      const candidates = controller.state.records.map(record => ({record, distance:
        ((record.longitude-event.lon)*Math.cos(event.lat*Math.PI/180))**2 + (record.latitude-event.lat)**2
      })).sort((a,b)=>a.distance-b.distance).slice(0,4);
      void (async () => {
        for (const {record} of candidates) {
          const pixel = await sdk.Map.getMapPixelFromLonLat({lonLat:{lon:record.longitude,lat:record.latitude}});
          if (clickGeneration !== generation) return;
          const dx = event.x-pixel.x, dy = event.y-pixel.y;
          const scale = controller.state.plateScale, badge = badgeOffset(controller.state.badgePosition);
          if (Math.hypot(dx,dy) <= 20*scale || Math.hypot(dx-badge.x*scale,dy-badge.y*scale) <= 11*scale) { await show(record); break; }
        }
      })().catch(console.error);
    } }),
    sdk.Events.on({ eventName: 'wme-map-move', eventHandler: close }),
    sdk.Events.on({ eventName: 'wme-logged-out', eventHandler: () => controller.settings({ enabled: false }) }),
  ];
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
  const outside = (event: Event) => { if (!popup || !event.composedPath().includes(popup)) close(); };
  document.addEventListener('keydown', escape);
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('click', outside, true);
  return async () => { unsubscribe(); cleanups.forEach(fn => fn()); close(); document.removeEventListener('keydown', escape);
    document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', outside, true);
    await queue; close(); sdk.Events.stopLayerEventsTracking({ layerName: LAYER_NAME }); await sdk.Map.removeLayer({ layerName: LAYER_NAME }); };
}
