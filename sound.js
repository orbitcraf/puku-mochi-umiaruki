"use strict";

(() => {
  const toggle = document.getElementById("sound-toggle");
  if (!toggle) return;

  let context;
  let master;
  let windGain;
  let riverGain;
  let enabled = false;
  let currentScene = "departure";
  let birdTimer;
  let lastStep = 0;

  function createNoiseLoop(filterType, frequency) {
    const seconds = 2;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    source.connect(filter);
    source.start();
    return filter;
  }

  function initAudio() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      toggle.disabled = true;
      toggle.querySelector("b").textContent = "おと ×";
      return;
    }
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    windGain = context.createGain();
    riverGain = context.createGain();
    windGain.gain.value = 0;
    riverGain.gain.value = 0;
    createNoiseLoop("lowpass", 620).connect(windGain).connect(master);
    createNoiseLoop("bandpass", 1350).connect(riverGain).connect(master);
  }

  function ramp(param, value, duration = .7) {
    if (!context) return;
    param.cancelScheduledValues(context.currentTime);
    param.setValueAtTime(param.value, context.currentTime);
    param.linearRampToValueAtTime(value, context.currentTime + duration);
  }

  function applySceneSound() {
    if (!context) return;
    const isRiver = currentScene === "river";
    const isWindy = ["slope", "summit", "sunset"].includes(currentScene);
    ramp(windGain.gain, enabled ? (isWindy ? .12 : .052) : 0);
    ramp(riverGain.gain, enabled ? (isRiver ? .15 : .012) : 0);
  }

  function chirp() {
    if (!enabled || !context) return;
    const now = context.currentTime;
    [0, .11].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1560 + index * 280, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(2250 + index * 220, now + offset + .08);
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(.045, now + offset + .015);
      gain.gain.exponentialRampToValueAtTime(.001, now + offset + .11);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + .13);
    });
  }

  function step() {
    if (!enabled || !context || performance.now() - lastStep < 170) return;
    lastStep = performance.now();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(105, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(58, context.currentTime + .07);
    gain.gain.setValueAtTime(.032, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .08);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + .09);
  }

  function splash() {
    if (!enabled || !context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(510, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(170, context.currentTime + .32);
    gain.gain.setValueAtTime(.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .34);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + .36);
  }

  function scheduleBirds() {
    window.clearInterval(birdTimer);
    if (!enabled) return;
    birdTimer = window.setInterval(() => {
      if (["departure", "forest", "rest"].includes(currentScene)) chirp();
    }, 7200);
  }

  async function toggleSound() {
    initAudio();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    enabled = !enabled;
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", enabled ? "山の音をオフにする" : "山の音をオンにする");
    toggle.querySelector("b").textContent = enabled ? "おと ON" : "おと OFF";
    ramp(master.gain, enabled ? .7 : 0, .45);
    applySceneSound();
    scheduleBirds();
    if (enabled) chirp();
  }

  toggle.addEventListener("click", toggleSound);
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) context.suspend();
    else if (enabled) context.resume();
  });

  window.bookSound = {
    chirp,
    splash,
    step,
    setScene(scene) {
      currentScene = scene;
      applySceneSound();
    },
    isEnabled: () => enabled
  };
})();
