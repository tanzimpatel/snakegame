/**
 * game.js - the state machine and fixed-step simulation loop.
 * It owns the snake, food, particles, scoring and the requestAnimationFrame
 * loop, and pushes everything it wants to show through the UI and renderer.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  var MAX_FRAME_MS = 100;
  var LEVEL_STEP_SCORE = config.SCORING.pointsPerLevel;
  var GAME_OVER_REVEAL_MS = 520;
  var BONUS_GROWTH = 2;
  var FRUIT_GROWTH = 1;

  function Game(options) {
    var settings = options.settings || SnakeGame.storage.getSettings();

    this.renderer = options.renderer;
    this.ui = options.ui;
    this.audio = options.audio || SnakeGame.audio;
    this.storage = options.storage || SnakeGame.storage;
    this.random = options.random || Math.random;

    this.snake = new SnakeGame.Snake();
    this.food = new SnakeGame.FoodManager(this.random);
    this.particles = new SnakeGame.ParticleSystem(this.random);

    this.settings = settings;
    this.difficulty = config.DIFFICULTY[settings.difficulty];
    this.wallMode = settings.walls;

    this.state = config.GAME_STATE.READY;
    this.score = 0;
    this.level = 1;
    this.stepMs = this.difficulty.startStepMs;
    this.stepTimer = 0;
    this.interpolation = 0;
    this.previousSegments = null;

    this.countdownIndex = 0;
    this.countdownTimer = 0;
    this.gameOverRevealMs = 0;
    this.deathReason = '';
    this.deathFlash = 0;
    this.elapsedMs = 0;
    this.lastFrameMs = 0;
    this.frameHandle = null;
    this.shake = { x: 0, y: 0, magnitude: 0, remainingMs: 0, durationMs: 0 };
    this.lastSummary = null;

    /* Start from a valid board so the instance is playable immediately. */
    this.prepareBoard();
  }

  Game.prototype.getBestScore = function getBestScore() {
    return this.storage.getBestScore(this.difficulty.id);
  };

  Game.prototype.attachUI = function attachUI() {
    var self = this;
    var ui = this.ui;

    ui.on('start', function () { self.beginRound(); });
    ui.on('resume', function () { self.resume(); });
    ui.on('restart', function () { self.beginRound(); });
    ui.on('pause', function () { self.togglePause(); });
    ui.on('sound', function () { self.toggleSound(); });
    ui.on('resetBest', function () { self.resetBestScore(); });
    ui.on('difficulty', function (id) { self.setDifficulty(id); });
    ui.on('walls', function (mode) { self.setWallMode(mode); });
  };

  Game.prototype.persistSettings = function persistSettings() {
    this.storage.saveSettings({
      difficulty: this.difficulty.id,
      walls: this.wallMode,
      sound: !this.audio.isMuted()
    });
  };

  Game.prototype.syncUI = function syncUI() {
    this.ui.setDifficultyActive(this.difficulty.id);
    this.ui.setWallsActive(this.wallMode);
    this.ui.setSoundState(!this.audio.isMuted());
    this.ui.updateBestLine(this.getBestScore());
    this.ui.updateHud({
      score: this.score,
      best: this.getBestScore(),
      length: this.snake.getLength(),
      level: this.level
    });
  };

  Game.prototype.setDifficulty = function setDifficulty(difficultyId) {
    if (!config.DIFFICULTY[difficultyId] || difficultyId === this.difficulty.id) {
      return;
    }
    this.difficulty = config.DIFFICULTY[difficultyId];
    this.persistSettings();
    this.syncUI();
    if (this.state === config.GAME_STATE.READY || this.state === config.GAME_STATE.GAME_OVER) {
      this.prepareBoard();
    }
  };

  Game.prototype.setWallMode = function setWallMode(wallMode) {
    if (wallMode !== config.WALL_MODE.SOLID && wallMode !== config.WALL_MODE.WRAP) {
      return;
    }
    this.wallMode = wallMode;
    this.persistSettings();
    this.ui.setWallsActive(wallMode);
  };

  Game.prototype.toggleSound = function toggleSound() {
    var nextMuted = !this.audio.isMuted();
    this.audio.setMuted(nextMuted);
    this.ui.setSoundState(!nextMuted);
    this.persistSettings();
    if (!nextMuted) {
      this.audio.unlock();
      this.audio.play('turn');
    }
  };

  Game.prototype.resetBestScore = function resetBestScore() {
    this.storage.resetBestScores();
    this.syncUI();
  };

  /**
   * Puts the board back to its starting layout without starting the clock.
   */
  Game.prototype.prepareBoard = function prepareBoard() {
    this.snake.reset();
    this.food.reset();
    this.food.ensureFruit(this.snake);
    this.particles.clear();
    this.score = 0;
    this.level = 1;
    this.stepMs = this.difficulty.startStepMs;
    this.stepTimer = 0;
    this.interpolation = 0;
    this.elapsedMs = 0;
    this.deathFlash = 0;
    this.previousSegments = null;
    this.resetShake();
    this.syncUI();
  };
