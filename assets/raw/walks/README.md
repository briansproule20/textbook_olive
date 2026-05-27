# Character Walk Strips

This directory is the **template input** for character sprite generation. Drop two raw PNGs here per character and the prep script does the rest.

## Convention

```
assets/raw/walks/
  <character-id>/
    se.png    # 1024×1024, 2×2 grid of 4 walk-cycle frames, character facing south-east
    ne.png    # 1024×1024, 2×2 grid of 4 walk-cycle frames, character facing north-east
```

- `se.png` shows the character walking *toward* the camera-right (front-right view).
- `ne.png` shows the character walking *away* from the camera (back-right view).
- The other two facings (`sw`, `nw`) are produced automatically by horizontal flip in the prep script — do not generate them.
- Frames inside the 2×2 grid are read in this order: top-left=frame 0, top-right=frame 1, bottom-left=frame 2, bottom-right=frame 3. Frames should depict: 1) contact pose, 2) passing pose with opposite leg lifted, 3) opposite contact pose, 4) passing pose mirrored.
- Background must be near-white or transparent; the prep script flood-fills any near-white pixels connected to the border. Interior light pixels (eye whites, blaze, highlights) are preserved.

## Adding a new character

1. Generate `se.png` and `ne.png` for the new character (see prompt template below) and save them to `assets/raw/walks/<id>/`.
2. Add the character id to:
   - `CHARACTERS` array in `scripts/prepare-assets.mjs`
   - `CHARACTERS` array in `src/game/sprites/characterTextures.ts`
3. Run `npm run prepare:assets` and `npm run build`. The new character appears in the picker.

## Prompt template (gpt-image-2)

For each direction (replace `{SPECIES}` and `{FACING}`):

```
2x2 grid of four sequential walk-cycle frames of the SAME {SPECIES}, fully
transparent background between frames. Each cell shows the same character from
the SAME isometric 3/4 {FACING} camera angle. Same scale and position; only
leg pose differs:
- TOP-LEFT (frame 1): contact pose, right front planted forward, left back
  planted forward, opposite limbs behind
- TOP-RIGHT (frame 2): passing pose, left front lifted in mid-stride, right
  back lifted, body slightly raised
- BOTTOM-LEFT (frame 3): contact mirror of frame 1
- BOTTOM-RIGHT (frame 4): passing mirror of frame 2
Hand-painted Stardew Valley style. Soft cel-shading. Clean dark outline.
No shadow. No ground. No UI. No text. Each frame centered with transparent
space around the character.
```

- For `se.png` use `{FACING} = right-front (facing toward bottom-right of screen, toward southeast)`.
- For `ne.png` use `{FACING} = back-right (walking away from viewer toward top-right of screen, viewer sees back, tail, rear legs)`.
- Always use gpt-image-2 (`quality: "high"`, `size: "1024x1024"`, `background: "auto"`).

## What the prep script produces

For each character, the prep script writes a single 1024×1792 atlas sheet (`<id>.png`) with these rows of 4 frames each:

| Row | Animation key | Strip used     | Notes                                     |
| --- | ------------- | -------------- | ----------------------------------------- |
| 0   | `idle_se`     | `se` frame 0   | Subtle 2 px breathing bob across frames   |
| 1   | `walk_se`     | `se` 0..3      | Real walk cycle                           |
| 2   | `walk_sw`     | `se` 0..3 (flipped X) | Same cycle, mirrored                |
| 3   | `walk_ne`     | `ne` 0..3      | Real walk cycle, back view                |
| 4   | `walk_nw`     | `ne` 0..3 (flipped X) | Same cycle, mirrored                |
| 5   | `attack_se`   | `se` frame 0   | Static (no bob)                           |
| 6   | `attack_sw`   | `se` frame 0 (flipped X) | Static                          |
