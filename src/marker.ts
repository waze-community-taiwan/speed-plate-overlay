import type { ArrowStyle, BadgePosition, Settings } from './types';
import { DEFAULT_SETTINGS, normalizeBadgeColor } from './state';
const graphics = new Map<string, string>();
const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));

export function directionSymbol(direction: string, roadNumber = '', arrowStyle: ArrowStyle = 'four-direction'): string {
  if (arrowStyle === 'circular') return direction === '順向' ? '↻' : direction === '逆向' ? '↺' : '?';
  // Branch and temporary-route suffixes follow their parent highway number.
  const number = /^(?:台|臺)?\s*(\d+)/.exec(roadNumber.normalize('NFKC').trim())?.[1];
  if (!number || /^0+$/.test(number) || !['順向', '逆向'].includes(direction)) return '?';
  const even = Number(number.at(-1)) % 2 === 0;
  return even ? (direction === '順向' ? '→' : '←') : (direction === '順向' ? '↓' : '↑');
}

export function badgeOffset(position: BadgePosition): {x:number; y:number} {
  return { x: position.endsWith('right') ? 16 : -16, y: position.startsWith('bottom') ? 16 : -16 };
}

/** A centered face on a square canvas; badge position and text size are independent. */
export function plateGraphic(speed: string, direction: string, settings: Pick<Settings, 'badgePosition' | 'speedTextScale'> & Partial<Pick<Settings,'clockwiseColor' | 'counterclockwiseColor' | 'arrowStyle'>> = DEFAULT_SETTINGS, roadNumber = ''): string {
  const clockwise = normalizeBadgeColor(settings.clockwiseColor,DEFAULT_SETTINGS.clockwiseColor);
  const counterclockwise = normalizeBadgeColor(settings.counterclockwiseColor,DEFAULT_SETTINGS.counterclockwiseColor);
  const symbol = directionSymbol(direction, roadNumber, settings.arrowStyle);
  const key = JSON.stringify([speed, direction, symbol, settings.badgePosition, settings.speedTextScale,clockwise,counterclockwise]);
  const cached = graphics.get(key); if (cached) return cached;
  const known = symbol !== '?';
  const background = direction === '順向' ? clockwise : direction === '逆向' ? counterclockwise : '#626772';
  const channels = [1,3,5].map(index=>parseInt(background.slice(index,index+2),16)/255).map(c=>c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  const luminance = channels[0]!*.2126 + channels[1]!*.7152 + channels[2]!*.0722;
  const ink = (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
  const rotation = {'→':0, '↓':90, '←':180, '↑':270}[symbol];
  const straightArrow = `<g transform="rotate(${rotation} 10 10)" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 H17 M11 4 L17 10 L11 16"/></g>`;
  const circularArrow = `<g transform="${direction === '逆向' ? 'translate(20 0) scale(-1 1)' : ''}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 14 A7 7 0 1 1 17 7 M17 2 V7 H12"/></g>`;
  const arrow = settings.arrowStyle === 'circular' ? circularArrow : straightArrow;
  const offset = badgeOffset(settings.badgePosition), x = 28 + offset.x, y = 28 + offset.y;
  const fontSize = (speed.length > 3 ? 15 : 21) * settings.speedTextScale;
  const fit = speed.length * fontSize * .6 > 30 ? 'textLength="30" lengthAdjust="spacingAndGlyphs"' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="18" fill="white" stroke="#df3030" stroke-width="3"/>
    <text x="28" y="28" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" ${fit} font-weight="700" fill="#161616">${escapeXml(speed)}</text>
    <circle cx="${x}" cy="${y}" r="10" fill="${background}" stroke="white" stroke-width="1.5"/>
    <g transform="translate(${x-8} ${y-8}) scale(.8)">${known ? arrow : `<text x="10" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="${ink}">?</text>`}</g>
  </svg>`;
  const graphic = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (graphics.size >= 512) graphics.clear();
  graphics.set(key, graphic); return graphic;
}
