
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  constructor() {
    // We defer initialization until user interaction
  }

  public init() {
    if (this.initialized) return;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25; // Reasonable master volume
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.error("AudioContext not supported");
    }
  }

  private getContext(): AudioContext | null {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Helper for distortion
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public playShoot(isAuto: boolean = false) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const duration = isAuto ? 0.12 : 0.25;

    // --- LAYER 1: THE BODY (Low Impact) ---
    const kickOsc = ctx.createOscillator();
    kickOsc.type = 'triangle';
    kickOsc.frequency.setValueAtTime(150, t);
    kickOsc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    const kickGain = ctx.createGain();
    kickGain.gain.setValueAtTime(0.8, t);
    kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    kickOsc.connect(kickGain);
    kickGain.connect(this.masterGain);
    kickOsc.start(t);
    kickOsc.stop(t + 0.1);

    // --- LAYER 2: THE EXPLOSION (Distorted Noise) ---
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, t); // Open filter
    noiseFilter.frequency.exponentialRampToValueAtTime(500, t + duration * 0.5);

    // Distortion for "Grit"
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(isAuto ? 200 : 400); // Heavy distortion

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(shaper);
    shaper.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);

    // --- LAYER 3: MECHANICAL CLACK (High Mid) ---
    const mechOsc = ctx.createOscillator();
    mechOsc.type = 'sawtooth';
    mechOsc.frequency.setValueAtTime(600, t);
    mechOsc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    const mechGain = ctx.createGain();
    mechGain.gain.setValueAtTime(0.3, t);
    mechGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    const mechFilter = ctx.createBiquadFilter();
    mechFilter.type = 'highpass';
    mechFilter.frequency.value = 1000;

    mechOsc.connect(mechFilter);
    mechFilter.connect(mechGain);
    mechGain.connect(this.masterGain);
    mechOsc.start(t);
    mechOsc.stop(t + 0.06);
  }

  public playDryFire() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playReload() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // 1. Mag Out (Slide friction)
    const magOutNoise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d1 = magOutNoise.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.random() * 2 - 1;

    const src1 = ctx.createBufferSource();
    src1.buffer = magOutNoise;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.value = 600;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.3, t);
    g1.gain.linearRampToValueAtTime(0, t + 0.2);

    src1.connect(f1); f1.connect(g1); g1.connect(this.masterGain);
    src1.start(t);

    // 2. Mag In (Solid Thud) - Delay 0.8s
    const t2 = t + 0.8;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(150, t2);
    osc2.frequency.exponentialRampToValueAtTime(50, t2 + 0.1);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.4, t2);
    g2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.1);

    osc2.connect(g2); g2.connect(this.masterGain);
    osc2.start(t2); osc2.stop(t2 + 0.1);

    // 3. Slide Rack (Click-Clack) - Delay 1.5s
    const t3 = t + 1.5;

    // Part A: Click
    const osc3a = ctx.createOscillator();
    osc3a.type = 'sawtooth';
    osc3a.frequency.setValueAtTime(600, t3);
    osc3a.frequency.linearRampToValueAtTime(800, t3 + 0.05);
    const g3a = ctx.createGain();
    g3a.gain.setValueAtTime(0.2, t3);
    g3a.gain.exponentialRampToValueAtTime(0.01, t3 + 0.05);
    osc3a.connect(g3a); g3a.connect(this.masterGain);
    osc3a.start(t3); osc3a.stop(t3 + 0.05);

    // Part B: Clack
    const osc3b = ctx.createOscillator();
    osc3b.type = 'square';
    osc3b.frequency.setValueAtTime(400, t3 + 0.1);
    osc3b.frequency.linearRampToValueAtTime(200, t3 + 0.15);
    const g3b = ctx.createGain();
    g3b.gain.setValueAtTime(0.2, t3 + 0.1);
    g3b.gain.exponentialRampToValueAtTime(0.01, t3 + 0.15);
    osc3b.connect(g3b); g3b.connect(this.masterGain);
    osc3b.start(t3 + 0.1); osc3b.stop(t3 + 0.15);
  }

  public playAmmoPickup() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Metallic clink
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }


  /* SPATIAL AUDIO HELPERS */

  public updateListener(x: number, y: number, angle: number) {
    const ctx = this.getContext();
    if (!ctx || !this.initialized) return;

    // Web Audio API uses a right-handed coordinate system.
    // We map: Game X -> Audio X, Game Y -> Audio Z (depth), Z -> Y (height, usually 0)
    const listener = ctx.listener;

    // Position
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = 0;
      listener.positionZ.value = y;
    } else {
      listener.setPosition(x, 0, y);
    }

    // Orientation
    // Game angle is likely 0 = North (or East?), we need to convert to forward vector
    // Standard: X=sin(a), Z=cos(a) depending on coordinate system
    // Assuming standard FPS: X is left/right, Y is depth.
    const fwdX = Math.cos(angle);
    const fwdZ = Math.sin(angle);

    if (listener.forwardX) {
      listener.forwardX.value = fwdX;
      listener.forwardY.value = 0;
      listener.forwardZ.value = fwdZ;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setOrientation(fwdX, 0, fwdZ, 0, 1, 0);
    }
  }

  private createPanner(x: number, y: number): PannerNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.0;
    panner.maxDistance = 50.0;
    panner.rolloffFactor = 1.0;
    panner.positionX.value = x;
    panner.positionY.value = 0;
    panner.positionZ.value = y;

    return panner;
  }

  public playEnemyShoot(pos: { x: number, y: number } | null = null) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Distinctive enemy gunshot (higher pitch/different tone)
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    // Graph Connection
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    if (pos) {
      const panner = this.createPanner(pos.x, pos.y);
      if (panner) {
        noiseGain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        noiseGain.connect(this.masterGain);
      }
    } else {
      noiseGain.connect(this.masterGain);
    }

    noise.start(t);
  }

  public playPlayerDamage() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playEnemyHit(pos: { x: number, y: number } | null = null) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Short high pitch noise
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    if (pos) {
      const panner = this.createPanner(pos.x, pos.y);
      if (panner) {
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain);
      }
    } else {
      osc.connect(gain);
      gain.connect(this.masterGain);
    }

    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playEnemyDeath(pos: { x: number, y: number } | null = null) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Longer descending moan/crumble
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);

    // Distortion
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(400);

    osc.connect(shaper);
    shaper.connect(gain);

    if (pos) {
      const panner = this.createPanner(pos.x, pos.y);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        gain.connect(this.masterGain);
      }
    } else {
      gain.connect(this.masterGain);
    }

    osc.start(t);
    osc.stop(t + 0.6);
  }

  public playHeal() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Ascending chime
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);

    // Sparkle layer
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, t);
    osc2.frequency.linearRampToValueAtTime(2000, t + 0.3);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.1, t);
    gain2.gain.linearRampToValueAtTime(0, t + 0.3);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t);
    osc2.stop(t + 0.3);
  }

  public playStep() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }


}