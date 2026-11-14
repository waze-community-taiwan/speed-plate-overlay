/** Share a midpoint at 100%, retaining each control's supported size range. */
export function sliderToScale(position: number, maximum: number): number {
  const value = Math.max(0,Math.min(200,position));
  return value <= 100 ? .25 + .75*value/100 : 1 + (maximum-1)*(value-100)/100;
}

export function scaleToSlider(scale: number, maximum: number): number {
  return scale <= 1 ? (scale-.25)/.75*100 : 100 + (scale-1)/(maximum-1)*100;
}