Game.prototype.resetShake = function resetShake() {
    this.shake.x = 0;
    this.shake.y = 0;
    this.shake.magnitude = 0;
    this.shake.remainingMs = 0;
    this.shake.durationMs = 0;
  };

  Game.prototype.triggerShake = function triggerShake(magnitude, durationMs) {
    this.shake.magnitude = magnitude;
    this.shake.remainingMs = durationMs;
    this.shake.durationMs = durationMs;
  };

  Game.prototype.beginRound = function beginRound() {
    this.audio.unlock();
    this.prepareBoard();
    this.state = config.GAME_STATE.COUNTDOWN;
    this.countdownIndex = 0;
    this.countdownTimer = 0;
    this.ui.hideGameOver();
    this.ui.setPausedLabel(false);
    this.ui.setCountdown(config.COUNTDOWN_VALUES[0]);
    this.ui.showOverlay('countdown');
    this.audio.play('countdown');
  };

  Game.prototype.togglePause = function togglePause() {
    if (this.state === config.GAME_STATE.PLAYING) {
      this.pause();
    } else if (this.state === config.GAME_STATE.PAUSED) {
      this.resume();
    }
  };

  Game.prototype.pause = function pause() {
    if (this.state !== config.GAME_STATE.PLAYING) {
      return;
    }
    this.state = config.GAME_STATE.PAUSED;
    this.ui.setPausedLabel(true);
    this.ui.showOverlay('pause');
    this.audio.play('pause');
  };

  Game.prototype.resume = function resume() {
    if (this.state !== config.GAME_STATE.PAUSED) {
      return;
    }
    this.state = config.GAME_STATE.PLAYING;
    this.ui.setPausedLabel(false);
    this.ui.showOverlay(null);
    this.lastFrameMs = 0;
  };

  Game.prototype.handleDirection = function handleDirection(directionName) {
    if (this.state === config.GAME_STATE.READY) {
      this.beginRound();
      return;
    }
    if (this.state !== config.GAME_STATE.PLAYING) {
      return;
    }
    var accepted = this.snake.queueTurn(directionName);
    if (accepted) {
      this.audio.play('turn');
    }
  };

  Game.prototype.start = function start() {
    if (this.frameHandle === null) {
      this.prepareBoard();
      this.ui.showOverlay('start');
      this.lastFrameMs = 0;
      this.frameHandle = root.requestAnimationFrame(this.frame.bind(this));
    }
  };

  Game.prototype.stop = function stop() {
    if (this.frameHandle !== null) {
      root.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  };

  Game.prototype.frame = function frame(timestamp) {
    this.frameHandle = root.requestAnimationFrame(this.frame.bind(this));

    if (!this.lastFrameMs) {
      this.lastFrameMs = timestamp;
    }
    var deltaMs = Math.min(MAX_FRAME_MS, timestamp - this.lastFrameMs);
    this.lastFrameMs = timestamp;

    this.update(deltaMs);
    this.draw(timestamp);
  };

  Game.prototype.update = function update(deltaMs) {
    /* Guard against huge gaps (hidden tabs, breakpoints, slow frames). */
    var step = Math.min(MAX_FRAME_MS, Math.max(0, deltaMs));
    this.updateShake(step);

    if (this.state === config.GAME_STATE.COUNTDOWN) {
      this.updateCountdown(step);
    }

    if (this.state === config.GAME_STATE.PLAYING) {
      this.elapsedMs += step;
      this.food.update(this.elapsedMs);
      this.stepTimer += step;
      while (this.stepTimer >= this.stepMs && this.state === config.GAME_STATE.PLAYING) {
        this.stepTimer -= this.stepMs;
        this.advance();
      }
      this.interpolation = this.state === config.GAME_STATE.PLAYING
        ? Math.min(1, this.stepTimer / this.stepMs)
        : 1;
    }

    if (this.state === config.GAME_STATE.GAME_OVER && this.gameOverRevealMs > 0) {
      this.gameOverRevealMs -= step;
      if (this.gameOverRevealMs <= 0 && this.lastSummary) {
        this.ui.showGameOver(this.lastSummary);
      }
    }

    if (this.deathFlash > 0) {
      this.deathFlash = Math.max(0, this.deathFlash - step / config.SHAKE.deathMs);
    }

    this.particles.update(step);
  };

  Game.prototype.updateShake = function updateShake(deltaMs) {
    if (this.shake.remainingMs <= 0) {
      this.shake.x = 0;
      this.shake.y = 0;
      return;
    }
    this.shake.remainingMs = Math.max(0, this.shake.remainingMs - deltaMs);
    var strength = this.shake.magnitude * (this.shake.remainingMs / this.shake.durationMs);
    this.shake.x = (this.random() * 2 - 1) * strength;
    this.shake.y = (this.random() * 2 - 1) * strength;
  };

  Game.prototype.updateCountdown = function updateCountdown(deltaMs) {
    this.countdownTimer += deltaMs;
    var index = Math.floor(this.countdownTimer / config.COUNTDOWN_STEP_MS);

    if (index >= config.COUNTDOWN_VALUES.length) {
      this.state = config.GAME_STATE.PLAYING;
      this.stepTimer = 0;
      this.interpolation = 0;
      this.lastFrameMs = 0;
      this.ui.showOverlay(null);
      this.audio.play('start');
      return;
    }

    if (index !== this.countdownIndex) {
      this.countdownIndex = index;
      this.ui.setCountdown(config.COUNTDOWN_VALUES[index]);
      this.audio.play('countdown');
    }
  };

  Game.prototype.advance = function advance() {
    this.previousSegments = this.snake.segments.map(function copy(segment) {
      return { x: segment.x, y: segment.y };
    });

    this.snake.applyQueuedTurn();
    var result = this.snake.step(this.wallMode);

    if (result.outOfBounds) {
      this.endRound('you hit the wall');
      return;
    }
    if (result.selfCollision) {
      this.endRound('you bit your own tail');
      return;
    }

    this.checkConsumption();
  };

  Game.prototype.checkConsumption = function checkConsumption() {
    var head = this.snake.getHead();
    var ateFruit = this.food.isFruitAt(head.x, head.y);
    var ateBonus = !ateFruit && this.food.isBonusAt(head.x, head.y);

    if (ateFruit) {
      this.snake.grow(FRUIT_GROWTH);
      this.food.consumeFruit();
      this.awardPoints(config.SCORING.fruit);
      this.particles.burst(head.x, head.y, {
        count: config.PARTICLES.fruitCount,
        colors: [config.COLORS.fruit, config.COLORS.fruitLeaf, '#ffd7c9']
      });
      this.triggerShake(4, config.SHAKE.fruitMs);
      this.audio.play('eat');
      this.food.ensureFruit(this.snake);
      this.food.trySpawnBonus(this.snake, this.difficulty, this.score, this.elapsedMs);
    } else if (ateBonus) {
      this.snake.grow(BONUS_GROWTH);
      this.food.consumeBonus();
      this.awardPoints(config.SCORING.bonusFruit);
      this.particles.burst(head.x, head.y, {
        count: config.PARTICLES.bonusCount,
        colors: [config.COLORS.bonus, config.COLORS.fruit, '#fff4c2'],
        speedScale: 1.25
      });
      this.triggerShake(6, config.SHAKE.bonusMs);
      this.audio.play('bonus');
      this.food.ensureFruit(this.snake);
    } else {
      return;
    }

    this.refreshLevel();
    this.syncUI();

    if (this.snake.getLength() >= config.MAX_LENGTH) {
      this.endRound('you filled every cell!');
    }
  };

  Game.prototype.awardPoints = function awardPoints(basePoints) {
    var awarded = Math.round(basePoints * this.difficulty.scoreMultiplier);
    this.score += awarded;
  };

  Game.prototype.refreshLevel = function refreshLevel() {
    var nextLevel = 1 + Math.floor(this.score / LEVEL_STEP_SCORE);
    if (nextLevel === this.level) {
      return;
    }
    this.level = nextLevel;
    this.stepMs = Math.max(
      this.difficulty.minStepMs,
      this.difficulty.startStepMs - (this.level - 1) * this.difficulty.stepDecreaseMs
    );
  };

  Game.prototype.endRound = function endRound(reason) {
    if (this.state === config.GAME_STATE.GAME_OVER) {
      return;
    }

    this.state = config.GAME_STATE.GAME_OVER;
    this.deathReason = reason;
    this.interpolation = 1;
    this.gameOverRevealMs = GAME_OVER_REVEAL_MS;
    this.deathFlash = 1;
    this.triggerShake(config.SHAKE.deathMagnitude, config.SHAKE.deathMs);

    var head = this.snake.getHead();
    this.particles.burst(head.x, head.y, {
      count: config.PARTICLES.deathCount,
      colors: [config.COLORS.snakeBody, config.COLORS.snakeHead, config.COLORS.fruit],
      speedScale: 1.4
    });

    var outcome = this.storage.submitScore(this.difficulty.id, this.score);
    this.audio.playDeathSequence();

    if (outcome.saved && this.score > 0) {
      this.audio.playRecordFanfare();
    }

    this.lastSummary = {
      score: this.score,
      best: outcome.best,
      length: this.snake.getLength(),
      reason: reason,
      isRecord: outcome.saved && this.score > 0
    };

    this.ui.setPausedLabel(false);
    this.syncUI();
  };
Game.prototype.draw = function draw(timestamp) {
    this.renderer.render({
      snake: this.snake,
      previousSegments: this.previousSegments,
      interpolation: this.interpolation,
      food: this.food,
      particles: this.particles.getParticles(),
      nowMs: timestamp,
      shake: this.shake,
      deathFlash: this.deathFlash,
      dead: this.state === config.GAME_STATE.GAME_OVER
    });
  };

  SnakeGame.Game = Game;
})(window);
