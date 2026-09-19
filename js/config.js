/**
 * config.js - static tuning values for CRT Snake.
 * Everything that a designer might want to tweak lives here.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});

  var GRID_SIZE = 24;
  var CELL_SIZE = 24;
  var BOARD_SIZE = GRID_SIZE * CELL_SIZE;

  var DIRECTION = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
  };

  var DIRECTION_NAMES = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  var GAME_STATE = {
    READY: 'ready',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover'
  };

  var WALL_MODE = {
    SOLID: 'solid',
    WRAP: 'wrap'
  };

  var DIFFICULTY = {
    chill: {
      id: 'chill',
      label: 'chill',
      startStepMs: 180,
      minStepMs: 105,
      stepDecreaseMs: 3,
      bonusChance: 0.3,
      bonusLifetimeMs: 9000,
      scoreMultiplier: 1
    },
    classic: {
      id: 'classic',
      label: 'classic',
      startStepMs: 145,
      minStepMs: 65,
      stepDecreaseMs: 4.5,
      bonusChance: 0.24,
      bonusLifetimeMs: 7000,
      scoreMultiplier: 1.5
    },
    insane: {
      id: 'insane',
      label: 'insane',
      startStepMs: 110,
      minStepMs: 42,
      stepDecreaseMs: 6,
      bonusChance: 0.2,
      bonusLifetimeMs: 5500,
      scoreMultiplier: 2
    }
  };

  var SCORING = {
    fruit: 10,
    bonusFruit: 50,
    pointsPerLevel: 60
  };

  var START_LENGTH = 4;
  var MAX_LENGTH = GRID_SIZE * GRID_SIZE;

  var COUNTDOWN_STEP_MS = 620;
  var COUNTDOWN_VALUES = ['3', '2', '1', 'GO'];

  var STORAGE_KEYS = {
    bestScore: 'crtSnake.bestScore',
    bestScoreByDifficulty: 'crtSnake.bestByDifficulty',
    settings: 'crtSnake.settings'
  };

  var DEFAULT_SETTINGS = {
    difficulty: 'classic',
    walls: WALL_MODE.SOLID,
    sound: true
  };

  var COLORS = {
    boardBackground: '#080c07',
    boardGrid: 'rgba(125, 255, 107, 0.055)',
    boardFrame: 'rgba(125, 255, 107, 0.16)',
    snakeBody: '#5ce85a',
    snakeBodyAlt: '#3fbf46',
    snakeHead: '#c8ffb0',
    snakeEye: '#08130a',
    snakeOutline: 'rgba(6, 20, 10, 0.92)',
    snakeHighlight: 'rgba(220, 255, 200, 0.2)',
    snakeDeadBody: '#b8503c',
    snakeDeadHead: '#eda08f',
    fruit: '#ff5a36',
    fruitGlow: 'rgba(255, 90, 54, 0.35)',
    fruitLeaf: '#7dff6b',
    bonus: '#ffcf3f',
    bonusGlow: 'rgba(255, 207, 63, 0.4)',
    bonusTicks: '#ff5a36',
    text: '#9dff8a'
  };

  var PARTICLES = {
    fruitCount: 14,
    bonusCount: 22,
    deathCount: 40,
    minSpeed: 0.9,
    maxSpeed: 3.4,
    minLifeMs: 320,
    maxLifeMs: 720,
    gravity: 0.004,
    size: 3
  };

  var SHAKE = {
    fruitMs: 90,
    bonusMs: 150,
    deathMs: 420,
    deathMagnitude: 9
  };

  SnakeGame.config = {
    GRID_SIZE: GRID_SIZE,
    CELL_SIZE: CELL_SIZE,
    BOARD_SIZE: BOARD_SIZE,
    DIRECTION: DIRECTION,
    DIRECTION_NAMES: DIRECTION_NAMES,
    GAME_STATE: GAME_STATE,
    WALL_MODE: WALL_MODE,
    DIFFICULTY: DIFFICULTY,
    SCORING: SCORING,
    START_LENGTH: START_LENGTH,
    MAX_LENGTH: MAX_LENGTH,
    COUNTDOWN_STEP_MS: COUNTDOWN_STEP_MS,
    COUNTDOWN_VALUES: COUNTDOWN_VALUES,
    STORAGE_KEYS: STORAGE_KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    COLORS: COLORS,
    PARTICLES: PARTICLES,
    SHAKE: SHAKE
  };
})(window);
