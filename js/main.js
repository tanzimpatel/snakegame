/**
 * main.js - wires the modules together and boots the cabinet.
 * This is the only file that touches both the DOM and the game.
 */
(function (root, doc) {
  'use strict';

  var SnakeGame = root.SnakeGame;

  function wireInput(game) {
    var input = SnakeGame.input;
    var gameStates = SnakeGame.config.GAME_STATE;

    input.on('anyInput', function () {
      SnakeGame.audio.unlock();
    });

    input.on('direction', function (directionName) {
      game.handleDirection(directionName);
    });

    input.on('pause', function () {
      game.togglePause();
    });

    input.on('restart', function () {
      game.beginRound();
    });

    input.on('start', function () {
      if (game.state === gameStates.READY || game.state === gameStates.GAME_OVER) {
        game.beginRound();
      }
    });

    input.on('toggleSound', function () {
      game.toggleSound();
    });

    input.attach();
  }

  function wireWindow(game, renderer) {
    var gameStates = SnakeGame.config.GAME_STATE;

    root.addEventListener('resize', function () {
      renderer.setup();
    });

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) {
        if (game.state === gameStates.PLAYING) {
          game.pause();
        }
        return;
      }
      game.lastFrameMs = 0;
    });

    root.addEventListener('blur', function () {
      if (game.state === gameStates.PLAYING) {
        game.pause();
      }
    });
  }

  function bootstrap() {
    var canvas = doc.getElementById('gameCanvas');
    if (!canvas || !SnakeGame.createUI) {
      return;
    }

    var ui = SnakeGame.createUI();
    var renderer = new SnakeGame.Renderer(canvas);
    var game = new SnakeGame.Game({
      renderer: renderer,
      ui: ui,
      settings: SnakeGame.storage.getSettings()
    });

    game.attachUI();
    SnakeGame.audio.setMuted(!game.settings.sound);
    game.syncUI();
    wireInput(game);
    wireWindow(game, renderer);
    game.start();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window, document);
