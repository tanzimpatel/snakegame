# CRT SNAKE

A retro arcade Snake game rendered on `<canvas>`, styled as a phosphor-green CRT
cabinet. Pure vanilla JavaScript — no build step, no dependencies, no assets.

## Play

Open `index.html` directly in a browser, or serve the folder:

```
npm run serve      # http://localhost:5173
```

Everything works from `file://` as well, because the scripts are classic
(non-module) scripts.

## Controls

| Action | Keys |
| --- | --- |
| Steer | Arrow keys or `W` `A` `S` `D` |
| Pause / resume | `Space` or `P` |
| Restart | `R` or `Enter` |
| Mute / unmute | `M` |

On touch devices you can swipe anywhere on the board, or use the on-screen
d-pad. The game pauses itself when the tab loses focus.

## Rules

- **Fruit** — `+10` points and one extra segment.
- **Golden fruit** — `+50` points and two extra segments, but it expires.
  The ring around it shows the time remaining.
- **Walls** — deadly in `solid` mode, pass-through in `wrap` mode.
- **Difficulty** — `chill`, `classic` and `insane` change the starting speed,
  the acceleration curve and the score multiplier.
- Speed rises with your level (`+1` level per 60 points). The board is 24x24,
  so a perfect run is 576 segments long.

Scores and settings are stored in `localStorage`; if storage is unavailable
(private browsing, sandboxed frames) the game falls back to in-memory state
and keeps working.

## Project layout

```
index.html            markup for the cabinet, HUD and overlays
style.css             CRT styling: scanlines, phosphor glow, responsive layout
js/
  config.js           all tuning constants (grid, speeds, scoring, palette)
  storage.js          guarded localStorage wrapper with in-memory fallback
  audio.js            procedural sound effects via the Web Audio API
  input.js            keyboard, swipe and d-pad -> semantic game intents
  snake.js            snake entity: segments, heading, collision rules
  food.js             fruit and timed golden-bonus spawning
  particles.js        short-lived pixel debris
  renderer.js         canvas painter, interpolates between grid steps
  ui.js               DOM wiring for the HUD, overlays and settings
  game.js             state machine and fixed-step simulation loop
  main.js             bootstrap: builds the objects and wires them together
tests/
  logic.test.js       headless tests for snake, food and particles
  game.test.js        headless tests for the full game loop (stubbed DOM)
  mobile-preview.html dev harness that shows the game at 375px and 320px
```

The dependency direction is one way: `main.js` knows about everything,
`game.js` only talks to the objects it is handed, and `snake.js` / `food.js` /
`particles.js` know nothing about the DOM or the canvas. That is what makes the
two test suites possible without a browser.

## Tests

```
npm test
```

Runs both headless suites in Node:

- `tests/logic.test.js` — 29 checks over movement, turning rules, wall and
  self collisions, growth, food placement (including a completely full board),
  bonus expiry and particle lifetime.
- `tests/game.test.js` — 46 checks over the game loop: eating and scoring,
  level and speed progression, the 3-2-1-GO countdown, pause/resume, both
  death paths, the delayed game-over panel, settings persistence and the
  frame-delta guard.

## Notes on timing

The simulation is a fixed-step loop: `update()` accumulates elapsed time and
advances the snake in discrete grid steps, while the renderer interpolates
between the previous and current positions so movement looks smooth. Frame
deltas are clamped, so a backgrounded tab or a slow frame cannot fast-forward
the snake into a wall.
