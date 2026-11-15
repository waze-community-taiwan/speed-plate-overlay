import { expect, it } from 'vitest';
import { directionSymbol, plateGraphic } from '../../src/marker';
import { loadSettings } from '../../src/state';
import { STORAGE_KEY } from '../../src/constants';
import { normalizeSettings } from '../../src/state';
import type { BadgePosition } from '../../src/types';

it('defaults existing settings to four directions and restores only valid optional styles', () => {
  expect(normalizeSettings({}).arrowStyle).toBe('four-direction');
  expect(normalizeSettings({arrowStyle:'circular'}).arrowStyle).toBe('circular');
  localStorage.setItem(STORAGE_KEY,JSON.stringify({arrowStyle:'invalid'}));
  expect(loadSettings().arrowStyle).toBe('four-direction');
  localStorage.clear();
});

it('offers original mirrored circular arrows with adaptive contrast and no road-number requirement', () => {
  const settings=normalizeSettings({arrowStyle:'circular',clockwiseColor:'#123456',counterclockwiseColor:'#abcdef'});
  const forward=decodeURIComponent(plateGraphic('50','順向',settings));
  const reverse=decodeURIComponent(plateGraphic('50','逆向',settings));
  expect(forward).toContain('M18 14 A7 7');
  expect(forward).not.toContain('scale(-1 1)');
  expect(forward).toContain('stroke="#ffffff" stroke-width="2"');
  expect(reverse).toContain('scale(-1 1)');
  expect(reverse).toContain('stroke="#000000" stroke-width="2"');
  expect(directionSymbol('順向','','circular')).toBe('↻');
  expect(directionSymbol('逆向','','circular')).toBe('↺');
  expect(directionSymbol('unknown','台2','circular')).toBe('?');
  expect(decodeURIComponent(plateGraphic('50','順向',settings,'台2'))).not.toContain('rotate(0');
  expect(decodeURIComponent(plateGraphic('50','順向',undefined,'台2'))).toContain('rotate(0');
});

it('renders straight arrows and safely escapes imported speed text', () => {
  const clockwise = decodeURIComponent(plateGraphic('50','順向',undefined,'台2'));
  const counterclockwise = decodeURIComponent(plateGraphic('50','逆向',undefined,'台2'));
  expect(clockwise).toContain('cx="44" cy="44"');
  expect(clockwise).toContain('rotate(0 10 10)');
  expect(counterclockwise).toContain('rotate(180 10 10)');
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


it.each([
  ['台2', '→', '←'], ['台4', '→', '←'], ['台6', '→', '←'],
  ['台1', '↓', '↑'], ['台3', '↓', '↑'], ['台61', '↓', '↑'],
  ['台2甲', '→', '←'], ['台9丁', '↓', '↑'], ['台20臨105', '→', '←'],
  [' 臺１甲 ', '↓', '↑'],
])('maps %s to forward %s and reverse %s', (road, forward, reverse) => {
  expect(directionSymbol('順向',road)).toBe(forward);
  expect(directionSymbol('逆向',road)).toBe(reverse);
});

it('renders all four arrow orientations without reusing a cached direction', () => {
  for (const [road,direction,rotation] of [['台2','順向',0],['台2','逆向',180],['台1','順向',90],['台1','逆向',270]] as const) {
    expect(decodeURIComponent(plateGraphic('50',direction,undefined,road))).toContain(`rotate(${rotation} 10 10)`);
  }
  for (const road of ['', 'unknown', '台', '台0']) {
    expect(directionSymbol('順向',road)).toBe('?');
    expect(decodeURIComponent(plateGraphic('50','順向',undefined,road))).toContain('>?</text>');
  }
  expect(directionSymbol('unknown','台2')).toBe('?');
});

it.each([
  ['#000000','#ffffff'], ['#123456','#ffffff'], ['#ffffff','#000000'],
  ['#abcdef','#000000'], ['#00ff00','#000000'], ['#ff0000','#000000'],
  ['#757575','#ffffff'], ['#767676','#000000'],
])('chooses the higher-contrast arrow stroke for %s', (color,ink) => {
  for (const direction of ['順向','逆向']) {
    const settings=normalizeSettings({clockwiseColor:color,counterclockwiseColor:color});
    expect(decodeURIComponent(plateGraphic('50',direction,settings,'台2'))).toContain(`stroke="${ink}" stroke-width="2.5"`);
  }
});
