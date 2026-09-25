/**
 * 《星際泡泡龍：光子消消樂》音效合成器 (Web Audio API)
 * 即時振盪器動態合成，包含音階連擊升高 POP 聲、球體碰壁音、大片掉落音與炸彈音效
 */
class BubbleAudioSystem {
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

  // 1. 發射泡泡發射音 (Launch Thump / Pop)
  playShoot() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 2. 泡泡碰壁反彈音 (Wall Rebound Tick)
  playBounce() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.05);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  // 3. 泡泡消除破裂音 (Combo Pitch-Shifted Pop)
  // 連擊越高，音階依次升高 (Do -> Re -> Mi -> Fa -> Sol -> La -> Si -> 高音Do)
  playPop(combo = 1) {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    // 大調音階階梯
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
    const baseFreq = scale[Math.min(combo - 1, scale.length - 1)];

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // 瞬時頻率微升模擬氣泡破裂的清脆感
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.08);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  // 4. 懸空泡泡大片脫落墜落音 (Cascade Drops)
  playDropCascade(count = 1) {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    const numNotes = Math.min(notes.length, Math.max(2, Math.floor(count / 2)));

    for (let i = 0; i < numNotes; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(notes[i], t + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 0.6, t + i * 0.05 + 0.18);

      gain.gain.setValueAtTime(0.12, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.23);
    }
  }

  // 5. 特殊炸彈泡泡爆炸音 (Bomb Explosion)
  playBomb() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 重低音衝擊
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.38);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.43);
  }

  // 6. 特殊雷射泡泡貫穿音 (Laser Sweep)
  playLaser() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.29);
  }

  // 7. 切換備彈音 (Swap Bubble)
  playSwap() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  }

  // 8. 警戒線逼近警告音 (Warning Pulse)
  playWarning() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 9. 關卡獲勝慶祝和弦 (Victory Fanfare)
  playVictory() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
    const t = this.ctx.currentTime;

    chords.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + idx * 0.09);

      gain.gain.setValueAtTime(0.001, t + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.14, t + idx * 0.09 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.09 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.09);
      osc.stop(t + idx * 0.09 + 0.62);
    });
  }

  // 10. 遊戲結束音效 (Game Over Descending)
  playGameOver() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const notes = [440, 415.3, 392, 349.23];
    const t = this.ctx.currentTime;

    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + idx * 0.14);

      gain.gain.setValueAtTime(0.14, t + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.14);
      osc.stop(t + idx * 0.14 + 0.38);
    });
  }
}

window.bubbleAudio = new BubbleAudioSystem();
