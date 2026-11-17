# Moonlit Seascape — 500m Open World (Three.js)

An interactive 3D Three.js open-world coastal landscape inspired by classic romantic nocturnal seascapes.

## Features
- **500m × 500m Walkable Coastal Open World** (`-250m` to `+250m` on X and Z) with rugged headland cliffs, scrub-covered hills, instanced rocks/foliage, a winding dirt footpath, and two figures seated at the cliff edge overlook.
- **Custom GLSL Moonlit Ocean Shader** featuring multi-layered swells, Fresnel sky reflections, dark cloud-shadow bands, and a shimmering silver-gold moonlight reflection path.
- **Procedural Nocturnal Sky & Clouds** with a glowing full moon, atmospheric halo, subtle stars, and drifting moonlit cumulus clouds.
- **Distant Tall Ships** silhouetted on the horizon, bobbing gently on the waves.
- **First-Person Keyboard & Mouse Walkthrough** with pointer-lock camera look, `WASD`/Arrow movement, sprinting (`Shift`), jumping (`Space`), head-bob, terrain height following, and world boundary clamping.
-  (![Alt Text]https://github.com/farhaduli/moonlight/blob/6f97896477b0a511273f0a562bfcf1605da331e2/moonlight.PNG)

## How to Run
Because this project uses standard ES Modules (`<script type="module">`), serve the folder via any local HTTP server:

```bash
# Using Python 3
python -m http.server 8080

# Or using Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser and click **Enter World**.
