# Dead Frequency

First-person survival horror / extraction game with a mechanical firearm simulation.
Three.js (vendored), no build step, no external assets — geometry, textures and audio are all generated in code.

## Run it

Needs Node 18+ (or any static file server) and a desktop browser (Chrome/Edge recommended).

```bash
cd dead-frequency
node server.js
```

Open http://localhost:8080 — click NEW RUN (optionally type a town seed). Headphones recommended.

No Node? `python3 -m http.server 8080` in the same folder works too. Opening index.html directly from disk does NOT work (ES modules need http).

## Tests

```bash
npm test
```

Runs the firearm-simulation unit tests (all 10 weapons, malfunctions, ammo conservation fuzz) and the world-generation invariants (40 seeds).

## Controls (all rebindable in Settings; full manual in-game under FIELD MANUAL)

WASD move · Shift sprint · C crouch · Space jump · F interact · Tab pack · M map · L flashlight · 3 bandage · 4 trauma kit
LMB trigger · RMB aim · B inspect (hold) · 1/2 sidearm/primary · G drop weapon
Hold R + move mouse: slide / bolt / pump · T slide stop / bolt catch / action release
E magazine release-insert / cylinder latch / loading gate · V tap magazine / ejector rod
Q draw-stow magazine · Z load one round · X safety / decocker · H hammer · wheel spin cylinder

## Layout

- `src/firearm.js`, `src/data/weapons.js` — data-driven mechanical firearm simulation (pure logic)
- `src/worldgen.js`, `src/loot.js`, `src/data/props.js` — seeded procedural town (pure logic)
- `src/worldbuild.js`, `src/sky.js`, `src/weaponmodels.js`, `src/viewmodel.js` — rendering
- `src/player.js`, `src/inventory.js`, `src/pickups.js`, `src/ballistics.js` — player, items, bullets
- `src/zombies.js`, `src/nav.js`, `src/collision.js` — infected AI, pathfinding, collision
- `src/audio.js`, `src/tapes.js`, `src/data/story.js` — synthesized audio, tape playback, narrative
- `src/ui.js`, `src/main.js`, `index.html`, `css/` — interface and game loop

See TODO.md for current status and what is not yet verified.
