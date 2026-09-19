/**
 * particles.js - short-lived pixel debris used for juice on eat and death.
 * Positions are kept in board pixels so the renderer can draw them directly.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var config = SnakeGame.config;

  function ParticleSystem(randomFn) {
    this.random = typeof randomFn === 'function' ? randomFn : Math.random;
    this.pool = [];
  }

  ParticleSystem.prototype.clear = function clear() {
    this.pool.length = 0;
  };

  ParticleSystem.prototype.getParticles = function getParticles() {
    return this.pool;
  };

  ParticleSystem.prototype.isActive = function isActive() {
    return this.pool.length > 0;
  };

  function randomBetween(random, min, max) {
    return min + random() * (max - min);
  }

  /**
   * Emits a radial burst of pixels from the centre of a grid cell.
   */
  ParticleSystem.prototype.burst = function burst(cellX, cellY, options) {
    var settings = options || {};
    var count = settings.count || config.PARTICLES.fruitCount;
    var colors = settings.colors || [config.COLORS.fruit];
    var centerX = (cellX + 0.5) * config.CELL_SIZE;
    var centerY = (cellY + 0.5) * config.CELL_SIZE;
    var speedScale = settings.speedScale || 1;

    for (var i = 0; i < count; i += 1) {
      var angle = this.random() * Math.PI * 2;
      var speed = randomBetween(this.random, config.PARTICLES.minSpeed, config.PARTICLES.maxSpeed) * speedScale;
      var life = randomBetween(this.random, config.PARTICLES.minLifeMs, config.PARTICLES.maxLifeMs);

      this.pool.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        color: colors[Math.floor(this.random() * colors.length)]
      });
    }
  };

  ParticleSystem.prototype.update = function update(deltaMs) {
    if (this.pool.length === 0) {
      return;
    }

    var gravity = config.PARTICLES.gravity;
    var survivors = [];

    for (var i = 0; i < this.pool.length; i += 1) {
      var particle = this.pool[i];
      particle.life -= deltaMs;
      if (particle.life <= 0) {
        continue;
      }
      particle.x += particle.vx * deltaMs;
      particle.y += particle.vy * deltaMs;
      particle.vy += gravity * deltaMs;
      survivors.push(particle);
    }

    this.pool = survivors;
  };

  SnakeGame.ParticleSystem = ParticleSystem;
})(window);
