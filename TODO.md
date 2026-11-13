# Dead Frequency — status and next steps

## State at end of session 1
All systems are written. VERIFIED: firearm sim unit tests pass (12 groups); worldgen invariants pass on 40 seeds;
the game boots in headless Chromium, a run starts (seed 7) and reaches the play state with no console/page errors.
NOT YET VERIFIED: nothing has been looked at or played. No screenshot was reviewed. Everything below "boots" is untested.

Test harness from session 1 (recreate if gone): Playwright is at /opt/node-tools/node_modules; launch Chromium with
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`; `window.DF` is the Game object. SwiftShader is
~1.6 s/frame at full quality, so set localStorage df_settings {shadows:false, renderScale:0.5} and use long screenshot timeouts.

## 1. Visual pass (do first)
- [ ] Screenshot street, interior, night, overview; fix whatever is wrong (winding, dark interiors, sign facing, ivy, door swing direction, roof gables, gate leaves).
- [ ] Check each of the 10 weapon models in hip / ADS / inspect pose; verify iron sights line up with screen centre and hands look acceptable.
- [ ] Check zombie bodies (all 5 types), prone crawler pose, death fall.
- [ ] Tune light intensities (flashlight, penlight, muzzle flash, night ambient, viewmodel lighting).

## 2. Full-loop automated test (spec section 19)
- [ ] Drive via window.DF: pick up + manipulate every firearm in-engine, collect all 10 tapes, key beacon, truck arrives, extract, ending shows.
- [ ] Death -> new run generates a different town; equipment reset.
- [ ] Zombies: detect, path through doors, attack; armor absorbs; bleed; medkit/bandage.
- [ ] Loot: take, drop, containers open, attach/detach attachments, pack capacity.
- [ ] Pointer-lock flows: pause/resume, inventory/map/note overlays, rebinding.

## 3. Known risks / likely bugs
- [ ] Performance: 4,479 meshes / 420k tris in the scene. ~310 loot meshes, ~80 zombies x ~25 meshes, ~400 doors. Consider distance culling for pickups/zombie groups and merging zombie parts. Target 60 fps on a real GPU is unmeasured.
- [ ] Zombie count seed 7 = 102 (target ~80); tune INDOOR weights in worldgen.js.
- [ ] Loot quantity (avg ~720 loose rounds per town) is probably too generous; tune loot.js.
- [ ] Mouse-drag feel for slide/bolt/pump (player.js: `f.drag(inp.dy / 150)`) is untested by hand.
- [ ] Tape narration uses the browser's speechSynthesis voice (falls back to a synthesized murmur + subtitles). No recorded actors.
- [ ] Speech pause/resume on game pause; tape timing when speech is unavailable.
- [ ] Extraction truck collision box is axis-aligned and approximate.
- [ ] Buildings are single-storey; "skeletal animation" is jointed procedural rigs, not skinned meshes.

## 4. Polish backlog
- [ ] Weapon sway from mouse movement; visible loose round in left hand while loading.
- [ ] Boarded windows / more environmental storytelling props; interior light shafts.
- [ ] Balance pass on damage, zombie speeds, bleed rates, weapon wear rates.
- [ ] Optional: publish a single-file build as an Artifact so it can be played without a local server.

## 5. Player feedback after first playtest (added, NOT implemented)
Overall verdict from the player: the gun system itself is solid; the problem is readability, not mechanics.

- [ ] **Better graphics.** General visual quality needs to come up (no specifics given yet — ask which areas matter most: world, weapons, infected, lighting).
- [ ] **Guns are too dark to read.** The weapon models are dark-on-dark, so it is hard to tell what the gun is doing at any moment. Likely fixes: brighter/less saturated-black gun materials, stronger viewmodel lighting (especially indoors and at night), more contrast on moving parts (slide, hammer, safety, chamber round, magazine).
- [ ] **More visibility of weapon status.** Hard to tell the gun's state at a glance. Note this pulls against the original spec ("firearm status should primarily be learned through physical inspection", "do not automatically identify the malfunction") — confirm with the player how far to go before adding a status readout.
- [ ] **More visibility of inventory status.** Player cannot easily tell what they are carrying (ammo, magazines, meds, pack space) without opening the pack.
- [ ] **Text is hard to read.** HUD, prompts, subtitles, inspect panel, menus: larger size, higher contrast, possibly a different font than Courier.
- [ ] **Suggest the next action for the current weapon state.** Contextual hints such as "hammer is down — press H" or "slide locked back — press T". Same spec tension as above: confirm whether hints should also cover malfunctions, and whether they should be toggleable.
- [ ] **Fewer zombies; more tactical pacing.** Reduce the infected population (currently ~80 average, 102 on seed 7) so encounters are deliberate rather than constant. Tune INDOOR weights, pack count/size and the respawn rule in worldgen.js / zombies.js.
