/**
 * food.js - spawns and tracks the two collectables: the regular fruit and
 * the timed golden bonus. Picking a free cell is done with an occupancy
 * grid so the snake can never starve on a board that still has room.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  var FRUIT_TYPE = 'fruit';
  var BONUS_TYPE = 'bonus';
  var BONUS_MIN_SCORE = 40;

  function FoodManager(randomFn) {
    this.random = typeof randomFn === 'function' ? randomFn : Math.random;
    this.fruit = null;
    this.bonus = null;
    this.fruitTicks = 0;
    this.occupancy = new Uint8Array(config.GRID_SIZE * config.GRID_SIZE);
  }

  FoodManager.prototype.reset = function reset() {
    this.fruit = null;
    this.bonus = null;
    this.fruitTicks = 0;
  };

  FoodManager.prototype.toIndex = function toIndex(x, y) {
    return y * config.GRID_SIZE + x;
  };

  FoodManager.prototype.markOccupied = function markOccupied(snake) {
    this.occupancy.fill(0);
    for (var i = 0; i < snake.segments.length; i += 1) {
      var segment = snake.segments[i];
      this.occupancy[this.toIndex(segment.x, segment.y)] = 1;
    }
    if (this.fruit) {
      this.occupancy[this.toIndex(this.fruit.x, this.fruit.y)] = 1;
    }
    if (this.bonus) {
      this.occupancy[this.toIndex(this.bonus.x, this.bonus.y)] = 1;
    }
  };

  FoodManager.prototype.collectFreeCells = function collectFreeCells() {
    var freeCells = [];
    for (var y = 0; y < config.GRID_SIZE; y += 1) {
      for (var x = 0; x < config.GRID_SIZE; x += 1) {
        if (this.occupancy[this.toIndex(x, y)] === 0) {
          freeCells.push({ x: x, y: y });
        }
      }
    }
    return freeCells;
  };

  /**
   * Finds a random empty cell, or null when the board is completely full.
   */
  FoodManager.prototype.pickFreeCell = function pickFreeCell(snake) {
    this.markOccupied(snake);
    var freeCells = this.collectFreeCells();
    if (freeCells.length === 0) {
      return null;
    }
    var index = Math.floor(this.random() * freeCells.length);
    return freeCells[Math.min(index, freeCells.length - 1)];
  };

  FoodManager.prototype.ensureFruit = function ensureFruit(snake) {
    if (this.fruit) {
      return this.fruit;
    }
    var cell = this.pickFreeCell(snake);
    if (!cell) {
      return null;
    }
    this.fruit = { x: cell.x, y: cell.y, type: FRUIT_TYPE };
    return this.fruit;
  };

  /**
   * Rolls for a golden bonus. Only one may exist at a time.
   */
  FoodManager.prototype.trySpawnBonus = function trySpawnBonus(snake, difficulty, score, nowMs) {
    if (this.bonus || score < BONUS_MIN_SCORE) {
      return null;
    }
    if (this.random() > difficulty.bonusChance) {
      return null;
    }

    var cell = this.pickFreeCell(snake);
    if (!cell) {
      return null;
    }

    this.bonus = {
      x: cell.x,
      y: cell.y,
      type: BONUS_TYPE,
      spawnedAt: nowMs,
      expiresAt: nowMs + difficulty.bonusLifetimeMs,
      lifetimeMs: difficulty.bonusLifetimeMs
    };
    return this.bonus;
  };

  /**
   * Drops an expired bonus.
   * @returns {boolean} true when a bonus just expired.
   */
  FoodManager.prototype.update = function update(nowMs) {
    if (this.bonus && nowMs >= this.bonus.expiresAt) {
      this.bonus = null;
      return true;
    }
    return false;
  };

  FoodManager.prototype.getBonusProgress = function getBonusProgress(nowMs) {
    if (!this.bonus) {
      return 0;
    }
    var remaining = this.bonus.expiresAt - nowMs;
    if (remaining <= 0) {
      return 0;
    }
    return Math.min(1, remaining / this.bonus.lifetimeMs);
  };

  FoodManager.prototype.isFruitAt = function isFruitAt(x, y) {
    return Boolean(this.fruit) && this.fruit.x === x && this.fruit.y === y;
  };

  FoodManager.prototype.isBonusAt = function isBonusAt(x, y) {
    return Boolean(this.bonus) && this.bonus.x === x && this.bonus.y === y;
  };

  FoodManager.prototype.consumeFruit = function consumeFruit() {
    var eaten = this.fruit;
    this.fruit = null;
    return eaten;
  };

  FoodManager.prototype.consumeBonus = function consumeBonus() {
    var eaten = this.bonus;
    this.bonus = null;
    return eaten;
  };

  SnakeGame.FoodManager = FoodManager;
  SnakeGame.foodTypes = { FRUIT: FRUIT_TYPE, BONUS: BONUS_TYPE };
})(window);
