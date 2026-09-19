/**
 * input.js - translates keyboard, touch swipe and on-screen pad presses
 * into semantic game intents. It knows nothing about the game itself.
 */
(function (root, doc) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  var KEY_TO_DIRECTION = {
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    w: 'UP',
    s: 'DOWN',
    a: 'LEFT',
    d: 'RIGHT',
    W: 'UP',
    S: 'DOWN',
    A: 'LEFT',
    D: 'RIGHT'
  };

  var SWIPE_MIN_DISTANCE = 22;
  var SWIPE_AXIS_BIAS = 1.15;

  var listeners = {
    direction: [],
    start: [],
    pause: [],
    restart: [],
    toggleSound: [],
    anyInput: []
  };

  var touchTracker = {
    active: false,
    startX: 0,
    startY: 0,
    consumed: false
  };

  var attachedTargets = [];

  function on(eventName, handler) {
    if (listeners[eventName]) {
      listeners[eventName].push(handler);
    }
    return function unsubscribe() {
      var bucket = listeners[eventName];
      if (!bucket) {
        return;
      }
      var index = bucket.indexOf(handler);
      if (index !== -1) {
        bucket.splice(index, 1);
      }
    };
  }

  function emit(eventName, payload) {
    var bucket = listeners[eventName];
    if (!bucket) {
      return;
    }
    for (var i = 0; i < bucket.length; i += 1) {
      bucket[i](payload);
    }
  }

  function emitAnyInput(source) {
    emit('anyInput', source);
  }

  function requestDirection(directionName, source) {
    emitAnyInput(source);
    emit('direction', directionName);
  }

  function handleKeyDown(event) {
    if (event.defaultPrevented) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    var direction = KEY_TO_DIRECTION[event.key];
    if (direction) {
      event.preventDefault();
      requestDirection(direction, 'keyboard');
      return;
    }

    var code = event.code;
    if (code === 'Space' || event.key === ' ') {
      event.preventDefault();
      emitAnyInput('keyboard');
      emit('pause');
      return;
    }

    var key = event.key ? event.key.toLowerCase() : '';
    if (key === 'p') {
      event.preventDefault();
      emitAnyInput('keyboard');
      emit('pause');
      return;
    }
    if (key === 'r') {
      event.preventDefault();
      emitAnyInput('keyboard');
      emit('restart');
      return;
    }
    if (key === 'enter') {
      event.preventDefault();
      emitAnyInput('keyboard');
      emit('start');
      return;
    }
    if (key === 'm') {
      emitAnyInput('keyboard');
      emit('toggleSound');
    }
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 1) {
      touchTracker.active = false;
      return;
    }
    var touch = event.touches[0];
    touchTracker.active = true;
    touchTracker.consumed = false;
    touchTracker.startX = touch.clientX;
    touchTracker.startY = touch.clientY;
  }

  function handleTouchMove(event) {
    if (!touchTracker.active || touchTracker.consumed || event.touches.length !== 1) {
      return;
    }
    var touch = event.touches[0];
    var deltaX = touch.clientX - touchTracker.startX;
    var deltaY = touch.clientY - touchTracker.startY;
    var absX = Math.abs(deltaX);
    var absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < SWIPE_MIN_DISTANCE) {
      return;
    }

    var direction;
    if (absX > absY * SWIPE_AXIS_BIAS) {
      direction = deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else if (absY > absX * SWIPE_AXIS_BIAS) {
      direction = deltaY > 0 ? 'DOWN' : 'UP';
    } else {
      direction = absX > absY ? (deltaX > 0 ? 'RIGHT' : 'LEFT') : (deltaY > 0 ? 'DOWN' : 'UP');
    }

    touchTracker.consumed = true;
    requestDirection(direction, 'touch');
  }

  function handleTouchEnd() {
    touchTracker.active = false;
    touchTracker.consumed = false;
  }

  function attachDpadButtons() {
    var buttons = doc.querySelectorAll('[data-dir]');
    for (var i = 0; i < buttons.length; i += 1) {
      (function bind(button) {
        var directionName = button.getAttribute('data-dir').toUpperCase();
        var pressHandler = function (event) {
          event.preventDefault();
          if (button.disabled) {
            return;
          }
          requestDirection(directionName, 'pad');
        };
        button.addEventListener('touchstart', pressHandler, { passive: false });
        button.addEventListener('mousedown', pressHandler);
        attachedTargets.push({
          element: button,
          type: 'touchstart',
          handler: pressHandler
        });
        attachedTargets.push({
          element: button,
          type: 'mousedown',
          handler: pressHandler
        });
      }(buttons[i]));
    }
  }

  var SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  function isScrollKey(key) {
    return SCROLL_KEYS.indexOf(key) !== -1;
  }

  function handleWindowKeyDown(event) {
    if (isScrollKey(event.key) && event.target === doc.body) {
      event.preventDefault();
    }
    handleKeyDown(event);
  }

  function attach() {
    doc.addEventListener('keydown', handleWindowKeyDown);
    attachedTargets.push({ element: doc, type: 'keydown', handler: handleWindowKeyDown });

    attachDpadButtons();

    if (config) {
      var board = doc.getElementById('screen');
      if (board) {
        board.addEventListener('touchstart', handleTouchStart, { passive: true });
        board.addEventListener('touchmove', handleTouchMove, { passive: true });
        board.addEventListener('touchend', handleTouchEnd, { passive: true });
        attachedTargets.push({ element: board, type: 'touchstart', handler: handleTouchStart });
        attachedTargets.push({ element: board, type: 'touchmove', handler: handleTouchMove });
        attachedTargets.push({ element: board, type: 'touchend', handler: handleTouchEnd });
      }
    }
  }

  function detach() {
    for (var i = 0; i < attachedTargets.length; i += 1) {
      var target = attachedTargets[i];
      target.element.removeEventListener(target.type, target.handler);
    }
    attachedTargets = [];
  }

  SnakeGame.input = {
    on: on,
    attach: attach,
    detach: detach
  };
})(window, document);
