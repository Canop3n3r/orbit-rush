# Orbit Rush

Orbit Rush is a rocket simulator and arcade game that runs in the browser, on phones and desktops. Pick a rocket, launch it, fly it to orbit, land the boosters, and try not to blow it up.

**Play:** https://canop3n3r.github.io/orbit-rush/

All rocket, company and place names in the game are parodies. Nothing here is affiliated with or endorsed by any real company or agency.

## How to play

1. On Home, pick a rocket from the gallery and press **Fly**.
2. Press **Space** (or the on-screen STAGE button) to light the engines, then press it again to release each stage.
3. Steer with the keys or the on-screen navball and sticks. **AUTO** (F) flies the ascent for you; steer or press F again to take over.
4. Reach orbit, deliver the payload, land the boosters, and use time warp to skip the coast.

Desktop keys: Space stage, Shift/Ctrl throttle, Z/X full/cut throttle, W/S A/D Q/E pitch, yaw and roll, T and `,` time warp, M map, Esc pause. Keys can be remapped in Settings. On phones, drag the navball to steer; the rest are on-screen buttons.

## Run it locally

It is a static site with no build step. Serve the folder with any web server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/. Use a browser with WebGPU for the best results; add `?webgl` to the URL to force the WebGL2 renderer.

## Tech

- Plain JavaScript modules and [three.js](https://threejs.org) (WebGPU renderer with an automatic WebGL2 fallback).
- A custom physics engine: RK4 flight, Kepler rails for time warp, atmosphere, heating and reentry, patched-conic transfers.
- Procedural 3D rocket models and synthesized WebAudio sound; no external audio or model files.
- Saved settings live in `localStorage`; the game makes no network calls to any backend.
- Tests are plain Node scripts in `tests/` (run `node tests/run.mjs`) plus headless-browser smoke tests in `tests/smoke/`.

## License

MIT, see [LICENSE](LICENSE).

## Credits

See [CREDITS.md](CREDITS.md): planet textures are from Solar System Scope (CC BY 4.0), launch vehicle data uses the GCAT catalog (CC BY 4.0, author credit in CREDITS.md), and three.js is MIT licensed.
