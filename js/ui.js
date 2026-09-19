/**
 * ui.js - all DOM wiring for the cabinet: HUD numbers, overlays, buttons
 * and the settings switches. The game never queries the DOM directly.
 */
(function (root, doc) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});

  var OVERLAY_IDS = {
    start: 'overlayStart',
    countdown: 'overlayCountdown',
    pause: 'overlayPause',
    gameOver: 'overlayGameOver'
  };

  function byId(id) {
    return doc.getElementById(id);
  }

  function createUI() {
    var elements = {
      score: byId('scoreValue'),
      best: byId('bestValue'),
      length: byId('lengthValue'),
      level: byId('levelValue'),
      bestLine: byId('bestLineValue'),
      countdown: byId('countdownValue'),
      pauseLabel: byId('pauseLabel'),
      soundLabel: byId('soundLabel'),
      soundButton: byId('btnSound'),
      pauseButton: byId('btnPause'),
      startButton: byId('btnStart'),
      resumeButton: byId('btnResume'),
      restartButton: byId('btnRestart'),
      resetBestButton: byId('btnResetBest'),
      difficultyGroup: byId('difficultyGroup'),
      wallsGroup: byId('wallsGroup'),
      gameOverTitle: byId('gameOverTitle'),
      gameOverCause: byId('gameOverCause'),
      finalScore: byId('finalScore'),
      finalBest: byId('finalBest'),
      finalLength: byId('finalLength'),
      recordBadge: byId('recordBadge'),
      screenHint: byId('screenHint')
    };

    var overlays = {
      start: byId(OVERLAY_IDS.start),
      countdown: byId(OVERLAY_IDS.countdown),
      pause: byId(OVERLAY_IDS.pause),
      gameOver: byId(OVERLAY_IDS.gameOver)
    };

    var handlers = {
      start: null,
      resume: null,
      restart: null,
      pause: null,
      sound: null,
      difficulty: null,
      walls: null,
      resetBest: null
    };

    function setOverlayVisibility(activeName) {
      Object.keys(overlays).forEach(function (name) {
        var element = overlays[name];
        if (!element) {
          return;
        }
        if (name === activeName) {
          element.hidden = false;
        } else {
          element.hidden = true;
        }
      });
    }

    function updateHud(values) {
      if (elements.score) {
        elements.score.textContent = String(values.score);
      }
      if (elements.best) {
        elements.best.textContent = String(values.best);
      }
      if (elements.length) {
        elements.length.textContent = String(values.length);
      }
      if (elements.level) {
        elements.level.textContent = String(values.level);
      }
    }

    function updateBestLine(best) {
      if (elements.bestLine) {
        elements.bestLine.textContent = String(best);
      }
    }

    function setCountdown(text) {
      if (elements.countdown) {
        elements.countdown.textContent = text;
        elements.countdown.classList.remove('is-ticking');
        /* Force a reflow so the pop animation restarts every count. */
        void elements.countdown.offsetWidth;
        elements.countdown.classList.add('is-ticking');
      }
    }

    function setPausedLabel(isPaused) {
      if (elements.pauseLabel) {
        elements.pauseLabel.textContent = isPaused ? 'resume' : 'pause';
      }
      if (elements.pauseButton) {
        elements.pauseButton.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      }
    }

    function setSoundState(isOn) {
      if (elements.soundLabel) {
        elements.soundLabel.textContent = isOn ? 'sound' : 'muted';
      }
      if (elements.soundButton) {
        elements.soundButton.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        elements.soundButton.classList.toggle('is-off', !isOn);
      }
    }

    function markActiveButton(group, attribute, value) {
      if (!group) {
        return;
      }
      var buttons = group.querySelectorAll('[' + attribute + ']');
      for (var i = 0; i < buttons.length; i += 1) {
        var button = buttons[i];
        var isActive = button.getAttribute(attribute) === value;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    }

    function setDifficultyActive(difficultyId) {
      markActiveButton(elements.difficultyGroup, 'data-difficulty', difficultyId);
    }

    function setWallsActive(wallMode) {
      markActiveButton(elements.wallsGroup, 'data-walls', wallMode);
    }

    function showGameOver(summary) {
      if (elements.gameOverTitle) {
        elements.gameOverTitle.textContent = summary.isRecord ? 'new record' : 'game over';
      }
      if (elements.gameOverCause) {
        elements.gameOverCause.textContent = summary.reason;
      }
      if (elements.finalScore) {
        elements.finalScore.textContent = String(summary.score);
      }
      if (elements.finalBest) {
        elements.finalBest.textContent = String(summary.best);
      }
      if (elements.finalLength) {
        elements.finalLength.textContent = String(summary.length);
      }
      if (elements.recordBadge) {
        elements.recordBadge.hidden = !summary.isRecord;
      }
      setOverlayVisibility('gameOver');
      if (elements.restartButton) {
        elements.restartButton.focus({ preventScroll: true });
      }
    }

    function bindClick(element, key) {
      if (!element) {
        return;
      }
      element.addEventListener('click', function (event) {
        event.preventDefault();
        var handler = handlers[key];
        if (typeof handler === 'function') {
          handler();
        }
      });
    }

    function bindOptionGroup(group, attribute, key) {
      if (!group) {
        return;
      }
      group.addEventListener('click', function (event) {
        var target = event.target.closest('[' + attribute + ']');
        if (!target || !group.contains(target)) {
          return;
        }
        event.preventDefault();
        var value = target.getAttribute(attribute);
        var handler = handlers[key];
        if (typeof handler === 'function') {
          handler(value);
        }
      });
    }

    bindClick(elements.startButton, 'start');
    bindClick(elements.resumeButton, 'resume');
    bindClick(elements.restartButton, 'restart');
    bindClick(elements.pauseButton, 'pause');
    bindClick(elements.soundButton, 'sound');
    bindClick(elements.resetBestButton, 'resetBest');
    bindOptionGroup(elements.difficultyGroup, 'data-difficulty', 'difficulty');
    bindOptionGroup(elements.wallsGroup, 'data-walls', 'walls');

    return {
      elements: elements,
      on: function on(key, handler) {
        if (Object.prototype.hasOwnProperty.call(handlers, key)) {
          handlers[key] = handler;
        }
      },
      showOverlay: setOverlayVisibility,
      updateHud: updateHud,
      updateBestLine: updateBestLine,
      setCountdown: setCountdown,
      setPausedLabel: setPausedLabel,
      setSoundState: setSoundState,
      setDifficultyActive: setDifficultyActive,
      setWallsActive: setWallsActive,
      showGameOver: showGameOver,
      hideGameOver: function hideGameOver() {
        if (elements.recordBadge) {
          elements.recordBadge.hidden = true;
        }
      }
    };
  }

  SnakeGame.createUI = createUI;
})(window, document);
