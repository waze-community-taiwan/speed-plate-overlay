import { expect, it } from 'vitest';
import { scaleToSlider, sliderToScale } from '../../src/size-scale';

it('aligns 100% at the shared midpoint and preserves each full resize range', () => {
  for (const maximum of [2,4]) {
    expect(scaleToSlider(1,maximum)).toBe(100);
    expect(sliderToScale(0,maximum)).toBe(.25);
    expect(sliderToScale(100,maximum)).toBe(1);
    expect(sliderToScale(200,maximum)).toBe(maximum);
    for (const scale of [.25,.5,1,1.5,maximum]) expect(sliderToScale(scaleToSlider(scale,maximum),maximum)).toBeCloseTo(scale,12);
  }
});
