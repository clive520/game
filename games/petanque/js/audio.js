/**
 * 《法式滾球：普羅旺斯大師》音效合成器 (Web Audio API)
 * 即時合成：金屬重球撞擊聲、木質目標球碰響、碎石砂地摩擦滾動聲、拋球破空聲與喝采
 */
class PetanqueAudioSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.lastClackTime = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. 鐵球激烈碰撞聲 (Heavy Steel-on-Steel CLACK!)
  playBouleClack(intensity = 1.0) {
    if (this.isMuted) return;
    const now = performance.now();
    if (now - this.lastClackTime < 40) return;
    this.lastClackTime = now;

    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const power = Math.min(1.5, Math.max(0.3, intensity));

    // 高頻金屬衝擊瞬間
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1420 + Math.random() * 200, t);
    osc1.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    gain1.gain.setValueAtTime(0.28 * power, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.13);

    // 低頻金屬共鳴重擊
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(320, t);
    osc2.frequency.exponentialRampToValueAtTime(160, t + 0.15);

    gain2.gain.setValueAtTime(0.22 * power, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.19);
  }

  // 2. 撞擊目標小木球清脆木聲 (Wooden Jack TOC!)
  playWoodHit() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.06);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 3. 碎石沙地著地頓響 (Landing Thud on Gravel)
  playLanding() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 4. 拋球破空聲 (Throw Whoosh)
  playThrow() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.14);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  // 5. 皮尺測量音 (Tape Measure Tick)
  playMeasureTick() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, t);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // 6. 得分歡呼 (Cheer & Point Sound)
  playScorePoints() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99]; // C5, E5, G5
    const t = this.ctx.currentTime;

    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.12, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.36);
    });
  }

  // 7. 普羅旺斯大賽大捷勝利音樂 (Provence Accordion Fanfare)
  playVictory() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const melody = [
      { f: 523.25, d: 0.18 }, // C5
      { f: 659.25, d: 0.18 }, // E5
      { f: 783.99, d: 0.18 }, // G5
      { f: 1046.50, d: 0.4 }, // C6
      { f: 880.00, d: 0.18 }, // A5
      { f: 1046.50, d: 0.6 }  // C6
    ];

    let t = this.ctx.currentTime;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + note.d + 0.02);

      t += note.d * 0.85;
    });
  }
}

window.petanqueAudio = new PetanqueAudioSystem();
