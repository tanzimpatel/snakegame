/**
 * renderer.js - draws the whole board onto a 2D canvas.
 * The renderer keeps no game state of its own: it receives a snapshot and
 * paints it, interpolating the snake between grid steps for smooth motion.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  var SNAKE_THICKNESS = 0.78;
  var SNAKE_OUTLINE_THICKNESS = 0.96;
  var HEAD_SCALE = 1.04;
  var FRUIT_RADIUS = 0.32;
  var BONUS_RADIUS = 0.3;
  var BONUS_RING_RADIUS = 0.44;
  var MAX_DEVICE_PIXEL_RATIO = 2;

  function Renderer(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.pixelRatio = 1;
    this.setup();
  }

  /**
   * Sizes the backing store for the current device pixel ratio so the
   * board stays crisp on retina screens.
   */
  Renderer.prototype.setup = function setup() {
    var ratio = Math.min(root.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    this.pixelRatio = ratio;
    this.canvas.width = config.BOARD_SIZE * ratio;
    this.canvas.height = config.BOARD_SIZE * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.imageSmoothingEnabled = false;
  };

  Renderer.prototype.clear = function clear() {
    var ctx = this.context;
    ctx.fillStyle = config.COLORS.boardBackground;
    ctx.fillRect(0, 0, config.BOARD_SIZE, config.BOARD_SIZE);
  };

  Renderer.prototype.drawGrid = function drawGrid() {
    var ctx = this.context;
    var size = config.BOARD_SIZE;
    var cell = config.CELL_SIZE;

    ctx.strokeStyle = config.COLORS.boardGrid;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (var i = 1; i < config.GRID_SIZE; i += 1) {
      var offset = Math.round(i * cell) + 0.5;
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, size);
      ctx.moveTo(0, offset);
      ctx.lineTo(size, offset);
    }
    ctx.stroke();
  };

  Renderer.prototype.drawFrame = function drawFrame() {
    var ctx = this.context;
    var size = config.BOARD_SIZE;
    ctx.strokeStyle = config.COLORS.boardFrame;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  };

  function cellCenter(cellX, cellY) {
    return {
      x: (cellX + 0.5) * config.CELL_SIZE,
      y: (cellY + 0.5) * config.CELL_SIZE
    };
  }

  Renderer.prototype.drawFruit = function drawFruit(food, nowMs) {
    if (!food || !food.fruit) {
      return;
    }
    var ctx = this.context;
    var center = cellCenter(food.fruit.x, food.fruit.y);
    var pulse = 1 + Math.sin(nowMs / 220) * 0.06;
    var radius = config.CELL_SIZE * FRUIT_RADIUS * pulse;

    ctx.save();
    ctx.shadowColor = config.COLORS.fruitGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = config.COLORS.fruit;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = config.COLORS.fruitLeaf;
    ctx.fillRect(Math.round(center.x - 1.5), Math.round(center.y - radius - 4), 3, 5);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(
      center.x - radius * 0.32,
      center.y - radius * 0.34,
      Math.max(1.4, radius * 0.22),
      0,
      Math.PI * 2
    );
    ctx.fill();
  };

  Renderer.prototype.drawBonus = function drawBonus(food, nowMs) {
    if (!food || !food.bonus) {
      return;
    }
    var ctx = this.context;
    var center = cellCenter(food.bonus.x, food.bonus.y);
    var progress = food.getBonusProgress(nowMs);
    var pulse = 1 + Math.sin(nowMs / 130) * 0.09;
    var radius = config.CELL_SIZE * BONUS_RADIUS * pulse;
    var isUrgent = progress < 0.3;
    var flicker = isUrgent && Math.floor(nowMs / 140) % 2 === 0;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(nowMs / 480);
    ctx.shadowColor = config.COLORS.bonusGlow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = flicker ? config.COLORS.bonusTicks : config.COLORS.bonus;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius, 0);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = isUrgent ? config.COLORS.bonusTicks : config.COLORS.bonus;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(
      center.x,
      center.y,
      config.CELL_SIZE * BONUS_RING_RADIUS,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progress
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
/**
   * Blends the previous and current grid positions so movement looks fluid.
   * A jump larger than one cell means the snake wrapped - those joints snap.
   */
  function interpolateBody(snake, previousSegments, interpolation) {
    var points = [];
    var segments = snake.segments;
    var t = Math.max(0, Math.min(1, interpolation));

    for (var i = 0; i < segments.length; i += 1) {
      var current = segments[i];
      var previous = previousSegments && previousSegments[i] ? previousSegments[i] : current;
      var deltaX = current.x - previous.x;
      var deltaY = current.y - previous.y;
      var wrapped = Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;

      if (wrapped || t === 0) {
        points.push({ x: current.x, y: current.y, snapped: wrapped });
      } else {
        points.push({
          x: previous.x + deltaX * t,
          y: previous.y + deltaY * t,
          snapped: false
        });
      }
    }
    return points;
  }

  /**
   * Splits the body into continuous runs so wrapped snakes are not drawn
   * as one line stretching across the whole board.
   */
  function splitIntoRuns(points) {
    var runs = [];
    var currentRun = [];

    for (var i = 0; i < points.length; i += 1) {
      var point = points[i];
      if (i === 0) {
        currentRun.push(point);
        continue;
      }

      var previous = points[i - 1];
      var distance = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (distance > 1.5) {
        runs.push(currentRun);
        currentRun = [point];
      } else {
        currentRun.push(point);
      }
    }

    if (currentRun.length > 0) {
      runs.push(currentRun);
    }
    return runs;
  }

  function traceRun(ctx, run) {
    var cell = config.CELL_SIZE;
    ctx.beginPath();
    for (var i = 0; i < run.length; i += 1) {
      var x = (run[i].x + 0.5) * cell;
      var y = (run[i].y + 0.5) * cell;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (run.length === 1) {
      var singleX = (run[0].x + 0.5) * cell;
      var singleY = (run[0].y + 0.5) * cell;
      ctx.lineTo(singleX + 0.01, singleY);
    }
  }

  Renderer.prototype.drawSnakeBody = function drawSnakeBody(state) {
    var ctx = this.context;
    var cell = config.CELL_SIZE;
    var points = interpolateBody(state.snake, state.previousSegments, state.interpolation);
    var runs = splitIntoRuns(points);
    if (points.length === 0) {
      return;
    }

    var bodyColor = state.dead ? config.COLORS.snakeDeadBody : config.COLORS.snakeBody;
    var headColor = state.dead ? config.COLORS.snakeDeadHead : config.COLORS.snakeHead;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var pass = 0; pass < 3; pass += 1) {
      if (pass === 0) {
        ctx.strokeStyle = config.COLORS.snakeOutline;
        ctx.lineWidth = cell * SNAKE_OUTLINE_THICKNESS;
      } else if (pass === 1) {
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = cell * SNAKE_THICKNESS;
      } else {
        ctx.strokeStyle = config.COLORS.snakeHighlight;
        ctx.lineWidth = cell * SNAKE_THICKNESS * 0.34;
      }

      for (var r = 0; r < runs.length; r += 1) {
        traceRun(ctx, runs[r]);
        ctx.stroke();
      }
    }

    this.drawSnakeHead(points[0], state.snake.direction, headColor, state.dead);
  };

  Renderer.prototype.drawSnakeHead = function drawSnakeHead(point, directionName, color, dead) {
    var ctx = this.context;
    var cell = config.CELL_SIZE;
    var vector = config.DIRECTION[directionName] || config.DIRECTION.RIGHT;
    var size = cell * HEAD_SCALE;
    var centerX = (point.x + 0.5) * cell;
    var centerY = (point.y + 0.5) * cell;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.atan2(vector.y, vector.x));

    ctx.fillStyle = color;
    var radius = size * 0.34;
    drawRoundedSquare(ctx, -size / 2, -size / 2, size, size, radius);
    ctx.fill();

    var eyeOffsetX = size * 0.16;
    var eyeOffsetY = size * 0.21;
    var eyeRadius = Math.max(1.6, size * 0.1);

    ctx.fillStyle = config.COLORS.snakeEye;
    if (dead) {
      drawCross(ctx, eyeOffsetX, -eyeOffsetY, eyeRadius * 1.2);
      drawCross(ctx, eyeOffsetX, eyeOffsetY, eyeRadius * 1.2);
    } else {
      ctx.beginPath();
      ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  function drawRoundedSquare(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCross(ctx, x, y, size) {
    ctx.save();
    ctx.strokeStyle = config.COLORS.snakeEye;
    ctx.lineWidth = Math.max(1.4, size * 0.45);
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
    ctx.restore();
  }
Renderer.prototype.drawParticles = function drawParticles(particles) {
    if (!particles || particles.length === 0) {
      return;
    }
    var ctx = this.context;
    var size = config.PARTICLES.size;

    for (var i = 0; i < particles.length; i += 1) {
      var particle = particles[i];
      var alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x - size / 2),
        Math.round(particle.y - size / 2),
        size,
        size
      );
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.drawDeathFlash = function drawDeathFlash(state) {
    if (!state.deathFlash || state.deathFlash <= 0) {
      return;
    }
    var ctx = this.context;
    ctx.globalAlpha = Math.min(0.55, state.deathFlash * 0.55);
    ctx.fillStyle = config.COLORS.fruit;
    ctx.fillRect(0, 0, config.BOARD_SIZE, config.BOARD_SIZE);
    ctx.globalAlpha = 1;
  };

  /**
   * Paints one frame.
   * @param {Object} state Snapshot produced by the game loop.
   */
  Renderer.prototype.render = function render(state) {
    var ctx = this.context;
    var shake = state.shake || { x: 0, y: 0 };

    this.clear();

    ctx.save();
    ctx.translate(Math.round(shake.x), Math.round(shake.y));
    this.drawGrid();
    this.drawFruit(state.food, state.nowMs);
    this.drawBonus(state.food, state.nowMs);
    this.drawSnakeBody(state);
    this.drawParticles(state.particles);
    this.drawFrame();
    ctx.restore();

    this.drawDeathFlash(state);
  };

  SnakeGame.Renderer = Renderer;
})(window);
