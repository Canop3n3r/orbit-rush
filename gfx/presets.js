// Graphics quality presets (gx1). Low: phones and software GPUs.
export const GFX_ORDER = ['low', 'med', 'high'];
export const GFX = {
  low: { tex: '_1k', bloom: false, pixel: 1, normalMaps: false, seg: 1, label: 'Low (phones, software GPU)' },
  med: { tex: '_1k', bloom: false, pixel: 1.25, normalMaps: true, seg: 1, label: 'Medium' },
  high: { tex: '', bloom: true, pixel: 1.5, normalMaps: true, seg: 1, label: 'High (bloom, 2K textures)' },
};
