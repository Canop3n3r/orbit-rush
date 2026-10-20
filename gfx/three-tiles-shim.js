// "three" for 3d-tiles-renderer: the game's WebGPU build of three.js plus a stub for the one WebGL-only class the
// library imports (only used by optional WebGL-specific plugins that Orbit Rush doesn't register).
export * from 'three/webgpu';
export class WebGLRenderer { constructor() { throw new Error('WebGLRenderer is not available (Orbit Rush renders through WebGPURenderer)'); } }
