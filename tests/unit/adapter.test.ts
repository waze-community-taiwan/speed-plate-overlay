import { beforeEach, expect, it, vi } from 'vitest';
import type { AsyncWmeSDK } from '@waze-editor/sdk-typings';
import { bindMap } from '../../src/adapter';
import { Controller } from '../../src/controller';
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
it('adds geographic points, restores normal layer order and cleans up only its own layer', async () => {
  const map = { addLayer: vi.fn(), getLayerZIndex: vi.fn(() => 324), removeAllFeaturesFromLayer: vi.fn(),
    addFeaturesToLayer: vi.fn(), redrawLayer: vi.fn(), setLayerVisibility: vi.fn(), setLayerZIndex: vi.fn(), removeLayer: vi.fn() };
  const off = vi.fn(); const events = { trackLayerEvents: vi.fn(), stopLayerEventsTracking: vi.fn(), on: vi.fn(() => off) };
  const controller = new Controller();
  const dispose = await bindMap({ Map: map, Events: events } as unknown as AsyncWmeSDK, controller);
  await controller.importFile({ name: 'sample.csv', size: 1, text: async () => 'lon,lat,speed,direction\n121.5,25,50,順向' } as File);
  await settle();
  expect(map.addFeaturesToLayer).toHaveBeenLastCalledWith(expect.objectContaining({ features: [expect.objectContaining({geometry: {type:'Point',coordinates:[121.5,25]},properties:{label:'50',direction:'順向'}})] }));
  const additions = map.addFeaturesToLayer.mock.calls.length;
  controller.settings({ plateScale: 2, badgePosition: 'top-left' }); await settle();
  expect(map.addFeaturesToLayer).toHaveBeenCalledTimes(additions);
  expect(map.redrawLayer.mock.calls.length).toBeGreaterThan(1);
  controller.settings({ forceOnTop: true }); await settle();
  expect(map.setLayerZIndex).toHaveBeenLastCalledWith(expect.objectContaining({ zIndex: 10000 }));
  controller.settings({ forceOnTop: false }); await settle();
  expect(map.setLayerZIndex).toHaveBeenLastCalledWith(expect.objectContaining({ zIndex: 324 }));
  await dispose(); expect(off).toHaveBeenCalledTimes(4); expect(map.removeLayer).toHaveBeenCalledOnce();
});
