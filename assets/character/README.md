# Character atlas

Drop a TexturePacker-style atlas here:

- `character-iso-sheet.png`
- `character-iso-sheet.json` (JSONHash or JSONArray)

## Contract

- Frame size: 256 x 256
- Frame name format: `<action>_<direction>_<NN>` (NN zero-padded)
- Directions: `se`, `sw`, `ne`, `nw`
- Required animations and frame counts:
  - `idle_se` x 4
  - `walk_se` x 4
  - `walk_sw` x 4
  - `walk_ne` x 4
  - `walk_nw` x 4
  - `attack_se` x 4
  - `attack_sw` x 4

`attack_ne` mirrors `attack_sw` (flipX). `attack_nw` mirrors `attack_se` (flipX). Idle for west-facing directions flips `idle_se`.

If either file is missing, `scripts/prepare-character-sprites.mjs` generates a placeholder atlas that satisfies this contract.
