# Orbit Rush UI icons (Rocket Art Bot, original, CC0 for this project)
24×24 stroke icons (2 px stroke, round caps, `currentColor`) so they inherit the button colour and stay legible on phones (use ≥ 24 px; 32–44 px in touch targets). Every file has `<title>` and `aria-label` set.
- Builder part types (main.js `TYPE_ORDER`): part-pod, part-payload, part-fairing, part-tank, part-engine, part-decoupler, part-fins, part-rcs, part-shield, part-chute
- Customize categories (ui_ideal_path #9/#10): Nose = part-nose, Payload = part-payload, Tanks = part-tank, Engine = part-engine, Legs/Recovery = part-legs
- Home: home-missions (◎), home-customize (✎), home-settings (⚙)
Use them inline (`fetch` the SVG and insert it, so `currentColor` applies) or as `<img>` with a CSS filter. Contact sheet: `index.html`.
