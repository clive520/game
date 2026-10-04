/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 沉浸式暗黑環境音效合成器 (Web Audio API)
 * 即時合成：手電筒機械開關、心跳加速、守衛警報刺音、沉悶腳步、門禁解鎖與勝利音效
 */

class MazeAudioSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.ambientGain = null;
    this.heartbeatTimer = null;
    this.currentHeartbeatInterval = null;
    this.lastStepTime = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.startAmbience();
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
    if (this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // 1. 低頻幽暗迷宮環境底噪 (Low frequency dark drone)
  startAmbience() {
    if (!this.ctx || this.ambientGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.ambientGain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, this.ctx.currentTime); // 55 Hz A1 low hum

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);

    osc.start();
  }

  // 2. 手電筒金屬開關點擊聲 (Flashlight Click)
  playFlashlightClick() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.03);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // 3. 潛行與奔跑腳步聲 (Footsteps)
  playFootstep(isRunning = false) {
    if (this.isMuted) return;
    const now = performance.now();
    const interval = isRunning ? 240 : 380;
    if (now - this.lastStepTime < interval) return;
    this.lastStepTime = now;

    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // 使用短促低通濾波白噪音模擬地毯/水泥腳步踏地
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isRunning ? 380 : 260, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isRunning ? 0.16 : 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // 4. 緊張心跳聲 (Double-thump Heartbeat: Lub-Dub)
  triggerHeartbeat(intensity = 0.5) {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const volume = Math.min(0.35, 0.1 + intensity * 0.25);

    // 第一跳 (Lub)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    gain1.gain.setValueAtTime(volume, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.11);

    // 第二跳 (Dub)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(70, t + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(40, t + 0.22);

    gain2.gain.setValueAtTime(volume * 0.75, t + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.14);
    osc2.stop(t + 0.25);
  }

  // 5. 守衛起疑停步聲 (Guard Suspicious "?")
  playSuspicious() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.linearRampToValueAtTime(370, t + 0.18);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  // 6. 發現主角！警戒驚悚刺音 (Guard Alert Stinger "!")
  playAlert() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // 不和諧減五度雙音引爆緊張感
    const freqs = [740, 1046, 1480];
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.35);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // 7. 獲得物品/電池/門禁卡音效 (Item Pickup)
  playPickup(isKeycard = false) {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = isKeycard ? [440, 554, 659, 880] : [587, 880];

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  // 8. 逃生門解鎖轟鳴 (Door Unlock)
  playDoorUnlock() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(240, t + 0.3);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.linearRampToValueAtTime(800, t + 0.3);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.55);
  }

  // 9. 被守衛逮住 Jumpscare 驚嚇雜音 (Caught / Death)
  playCaught() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(t);
  }

  // 10. 成功逃脫獲勝大調和弦 (Victory Fanfare)
  playVictory() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chord = [392, 523, 659, 784, 1046]; // G4, C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const noteTime = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.7);
    });
  }
}

window.MazeAudioSystem = MazeAudioSystem;
