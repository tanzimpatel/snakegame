/**
 * storage.js - resilient localStorage wrapper.
 * Browsers throw on localStorage access in private mode / sandboxed frames,
 * so every read and write is guarded and falls back to in-memory state.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;
  var memoryFallback = {};

  function isAvailable() {
    try {
      var probeKey = '__crtSnakeProbe__';
      root.localStorage.setItem(probeKey, '1');
      root.localStorage.removeItem(probeKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  var available = isAvailable();

  function readRaw(key) {
    if (!available) {
      return Object.prototype.hasOwnProperty.call(memoryFallback, key)
        ? memoryFallback[key]
        : null;
    }
    try {
      return root.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeRaw(key, value) {
    memoryFallback[key] = value;
    if (!available) {
      return;
    }
    try {
      root.localStorage.setItem(key, value);
    } catch (error) {
      /* Quota exceeded or blocked - the in-memory copy still works. */
    }
  }

  function readNumber(key, fallbackValue) {
    var raw = readRaw(key);
    if (raw === null) {
      return fallbackValue;
    }
    var parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
  }

  function readJson(key, fallbackValue) {
    var raw = readRaw(key);
    if (raw === null) {
      return fallbackValue;
    }
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function bestKeyFor(difficulty) {
    return config.STORAGE_KEYS.bestScore + '.' + difficulty;
  }

  function getBestScore(difficulty) {
    if (!difficulty) {
      return readNumber(config.STORAGE_KEYS.bestScore, 0);
    }
    var perDifficulty = readJson(config.STORAGE_KEYS.bestScoreByDifficulty, {});
    var value = perDifficulty[difficulty];
    return typeof value === 'number' && value >= 0 ? value : 0;
  }

  /**
   * Stores a score when it beats the record and reports whether it did.
   * @returns {{saved: boolean, best: number, previousBest: number}}
   */
  function submitScore(difficulty, score) {
    var previousBest = getBestScore(difficulty);
    if (score <= previousBest) {
      return { saved: false, best: previousBest, previousBest: previousBest };
    }

    var perDifficulty = readJson(config.STORAGE_KEYS.bestScoreByDifficulty, {});
    perDifficulty[difficulty] = score;
    writeRaw(config.STORAGE_KEYS.bestScoreByDifficulty, JSON.stringify(perDifficulty));
    writeRaw(bestKeyFor(difficulty), String(score));

    var overall = readNumber(config.STORAGE_KEYS.bestScore, 0);
    if (score > overall) {
      writeRaw(config.STORAGE_KEYS.bestScore, String(score));
    }

    return { saved: true, best: score, previousBest: previousBest };
  }

  function resetBestScores() {
    writeRaw(config.STORAGE_KEYS.bestScore, '0');
    writeRaw(config.STORAGE_KEYS.bestScoreByDifficulty, JSON.stringify({}));
    if (available) {
      try {
        root.localStorage.removeItem(config.STORAGE_KEYS.bestScore);
        root.localStorage.removeItem(config.STORAGE_KEYS.bestScoreByDifficulty);
      } catch (error) {
        /* Nothing more we can do - memory fallback already reset. */
      }
    }
  }

  function getSettings() {
    var stored = readJson(config.STORAGE_KEYS.settings, {});
    var defaults = config.DEFAULT_SETTINGS;
    var difficulty = config.DIFFICULTY[stored.difficulty] ? stored.difficulty : defaults.difficulty;
    var walls = stored.walls === config.WALL_MODE.WRAP || stored.walls === config.WALL_MODE.SOLID
      ? stored.walls
      : defaults.walls;
    var sound = typeof stored.sound === 'boolean' ? stored.sound : defaults.sound;
    return { difficulty: difficulty, walls: walls, sound: sound };
  }

  function saveSettings(settings) {
    writeRaw(config.STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  SnakeGame.storage = {
    isAvailable: function () { return available; },
    getBestScore: getBestScore,
    submitScore: submitScore,
    resetBestScores: resetBestScores,
    getSettings: getSettings,
    saveSettings: saveSettings
  };
})(window);
