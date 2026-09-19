/*
 * Integration test for the game loop in js/game.js.
 * Run with:  node tests/game.test.js
 *
 * game.js talks to the DOM only through the ui and renderer objects it is
 * handed, so stand-ins let the whole state machine run inside Node.
 */
'use strict';

var fs = require('fs');
var path = require('path');

global.window = {
  requestAnimationFrame: function () { return 1; },
  cancelAnimationFrame: function () {}
};

['config', 'storage', 'audio', 'snake', 'food', 'particles', 'game'].forEach(function (name) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'));
});

var S = global.window.SnakeGame;
var config = S.config;

var failures = [];
var passes = 0;

function check(label, condition, detail) {
  if (condition) {
    passes += 1;
    return;
  }
  failures.push(label + (detail ? ' -> ' + detail : ''));
}

/* --- Stand-ins ---------------------------------------------------------- */

function createUiStub() {
  var seen = { overlays: [], gameOver: null, countdown: [], hud: null, paused: null };
  return {
    seen: seen,
    on: function () {},
    setDifficultyActive: function () {},
    setWallsActive: function () {},
    setSoundState: function () {},
    updateBestLine: function () {},
    updateHud: function (values) { seen.hud = values; },
    setCountdown: function (text) { seen.countdown.push(text); },
    setPausedLabel: function (isPaused) { seen.paused = isPaused; },
    showOverlay: function (name) { seen.overlays.push(name); },
    showGameOver: function (summary) { seen.gameOver = summary; },
    hideGameOver: function () {}
  };
}

var scoreboard = {};

function createStorageStub() {
  return {
    getSettings: function () {
      return { difficulty: 'classic', walls: config.WALL_MODE.SOLID, sound: true };
    },
    saveSettings: function (settings) { scoreboard.savedSettings = settings; },
    getBestScore: function () { return 0; },
    submitScore: function (difficulty, score) {
      scoreboard.submitted = { difficulty: difficulty, score: score };
      return { saved: score > 0, best: score, previousBest: 0 };
    },
    resetBestScores: function () { scoreboard.reset = true; }
  };
}

function createAudioStub() {
  return {
    muted: false,
    played: [],
    isMuted: function () { return this.muted; },
    setMuted: function (value) { this.muted = value; },
    unlock: function () {},
    play: function (name) { this.played.push(name); },
    playDeathSequence: function () { this.played.push('death'); },
    playRecordFanfare: function () { this.played.push('record'); }
  };
}

function createRendererStub() {
  return { frames: 0, render: function () { this.frames += 1; } };
}

function makeGame() {
  var ui = createUiStub();
  var audio = createAudioStub();
  var storage = createStorageStub();
  var renderer = createRendererStub();
  var game = new S.Game({
    renderer: renderer,
    ui: ui,
    audio: audio,
    storage: storage,
    random: function () { return 0.5; }
  });
  return { game: game, ui: ui, audio: audio, storage: storage, renderer: renderer };
}

/** Runs `steps` grid advances without any countdown or timing interference. */
function advanceSteps(game, steps) {
  for (var i = 0; i < steps; i += 1) {
    game.advance();
  }
}

/* --- Board setup -------------------------------------------------------- */

var harness = makeGame();
var game = harness.game;
check('game starts in READY', game.state === config.GAME_STATE.READY);
check('board is prepared with fruit', Boolean(game.food.fruit));
check('snake starts at START_LENGTH', game.snake.segments.length === config.START_LENGTH);

/* --- Eating ------------------------------------------------------------- */

var head = game.snake.getHead();
game.food.fruit = { x: head.x + 1, y: head.y, type: 'fruit' };
advanceSteps(game, 1);

check('eating scores fruit * multiplier',
  game.score === Math.round(config.SCORING.fruit * config.DIFFICULTY.classic.scoreMultiplier),
  'score=' + game.score);
check('eating queues a growth segment',
  game.snake.getLength() === config.START_LENGTH + 1,
  'length=' + game.snake.getLength());
