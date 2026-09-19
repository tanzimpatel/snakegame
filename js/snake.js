/**
 * snake.js - the snake entity: segments, heading and movement rules.
 * Pure data and geometry; it never touches the DOM or the canvas.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  var MAX_QUEUED_TURNS = 2;

  function createSegment(x, y) {
    return { x: x, y: y };
  }

  function Snake() {
    this.segments = [];
    this.direction = 'RIGHT';
    this.turnQueue = [];
    this.growing = 0;
    this.reset();
  }

  Snake.prototype.reset = function reset() {
    var gridSize = config.GRID_SIZE;
    var startLength = config.START_LENGTH;
    var startY = Math.floor(gridSize / 2);
    var headX = Math.floor(gridSize / 2) + Math.floor(startLength / 2) - 1;

    this.segments = [];
    for (var i = 0; i < startLength; i += 1) {
      this.segments.push(createSegment(headX - i, startY));
    }

    this.direction = 'RIGHT';
    this.turnQueue = [];
    this.growing = 0;
  };

  Snake.prototype.getHead = function getHead() {
    return this.segments[0];
  };

  Snake.prototype.getLength = function getLength() {
    return this.segments.length + this.growing;
  };

  Snake.prototype.queueTurn = function queueTurn(directionName) {
    if (!config.DIRECTION[directionName]) {
      return false;
    }

    var reference = this.turnQueue.length > 0
      ? this.turnQueue[this.turnQueue.length - 1]
      : this.direction;

    if (directionName === reference) {
      return false;
    }
    if (isOpposite(directionName, reference)) {
      return false;
    }
    if (this.turnQueue.length >= MAX_QUEUED_TURNS) {
      return false;
    }

    this.turnQueue.push(directionName);
    return true;
  };

  Snake.prototype.applyQueuedTurn = function applyQueuedTurn() {
    if (this.turnQueue.length === 0) {
      return false;
    }
    this.direction = this.turnQueue.shift();
    return true;
  };

  Snake.prototype.grow = function grow(cells) {
    this.growing += (cells || 1);
  };

  /**
   * Works out where the head lands next, honouring the wall mode.
   */
  Snake.prototype.getNextHeadPosition = function getNextHeadPosition(wallMode) {
    var vector = config.DIRECTION[this.direction];
    var head = this.getHead();
    var gridSize = config.GRID_SIZE;
    var nextX = head.x + vector.x;
    var nextY = head.y + vector.y;

    if (wallMode === config.WALL_MODE.WRAP) {
      nextX = (nextX + gridSize) % gridSize;
      nextY = (nextY + gridSize) % gridSize;
      return { x: nextX, y: nextY, wrapped: true };
    }

    if (nextX < 0 || nextY < 0 || nextX >= gridSize || nextY >= gridSize) {
      return { x: nextX, y: nextY, outOfBounds: true };
    }

    return { x: nextX, y: nextY };
  };

  /**
   * Self-collision test for a candidate head cell.
   * The final segment is ignored when the tail is about to move away.
   */
  Snake.prototype.occupies = function occupies(x, y, includeTail) {
    var lastIndex = includeTail ? this.segments.length : this.segments.length - 1;
    for (var i = 0; i < lastIndex; i += 1) {
      if (this.segments[i].x === x && this.segments[i].y === y) {
        return true;
      }
    }
    return false;
  };

  /**
   * Tests whether the given cell would collide with the snake's own body.
   */
  Snake.prototype.willCollideWithSelf = function willCollideWithSelf(x, y) {
    var includeTail = this.growing > 0;
    return this.occupies(x, y, includeTail);
  };

  /**
   * Advances the snake one grid step.
   * @returns {{moved: boolean, grew: boolean}}
   */
  Snake.prototype.step = function step(wallMode) {
    var next = this.getNextHeadPosition(wallMode);

    if (next.outOfBounds) {
      return { moved: false, outOfBounds: true };
    }
    if (this.willCollideWithSelf(next.x, next.y)) {
      return { moved: false, selfCollision: true };
    }

    this.segments.unshift(createSegment(next.x, next.y));

    var grew = false;
    if (this.growing > 0) {
      this.growing -= 1;
      grew = true;
    } else {
      this.segments.pop();
    }

    return { moved: true, grew: grew };
  };

  function isOpposite(a, b) {
    var vectorA = config.DIRECTION[a];
    var vectorB = config.DIRECTION[b];
    return vectorA.x === -vectorB.x && vectorA.y === -vectorB.y;
  }

  SnakeGame.Snake = Snake;
  SnakeGame.isOppositeDirection = isOpposite;
})(window);
