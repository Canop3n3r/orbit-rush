# Credits

## Textures (licensed)
All files in `assets/tex/` are from **Solar System Scope** (https://www.solarsystemscope.com/textures/),
licensed **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/ —
obtained via Wikimedia Commons ("File:Solarsystemscope texture 2k …"). Changes: resized to 2048×1024 and 1024×512,
re-encoded as JPEG/PNG; the clouds and specular maps converted to greyscale.

| File | Source |
|---|---|
| earth_day*.jpg | Solarsystemscope texture 2k earth daymap |
| earth_night*.jpg | Solarsystemscope texture 2k earth nightmap |
| earth_clouds*.jpg | Solarsystemscope texture 2k earth clouds |
| earth_spec_1k.jpg | Solarsystemscope texture 2k earth specular map |
| moon*, mars*, mercury*, jupiter*, saturn*, uranus*, neptune*, sun*.jpg | Solarsystemscope texture 2k (same names) |
| venus*.jpg | Solarsystemscope texture 2k venus atmosphere |
| saturn_ring.png | Solarsystemscope texture 2k saturn ring alpha |
| milkyway*.jpg | Solarsystemscope texture 2k stars milky way |

## Libraries
- three.js (MIT) — https://threejs.org — loaded from jsDelivr.

## Original work
Rocket parts and paint, launch complex, concrete, panel normal maps, glow and environment textures, the smaller moons'
procedural maps, particle effects, sounds, the physics and the lessons are original procedural work for Orbit Rush.

## Vehicle models (art1)
All vehicle models, the catch tower and their textures in `gfx/vehicles/` are original procedural work for Orbit Rush (canvas-generated; no third-party textures, no logos). Proportions follow public dimensions collected in the team specs sheet.

## f5 world-1 (gfx/world/, Rocket Art Bot)
- Volumetric cloud coverage (weather map), cloud shadows, night lights, coastline mask and ocean specular reuse the Earth day/night/cloud/specular maps from Solar System Scope (CC BY 4.0, above); Moon and Mars detail tuning uses the Solar System Scope Moon/Mars maps (CC BY 4.0).
- All detail normals, regolith grain, Mars dust haze and cloud erosion noise are procedural and original (MaterialX noise from three.js, MIT). Lighting model: Beer-Powder + dual-lobe Henyey-Greenstein, techniques from public talks (Schneider, "The Real-time Volumetric Cloudscapes of Horizon Zero Dawn", SIGGRAPH 2015); no code or assets copied. KSP EVE/Scatterer were a visual reference only.