check('eaten fruit is replaced', Boolean(game.food.fruit));
check('new fruit is not under the snake',
  game.snake.occupies(game.food.fruit.x, game.food.fruit.y, true) === false);
check('hud refreshed with the new score', harness.ui.seen.hud.score === game.score);

/* Clear the food first so the queued growth can be observed in isolation. */
game.food.fruit = null;
game.food.bonus = null;
advanceSteps(game, 1);
check('queued growth materialises on the next step',
  game.snake.segments.length === config.START_LENGTH + 1,
  'length=' + game.snake.segments.length);

var secondHead = game.snake.getHead();
game.food.bonus = {
  x: secondHead.x + 1,
  y: secondHead.y,
  type: 'bonus',
  spawnedAt: 0,
  expiresAt: 999999,
  lifetimeMs: 7000
};
advanceSteps(game, 1);
check('bonus scores more than fruit',
  game.score === Math.round((config.SCORING.fruit + config.SCORING.bonusFruit) * 1.5),
  'score=' + game.score);
check('bonus queues two growth segments',
  game.snake.getLength() === config.START_LENGTH + 3,
  'length=' + game.snake.getLength());
check('bonus is consumed', game.food.bonus === null);

game.food.fruit = null;
game.food.bonus = null;
advanceSteps(game, 2);
check('bonus growth materialises',
  game.snake.segments.length === config.START_LENGTH + 3,
  'length=' + game.snake.segments.length);

/* --- Levels ------------------------------------------------------------- */

game.score = config.SCORING.pointsPerLevel * 2;
game.refreshLevel();
check('level rises with score', game.level === 3, 'level=' + game.level);
check('speed increases but is clamped',
  game.stepMs === Math.max(config.DIFFICULTY.classic.minStepMs,
    config.DIFFICULTY.classic.startStepMs - 2 * config.DIFFICULTY.classic.stepDecreaseMs),
  'stepMs=' + game.stepMs);

/* --- Countdown ---------------------------------------------------------- */

var countdownRun = makeGame();
countdownRun.game.beginRound();
check('beginRound enters countdown', countdownRun.game.state === config.GAME_STATE.COUNTDOWN);
check('countdown starts on the first value',
  countdownRun.ui.seen.countdown[countdownRun.ui.seen.countdown.length - 1] === config.COUNTDOWN_VALUES[0]);

/* Drive the countdown with realistic 60fps frames. */
var countdownFrames = 0;
while (countdownRun.game.state === config.GAME_STATE.COUNTDOWN && countdownFrames < 600) {
  countdownRun.game.update(16);
  countdownFrames += 1;
}
check('countdown shows every value',
  countdownRun.ui.seen.countdown.length === config.COUNTDOWN_VALUES.length,
  JSON.stringify(countdownRun.ui.seen.countdown));
check('countdown ends in PLAYING', countdownRun.game.state === config.GAME_STATE.PLAYING);
check('countdown lasts about 2.5s',
  countdownFrames >= 150 && countdownFrames <= 170,
  'frames=' + countdownFrames);
check('countdown overlay cleared', countdownRun.ui.seen.overlays[countdownRun.ui.seen.overlays.length - 1] === null);

/* --- Pause / resume ----------------------------------------------------- */

countdownRun.game.pause();
check('pause enters PAUSED', countdownRun.game.state === config.GAME_STATE.PAUSED);
check('pause label flips', countdownRun.ui.seen.paused === true);
countdownRun.game.resume();
check('resume returns to PLAYING', countdownRun.game.state === config.GAME_STATE.PLAYING);

/* --- Death by wall ------------------------------------------------------ */

var deathRun = makeGame();
deathRun.game.snake.segments = [{ x: config.GRID_SIZE - 2, y: 5 }];
deathRun.game.snake.direction = 'RIGHT';
deathRun.game.snake.growing = 0;
deathRun.game.state = config.GAME_STATE.PLAYING;
deathRun.game.score = 40;
advanceSteps(deathRun.game, 2);

