# Dead Frequency — status and next steps

## State at end of session 2
VERIFIED by automated tests (`npm test`, and `tests/e2e.cjs` in headless Chromium on seeds 11, 2024 and 303 — 42 checks each):
- All 10 firearms: picked up from the ground, refuse to fire unloaded, fire after their own procedure using simulated key/mouse input.
- Stovepipe blocks firing until racked; weapon and attachment wear; catastrophic failure is permanent; weapons drop.
- Loot pickup, containers, attach/detach (incompatible attachments not offered), dropping items, pack capacity.
- Doors; infected see, pursue and attack; armor absorbs and wears; gunshots attract; headshot kills; bleeding, bandage, trauma kit.
- All 10 tapes collectable and play in order; a recording plays to the end; extraction gated on 10/10; beacon, gate, truck, boarding, ending screen.
- New run after extraction; death screen; new run after death is a different town; pause/resume. No console errors.
VERIFIED by reviewing screenshots: street, overview, interior, night, all 10 weapons in hip / aim / inspect pose, scope overlay with cracked lens, all 5 infected types.
NOT VERIFIED: anything on a real GPU (frame rate, texture filtering, light levels), audio (never listened to), feel of the mouse-drag weapon handling, pointer-lock behaviour in a real browser, key rebinding UI, tape narration voice.

Bugs found and fixed in session 2: ~40% of shelf/rack loot and most containers could not be targeted (aim point was inside the furniture's collision box); long-gun aim put the camera inside the receiver; guns rendered as black silhouettes (high metalness, no environment map); grass tufts black from behind; light intensities far too low for three.js physical units.

Test harness: Playwright is at /opt/node-tools/node_modules; `window.DF` is the Game object. SwiftShader is slow, so tests replace `DF.render` and call `DF.step()` directly.

## 1. Visual pass
- [x] Screenshot street, interior, night, overview and fix what was wrong.
- [x] All 10 weapon models in hip / aim / inspect pose; sights sit on screen centre.
- [x] Infected bodies (all 5 types).
- [ ] Light levels (flashlight, penlight, night ambient, interiors) were tuned only under the software renderer — re-check on a real GPU.
- [ ] Door swing direction, roof gables, gate leaves, signs and ivy have not been looked at up close.
- [ ] Ground shows banding at grazing angles under SwiftShader (mip/anisotropy); confirm whether a real GPU shows it.

## 2. Full-loop automated test
- [x] Done — see tests/e2e.cjs. Not covered: zombies opening doors, pointer-lock flows, rebinding, map and document overlays.

## 3. Known risks
- [x] Mesh count: distance culling for pickups, doors and infected (about 4,500 -> under 500 visible meshes). Real-GPU frame rate still unmeasured.
- [x] Infected count reduced (avg 47 per town, was 81).
- [x] Loot ammunition reduced (avg ~560 loose rounds per town, was ~720). Still a guess — needs play balance.
- [ ] Mouse-drag feel for slide/bolt/pump (player.js: `f.drag(inp.dy / 150)`) is untested by hand.
- [ ] Tape narration uses the browser's speechSynthesis voice (falls back to a synthesized murmur + subtitles). No recorded actors.
- [ ] Extraction truck collision box is axis-aligned and approximate.
- [ ] Buildings are single-storey; "skeletal animation" is jointed procedural rigs, not skinned meshes.

## 4. Polish backlog
- [x] Weapon sway from mouse movement; visible loose round in left hand while loading.
- [x] HUD panels hide under the pack / map / document overlays; larger map with readable labels; brighter exterior walls; start hints use the player's real key bindings.
- [x] e2e check that infected batter a closed door open (43 checks total).
- [ ] Boarded windows / more environmental storytelling props; interior light shafts.
- [ ] Balance pass on damage, zombie speeds, bleed rates, weapon wear rates.
- [ ] Optional: publish a single-file build as an Artifact so it can be played without a local server.

## 5. Player feedback after first playtest
Overall verdict from the player: the gun system itself is solid; the problem is readability, not mechanics.

- [x] **Guns are too dark to read.** Finishes lifted, metalness lowered, viewmodel light floor + rim light, darker contrasting sights/serrations/ejection port.
- [x] **Text is hard to read.** HUD, prompts, subtitles, inspect panel, inventory and manual now use a sans-serif at larger sizes on solid backing plates.
- [x] **More visibility of inventory status.** Always-visible carry summary (top right): held weapon, left-hand item, loose rounds of the weapon's calibre, spare magazines, bandages, trauma kits, pack fill.
- [x] **Fewer zombies; more tactical pacing.** Population roughly halved; reinforcements arrive more slowly and only below 50% of the starting count. Needs a playtest to confirm the feel.
- [x] **Night removed** (player request): the sun now drifts between 07:30 and 16:48 and back; it never gets dark. Flashlights and the weapon-light attachment still exist but matter only indoors.
- [ ] **Better graphics.** Partly addressed (lighting, interiors, gun materials, grass). Still open: ask which areas matter most — world, weapons, infected or lighting. Trees and props are still very low-poly.
- [ ] **More visibility of weapon status** — OPEN QUESTION, not implemented. Conflicts with the original spec ("firearm status should primarily be learned through physical inspection", "do not automatically identify the malfunction"). Options: (a) a status readout of external, visible state only (safety, hammer, slide position, magazine present) but never chamber/round count/malfunction name; (b) a full readout; (c) an "assist" toggle in Settings, off by default.
- [ ] **Suggest the next action for the current weapon state** — OPEN QUESTION, not implemented, same conflict. Need to know: should hints cover malfunctions, and should they be toggleable?
