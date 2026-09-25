/**
 * 《引力回圈：重力幾何》音效合成器 (Web Audio API)
 * 純程式動態振盪器即時生成，零外部音訊資源依賴，快速且相容性極高
 */
class GravityAudioSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
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

  // 1. 探測器進入天體引力圈：共振空靈柔和鈴音
  playCapture() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // 溫暖的和弦基音 392Hz (G4) 帶微幅滑音
    osc.frequency.setValueAtTime(329.63, t); // E4
    osc.frequency.exponentialRampToValueAtTime(392.00, t + 0.12); // G4

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  // 2. 切線彈射釋放：高頻流暢脈衝推進音 (Pulse Slingshot)
  playRelease() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.18);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  // 3. 收集星鑽：清脆階梯水晶琶音 (大三和弦: C6, E6, G6)
  playShard(index = 0) {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const freqs = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
    const f = freqs[Math.min(index, freqs.length - 1)];

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.05, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.42);
  }

  // 4. 抵達終點蟲洞躍遷：宇宙宏偉勝利和弦 (C Major 9 Fanfare)
  playGoal() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99, 987.77, 1046.50]; // C5, E5, G5, B5, C6
    const t = this.ctx.currentTime;

    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.001, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, t + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.08 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.82);
    });
  }

  // 5. 撞擊障礙/墜入深空重試：幾何破碎低頻重低音
  playCrash() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 6. 衰變星即將爆炸警報 (Tick / Warning pulse)
  playDecayWarning() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(800, t);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }
}

// 全域音效實例
window.gravityAudio = new GravityAudioSystem();