check('wall crash ends the round', deathRun.game.state === config.GAME_STATE.GAME_OVER);
check('death reason mentions the wall', deathRun.game.deathReason === 'you hit the wall');
check('score is submitted on death',
  scoreboard.submitted && scoreboard.submitted.score === 40,
  JSON.stringify(scoreboard.submitted));
check('death sound plays', deathRun.audio.played.indexOf('death') !== -1);
check('record fanfare plays for a new best', deathRun.audio.played.indexOf('record') !== -1);
check('death particles are emitted', deathRun.game.particles.getParticles().length > 0);

/* The reveal is delayed, so pump frames until the panel appears. */
var revealFrames = 0;
while (!deathRun.ui.seen.gameOver && revealFrames < 200) {
  deathRun.game.update(16);
  revealFrames += 1;
}
check('game over panel is revealed after the delay', Boolean(deathRun.ui.seen.gameOver));
check('reveal takes about half a second', revealFrames >= 30 && revealFrames <= 40,
  'frames=' + revealFrames);
check('game over panel carries the score', deathRun.ui.seen.gameOver.score === 40);
check('game over panel is a record', deathRun.ui.seen.gameOver.isRecord === true);

/* --- Death by self ------------------------------------------------------ */

var selfRun = makeGame();
selfRun.game.snake.segments = [
  { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 },
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }
];
selfRun.game.snake.direction = 'DOWN';
selfRun.game.snake.growing = 0;
selfRun.game.state = config.GAME_STATE.PLAYING;
advanceSteps(selfRun.game, 1);
check('self collision ends the round', selfRun.game.state === config.GAME_STATE.GAME_OVER);
check('self collision reason is reported',
  selfRun.game.deathReason === 'you bit your own tail', selfRun.game.deathReason);

/* --- Wrap mode never kills on the edge ---------------------------------- */

var wrapRun = makeGame();
wrapRun.game.wallMode = config.WALL_MODE.WRAP;
wrapRun.game.snake.segments = [{ x: config.GRID_SIZE - 1, y: 5 }];
wrapRun.game.snake.direction = 'RIGHT';
wrapRun.game.snake.growing = 0;
wrapRun.game.state = config.GAME_STATE.PLAYING;
advanceSteps(wrapRun.game, 1);
check('wrap mode survives the edge', wrapRun.game.state === config.GAME_STATE.PLAYING);
check('wrap mode re-enters at column 0', wrapRun.game.snake.getHead().x === 0);

/* --- Settings ----------------------------------------------------------- */

var settingsRun = makeGame();
settingsRun.game.setDifficulty('insane');
check('difficulty switches', settingsRun.game.difficulty.id === 'insane');
check('difficulty is persisted', scoreboard.savedSettings.difficulty === 'insane');
settingsRun.game.setWallMode(config.WALL_MODE.WRAP);
check('wall mode switches', settingsRun.game.wallMode === config.WALL_MODE.WRAP);
settingsRun.game.toggleSound();
check('sound toggles off', settingsRun.audio.isMuted() === true);
settingsRun.game.resetBestScore();
check('best score can be reset', scoreboard.reset === true);

/* --- Render snapshot ---------------------------------------------------- */

var renderRun = makeGame();
renderRun.game.state = config.GAME_STATE.PLAYING;
renderRun.game.update(16);
check('updating alone does not paint', renderRun.renderer.frames === 0);
renderRun.game.draw(0);
check('draw paints exactly one frame', renderRun.renderer.frames === 1);

var frozenRun = makeGame();
frozenRun.game.state = config.GAME_STATE.PLAYING;
var snakeBefore = frozenRun.game.snake.getHead().x;
frozenRun.game.update(5000);
check('a huge delta cannot fast-forward the snake',
  frozenRun.game.snake.getHead().x - snakeBefore <= 1,
  'moved ' + (frozenRun.game.snake.getHead().x - snakeBefore));

/* --- Report ------------------------------------------------------------- */

console.log('passed: ' + passes);
if (failures.length > 0) {
  console.log('FAILED: ' + failures.length);
  failures.forEach(function (line) { console.log('  - ' + line); });
  process.exitCode = 1;
} else {
  console.log('all checks passed');
}
