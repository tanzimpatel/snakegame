/*
 * Headless test suite for the pure game logic (snake, food, particles).
 * Run with:  node tests/logic.test.js
 *
 * These modules only touch `window` as a namespace, so they can be loaded
 * straight into Node without a DOM or a browser.
 */
'use strict';

global.window = {};

var fs = require('fs');
var path = require('path');

['config', 'snake', 'food', 'particles'].forEach(function (name) {
  var file = path.join(__dirname, '..', 'js', name + '.js');
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
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

/* --- Snake basics ------------------------------------------------------- */
var snake = new S.Snake();
check('initial length is START_LENGTH', snake.segments.length === config.START_LENGTH,
  'got ' + snake.segments.length);
check('initial direction is RIGHT', snake.direction === 'RIGHT');
check('initial heading is horizontal', snake.segments[0].y === snake.segments[1].y);

var beforeHead = snake.getHead().x;
var result = snake.step(config.WALL_MODE.SOLID);
check('step moves', result.moved === true);
check('head advances right', snake.getHead().x === beforeHead + 1);
check('length unchanged without growth', snake.segments.length === config.START_LENGTH);

/* --- Turn rules --------------------------------------------------------- */
check('opposite turn rejected', snake.queueTurn('LEFT') === false);
check('perpendicular turn accepted', snake.queueTurn('UP') === true);
check('same turn rejected', snake.queueTurn('UP') === false);
snake.applyQueuedTurn();
check('queued turn applied', snake.direction === 'UP');

/* --- Wall collision ----------------------------------------------------- */
var wallSnake = new S.Snake();
wallSnake.segments = [{ x: config.GRID_SIZE - 1, y: 5 }];
wallSnake.direction = 'RIGHT';
wallSnake.growing = 0;
var wallResult = wallSnake.step(config.WALL_MODE.SOLID);
check('solid wall stops the snake', wallResult.outOfBounds === true && wallResult.moved === false);

/* --- Wrap mode ---------------------------------------------------------- */
var wrapSnake = new S.Snake();
wrapSnake.segments = [{ x: config.GRID_SIZE - 1, y: 5 }];
wrapSnake.direction = 'RIGHT';
wrapSnake.growing = 0;
var wrapResult = wrapSnake.step(config.WALL_MODE.WRAP);
check('wrap mode teleports to column 0', wrapResult.moved === true && wrapSnake.getHead().x === 0);

/* --- Growth ------------------------------------------------------------- */
var growSnake = new S.Snake();
var lengthBefore = growSnake.segments.length;
growSnake.grow(1);
growSnake.step(config.WALL_MODE.SOLID);
check('growing adds a segment', growSnake.segments.length === lengthBefore + 1,
  'got ' + growSnake.segments.length);
check('growth counter consumed', growSnake.growing === 0);

/* --- Self collision ----------------------------------------------------- */
var selfSnake = new S.Snake();
selfSnake.segments = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 6, y: 6 },
  { x: 5, y: 6 },
  { x: 4, y: 6 },
  { x: 4, y: 5 }
];
selfSnake.direction = 'DOWN';
selfSnake.growing = 0;
var selfResult = selfSnake.step(config.WALL_MODE.SOLID);
check('turning into own body is fatal', selfResult.selfCollision === true,
  JSON.stringify(selfResult));

/* --- Tail chase is allowed --------------------------------------------- */
var chaseSnake = new S.Snake();
chaseSnake.segments = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 6, y: 6 },
  { x: 5, y: 6 }
];
chaseSnake.direction = 'DOWN';
chaseSnake.growing = 0;
var chaseResult = chaseSnake.step(config.WALL_MODE.SOLID);
check('following your own tail is legal', chaseResult.moved === true,
  JSON.stringify(chaseResult));

/* --- Food spawning ------------------------------------------------------ */
var seeded = 0;
function fixedRandom() {
  seeded = (seeded + 0.137) % 1;
  return seeded;
}

var foodSnake = new S.Snake();
var food = new S.FoodManager(fixedRandom);
var fruit = food.ensureFruit(foodSnake);
check('fruit spawns', Boolean(fruit));
check('fruit never spawns inside the snake', foodSnake.occupies(fruit.x, fruit.y, true) === false);

var spawnsInsideBody = false;
for (var i = 0; i < 300; i += 1) {
  var probe = new S.FoodManager(fixedRandom);
  var probeSnake = new S.Snake();
  probeSnake.segments = [];
  for (var x = 0; x < 20; x += 1) {
    probeSnake.segments.push({ x: x, y: 0 });
  }
  var cell = probe.ensureFruit(probeSnake);
  if (!cell || probeSnake.occupies(cell.x, cell.y, true)) {
    spawnsInsideBody = true;
    break;
  }
}
check('fruit avoids a crowded board', spawnsInsideBody === false);

/* --- Bonus lifetime ----------------------------------------------------- */
var bonusFood = new S.FoodManager(fixedRandom);
var bonusSnake = new S.Snake();
var difficulty = config.DIFFICULTY.classic;
var bonus = null;
var attempts = 0;
while (!bonus && attempts < 200) {
  bonus = bonusFood.trySpawnBonus(bonusSnake, difficulty, 500, 1000);
  attempts += 1;
}
check('bonus can spawn', Boolean(bonus));
if (bonus) {
  check('bonus has a lifetime', bonus.expiresAt === 1000 + difficulty.bonusLifetimeMs);
  check('bonus progress starts near 1', bonusFood.getBonusProgress(1000) > 0.99);
  check('bonus survives until expiry', bonusFood.update(1000 + difficulty.bonusLifetimeMs - 10) === false);
  check('bonus expires on time', bonusFood.update(1000 + difficulty.bonusLifetimeMs + 1) === true);
  check('expired bonus is gone', bonusFood.bonus === null);
}
check('no second bonus while one is live', (function () {
  var f = new S.FoodManager(function () { return 0; });
  var s = new S.Snake();
  var first = f.trySpawnBonus(s, difficulty, 500, 0);
  var second = f.trySpawnBonus(s, difficulty, 500, 0);
  return Boolean(first) && second === null;
}()));

/* --- Board full --------------------------------------------------------- */
var fullFood = new S.FoodManager(fixedRandom);
var fullSnake = new S.Snake();
fullSnake.segments = [];
for (var fy = 0; fy < config.GRID_SIZE; fy += 1) {
  for (var fx = 0; fx < config.GRID_SIZE; fx += 1) {
    fullSnake.segments.push({ x: fx, y: fy });
  }
}
check('full board yields no fruit', fullFood.ensureFruit(fullSnake) === null);

/* --- Particles ---------------------------------------------------------- */
var particles = new S.ParticleSystem(function () { return 0.5; });
particles.burst(3, 4, { count: 10 });
check('burst emits particles', particles.getParticles().length === 10);
particles.update(2000);
check('particles expire', particles.getParticles().length === 0);

/* --- Report ------------------------------------------------------------- */
console.log('passed: ' + passes);
if (failures.length > 0) {
  console.log('FAILED: ' + failures.length);
  failures.forEach(function (line) { console.log('  - ' + line); });
  process.exitCode = 1;
} else {
  console.log('all checks passed');
}
