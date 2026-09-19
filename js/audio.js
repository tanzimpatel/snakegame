/**
 * audio.js - procedural sound effects built with the Web Audio API.
 * No asset files are needed: every sound is a short synthesised blip,
 * which keeps the game playable from the filesystem with no server.
 */
(function (root) {
  'use strict';

  var SnakeGame = root.SnakeGame || (root.SnakeGame = {});
  var AudioContextCtor = root.AudioContext || root.webkitAudioContext;

  var NOTE = {
    eat: { freq: 620, endFreq: 880, duration: 0.09, type: 'square', gain: 0.16 },
    bonus: { freq: 880, endFreq: 1480, duration: 0.16, type: 'square', gain: 0.18 },
    bonusExpire: { freq: 420, endFreq: 180, duration: 0.18, type: 'triangle', gain: 0.12 },
    turn: { freq: 240, endFreq: 200, duration: 0.035, type: 'square', gain: 0.05 },
    countdown: { freq: 480, endFreq: 480, duration: 0.09, type: 'square', gain: 0.13 },
    start: { freq: 520, endFreq: 1040, duration: 0.22, type: 'square', gain: 0.16 },
    pause: { freq: 520, endFreq: 300, duration: 0.12, type: 'triangle', gain: 0.11 },
    death: { freq: 300, endFreq: 60, duration: 0.55, type: 'sawtooth', gain: 0.2 },
    record: { freq: 660, endFreq: 1320, duration: 0.32, type: 'square', gain: 0.17 }
  };

  var context = null;
  var masterGain = null;
  var muted = false;

  function isSupported() {
    return typeof AudioContextCtor === 'function';
  }

  /**
   * Lazily creates the AudioContext. Browsers only allow this after a user
   * gesture, so every play call funnels through here.
   */
  function ensureContext() {
    if (!isSupported()) {
      return null;
    }
    if (!context) {
      context = new AudioContextCtor();
      masterGain = context.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(context.destination);
    }
    if (context.state === 'suspended' && typeof context.resume === 'function') {
      context.resume();
    }
    return context;
  }

  function playTone(settings, delaySeconds) {
    if (muted) {
      return;
    }
    var ctx = ensureContext();
    if (!ctx || !masterGain) {
      return;
    }

    var startAt = ctx.currentTime + (delaySeconds || 0);
    var oscillator = ctx.createOscillator();
    var envelope = ctx.createGain();

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.freq, startAt);
    if (settings.endFreq !== settings.freq) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, settings.endFreq),
        startAt + settings.duration
      );
    }

    envelope.gain.setValueAtTime(settings.gain, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + settings.duration);

    oscillator.connect(envelope);
    envelope.connect(masterGain);
    oscillator.start(startAt);
    oscillator.stop(startAt + settings.duration + 0.02);
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : 1;
    }
  }

  function isMuted() {
    return muted;
  }

  /** Unlocks audio on the very first user interaction. */
  function unlock() {
    ensureContext();
  }

  function play(name) {
    var settings = NOTE[name];
    if (!settings) {
      return;
    }
    playTone(settings, 0);
  }

  function playDeathSequence() {
    if (muted) {
      return;
    }
    playTone(NOTE.death, 0);
    playTone(NOTE.death, 0.14);
  }

  function playRecordFanfare() {
    if (muted) {
      return;
    }
    playTone(NOTE.record, 0);
    playTone(NOTE.bonus, 0.13);
    playTone(NOTE.start, 0.26);
  }

  SnakeGame.audio = {
    isSupported: isSupported,
    unlock: unlock,
    play: play,
    playDeathSequence: playDeathSequence,
    playRecordFanfare: playRecordFanfare,
    setMuted: setMuted,
    isMuted: isMuted
  };
})(window);
