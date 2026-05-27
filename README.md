# iso-game

Browser-based isometric multiplayer character game scaffold.

Stack: Next.js (App Router), React, Phaser 3, TypeScript, optional Colyseus client.

## Run

```
npm install
npm run prepare:character-sprites
npm run dev
```

Open http://localhost:3000.

## Multiplayer

Set `NEXT_PUBLIC_COLYSEUS_URL` to enable Colyseus connectivity. If unset, the client runs in offline mode with no remote players.

## Character art

Drop your real atlas into `assets/character/`:
- `character-iso-sheet.png`
- `character-iso-sheet.json`

See `assets/character/README.md` for the atlas contract. If absent, the prep script generates a recognizable placeholder so the game still runs end-to-end. Placeholder generation happens at compile time only; Phaser never draws character pixels at runtime.

## Prep script

`scripts/prepare-character-sprites.mjs` copies (or generates) the atlas into `public/sprites/character/` and writes `manifest.json` listing the animation set.
