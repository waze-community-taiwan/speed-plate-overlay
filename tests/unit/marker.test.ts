import { expect, it } from 'vitest';
import { plateGraphic } from '../../src/marker';
import { loadSettings } from '../../src/state';
import { STORAGE_KEY } from '../../src/constants';
import { normalizeSettings } from '../../src/state';
import type { BadgePosition } from '../../src/types';

it('renders separate mirrored direction badges and safely escapes imported speed text', () => {
  const clockwise = decodeURIComponent(plateGraphic('50','順向'));
  const counterclockwise = decodeURIComponent(plateGraphic('50','逆向'));
  expect(clockwise).toContain('cx="44" cy="44"');
  expect(clockwise).not.toContain('scale(-1 1)');
  expect(counterclockwise).toContain('scale(-1 1)');
  const graphic = decodeURIComponent(plateGraphic('<script>','unknown')).split(',').slice(1).join(',');
  const svg = new DOMParser().parseFromString(graphic,'image/svg+xml');
  expect(svg.querySelector('parsererror, script')).toBeNull();
  expect(svg.querySelector('text')?.textContent).toBe('<script>');
});

it('enables floating controls for existing settings and preserves an explicit hidden preference', () => {
  localStorage.setItem(STORAGE_KEY,JSON.stringify({forceOnTop:true}));
  expect(loadSettings().floatingControls).toBe(true);
  localStorage.setItem(STORAGE_KEY,JSON.stringify({floatingControls:false}));
  expect(loadSettings().floatingControls).toBe(false);
  localStorage.clear();
});

it('places badges in all four corners and scales speed text independently', () => {
  const positions: [BadgePosition, number, number][] = [['top-left',12,12],['top-right',44,12],['bottom-left',12,44],['bottom-right',44,44]];
  for (const [badgePosition,x,y] of positions) {
    const svg = decodeURIComponent(plateGraphic('100','順向',{badgePosition,speedTextScale:1.5}));
    expect(svg).toContain(`cx="${x}" cy="${y}" r="10"`);
    expect(svg).toContain('cx="28" cy="28" r="18"');
    expect(svg).toContain('font-size="31.5"');
    expect(svg).toContain('textLength="30"');
  }
});

it('validates persisted appearance settings and gives existing users the bottom-right default', () => {
  expect(normalizeSettings({}).badgePosition).toBe('bottom-right');
  expect(normalizeSettings({floatingOpacity:0,plateScale:100,speedTextScale:NaN})).toMatchObject({floatingOpacity:.1,plateScale:4,speedTextScale:1});
});

it('rebases older sizes to the new 100% default once, while preserving new size settings', () => {
  localStorage.setItem(STORAGE_KEY,JSON.stringify({plateScale:2,speedTextScale:1.5,forceOnTop:true}));
  expect(loadSettings()).toMatchObject({sizeVersion:2,plateScale:1,speedTextScale:1,forceOnTop:true});
  expect(decodeURIComponent(plateGraphic('50','順向'))).toContain('font-size="21"');
  localStorage.setItem(STORAGE_KEY,JSON.stringify({sizeVersion:2,plateScale:.5,speedTextScale:2}));
  expect(loadSettings()).toMatchObject({plateScale:.5,speedTextScale:2});
  localStorage.clear();
});

it('uses independent direction colors and rejects unsafe color values', () => {
  const settings=normalizeSettings({clockwiseColor:'#123456',counterclockwiseColor:'#ABCDEF'});
  expect(decodeURIComponent(plateGraphic('50','順向'))).toContain('r="10" fill="#34c759"');
  expect(decodeURIComponent(plateGraphic('50','逆向'))).toContain('r="10" fill="#ff9500"');
  expect(decodeURIComponent(plateGraphic('50','順向',settings))).toContain('r="10" fill="#123456"');
  expect(decodeURIComponent(plateGraphic('50','逆向',settings))).toContain('r="10" fill="#abcdef"');
  expect(decodeURIComponent(plateGraphic('50','other',settings))).toContain('r="10" fill="#626772"');
  expect(normalizeSettings({clockwiseColor:'red" onload="alert(1)',counterclockwiseColor:'invalid'})).toMatchObject({clockwiseColor:'#34c759',counterclockwiseColor:'#ff9500'});
});
