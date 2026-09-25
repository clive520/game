/**
 * 《量子彈幕：維度穿梭》主遊戲引擎 (Quantum Barrage Main Controller)
 */
class QuantumBarrageGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 直立街機比例 540 x 780
    this.canvas.width = 540;
    this.canvas.height = 780;

    // 核心實體
    this.player = new PlayerShip(this.canvas.width, this.canvas.height);
    this.bullets = [];
    this.enemies = [];
    this.particles = [];

    // 背景星空卷軸 (雙層視差星光)
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        spd: Math.random() * 120 + 30,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    // 遊戲數值
    this.score = 0;
    this.grazeCount = 0;
    this.wave = 1;
    this.maxWaves = 10;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.isGameOver = false;
    this.isVictory = false;

    // 控制模式 (預設支援滑鼠跟隨與 WASD 鍵盤雙模式)
    this.isMouseMode = false;
    this.mousePos = { x: this.canvas.width / 2, y: this.canvas.height - 100 };
    this.keys = {};

    this.initDOM();
    this.initEvents();
    this.updateHUD();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initDOM() {
    this.livesLabel = document.getElementById("valLives");
    this.scoreLabel = document.getElementById("valScore");
    this.grazeLabel = document.getElementById("valGraze");
    this.energyFill = document.getElementById("energyFill");
    this.energyPercent = document.getElementById("energyPercent");
    this.btnBomb = document.getElementById("btnBomb");
    this.phasePill = document.getElementById("phasePill");
    this.toastEl = document.getElementById("alertToast");

    // 結算與說明彈窗
    this.modalOverlay = document.getElementById("modalOverlay");
    this.modalTitle = document.getElementById("modalTitle");
    this.modalDesc = document.getElementById("modalDesc");
    this.modalFinalScore = document.getElementById("modalFinalScore");
    this.modalFinalGraze = document.getElementById("modalFinalGraze");
    this.btnModalRestart = document.getElementById("btnModalRestart");

    this.helpModal = document.getElementById("helpModal");
    this.btnHelp = document.getElementById("btnHelp");
    this.btnCloseHelp = document.getElementById("btnCloseHelp");
    this.btnGotIt = document.getElementById("btnGotIt");
  }

  initEvents() {
    // 鍵盤監聽
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
      audio.resume();

      // 切換相位: Space / Shift / J
      if (e.code === "Space" || e.key === "Shift" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        this.togglePhase();
      }

      // 施放量子大絕: E / K
      if (e.key === "e" || e.key === "E" || e.key === "k" || e.key === "K") {
        this.triggerBomb();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // 滑鼠控制
    this.canvas.addEventListener("mousemove", (e) => {
      this.isMouseMode = true;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
    });

    // 滑鼠右鍵切換相位
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      audio.resume();
      this.togglePhase();
    });

    // 點擊大絕按鈕
    if (this.btnBomb) {
      this.btnBomb.addEventListener("click", () => this.triggerBomb());
    }

    // 說明彈窗開關
    if (this.btnHelp && this.helpModal) {
      this.btnHelp.addEventListener("click", () => this.helpModal.classList.add("active"));
    }
    if (this.btnCloseHelp && this.helpModal) {
      this.btnCloseHelp.addEventListener("click", () => this.helpModal.classList.remove("active"));
    }
    if (this.btnGotIt && this.helpModal) {
      this.btnGotIt.addEventListener("click", () => this.helpModal.classList.remove("active"));
    }
    if (this.helpModal) {
      this.helpModal.addEventListener("click", (e) => {
        if (e.target === this.helpModal) this.helpModal.classList.remove("active");
      });
    }

    // 重新開始
    if (this.btnModalRestart) {
      this.btnModalRestart.addEventListener("click", () => this.restartGame());
    }
  }

  togglePhase() {
    if (this.isGameOver || this.isVictory) return;
    const newPhase = this.player.togglePhase();
    this.updateHUD();

    // 擴散光圈
    const color = newPhase === "blue" ? "#00f0ff" : "#ff007f";
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      this.particles.push(new Particle(
        this.player.x, this.player.y, color,
        Math.cos(a) * 160, Math.sin(a) * 160, 0.3, 3
      ));
    }
  }

  triggerBomb() {
    if (this.player.useNova()) {
      this.showToast("💥 量子坍縮引爆！全螢幕消彈打擊！", "info");

      // 1. 將畫面上所有敵方子彈轉化為分數與吸光能量
      for (const b of this.bullets) {
        if (b.source === "enemy") {
          b.alive = false;
          this.score += 50;
          this.particles.push(new Particle(b.x, b.y, b.color, 0, -60, 0.4, 3, "+50"));
        }
      }

      // 2. 對全場敵人造成 500 毀滅打擊
      for (const enemy of this.enemies) {
        if (enemy.alive) {
          enemy.takeDamage(500, this.particles);
        }
      }

      // 3. 巨型震波光圈
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 350 + 100;
        this.particles.push(new Particle(
          this.player.x, this.player.y, "#a855f7",
          Math.cos(a) * spd, Math.sin(a) * spd, 0.6, 5
        ));
      }
      this.updateHUD();
    }
  }

  showToast(msg, type = "info") {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.className = `alert-toast show ${type}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.className = "alert-toast";
    }, 2500);
  }

  updateHUD() {
    if (this.livesLabel) this.livesLabel.textContent = "❤️".repeat(Math.max(0, this.player.lives));
    if (this.scoreLabel) this.scoreLabel.textContent = this.score;
    if (this.grazeLabel) this.grazeLabel.textContent = this.grazeCount;

    // 量子充能量表
    const pct = Math.min(100, Math.round((this.player.energy / this.player.maxEnergy) * 100));
    if (this.energyFill) {
      this.energyFill.style.width = `${pct}%`;
      this.energyFill.classList.toggle("ready", pct >= 100);
    }
    if (this.energyPercent) {
      this.energyPercent.textContent = pct >= 100 ? "READY 100%" : `${pct}%`;
    }
    if (this.btnBomb) {
      this.btnBomb.disabled = pct < 100;
    }

    // 相位指示膠囊
    if (this.phasePill) {
      if (this.player.phase === "blue") {
        this.phasePill.className = "phase-pill blue";
        this.phasePill.textContent = "⚡ ALPHA 相位 (吸收藍彈)";
      } else {
        this.phasePill.className = "phase-pill pink";
        this.phasePill.textContent = "🔥 BETA 相位 (吸收紅彈)";
      }
    }
  }

  restartGame() {
    this.player = new PlayerShip(this.canvas.width, this.canvas.height);
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.score = 0;
    this.grazeCount = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.isGameOver = false;
    this.isVictory = false;
    this.modalOverlay.classList.remove("active");
    this.updateHUD();
  }

  // 生成波次敵軍
  spawnWave(dt) {
    this.waveTimer += dt;
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.0;

      // 檢查是否生成 Boss
      if (this.wave === 5 || this.wave === 10) {
        if (!this.enemies.some(e => e.type === "boss")) {
          this.enemies.push(new Enemy("boss", this.canvas.width / 2, -50, this.canvas.width));
          this.showToast("⚠️ 警告：終極維度領主降臨！", "danger");
        }
      } else {
        // 生成一般無人機群與巡洋艦
        const rand = Math.random();
        if (rand < 0.5) {
          // 雙側無人機突擊
          this.enemies.push(new Enemy("drone", 80, -20, this.canvas.width));
          this.enemies.push(new Enemy("drone", this.canvas.width - 80, -20, this.canvas.width));
        } else if (rand < 0.8) {
          // 旋轉浮游砲
          this.enemies.push(new Enemy("spinner", Math.random() * (this.canvas.width - 120) + 60, -30, this.canvas.width));
        } else {
          // 重裝巡洋艦
          this.enemies.push(new Enemy("cruiser", Math.random() * (this.canvas.width - 160) + 80, -40, this.canvas.width));
        }
      }
    }

    // 波次前進條件 (每 25 秒或 Boss 被擊毀)
    if (this.waveTimer > 25 && this.wave < this.maxWaves) {
      this.wave++;
      this.waveTimer = 0;
      this.showToast(`進入第 ${this.wave} 維度波次！`, "info");
    }
  }

  update(dt) {
    if (this.isGameOver || this.isVictory) return;

    // 視差星空流動
    for (const star of this.stars) {
      star.y += star.spd * dt;
      if (star.y > this.canvas.height) {
        star.y = 0;
        star.x = Math.random() * this.canvas.width;
      }
    }

    // 玩家更新
    this.player.update(dt, this.keys, this.mousePos, this.isMouseMode, this.bullets, this.particles);

    // 生成敵軍
    this.spawnWave(dt);

    // 更新敵人
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player, this.bullets);
      // 超出底端移除
      if (enemy.y > this.canvas.height + 60) enemy.alive = false;
    }

    // 更新子彈
    for (const b of this.bullets) {
      b.update(dt);
      if (b.y < -20 || b.y > this.canvas.height + 20 || b.x < -20 || b.x > this.canvas.width + 20) {
        b.alive = false;
      }
    }

    // 碰撞檢測 1: 玩家子彈擊中敵人
    for (const b of this.bullets) {
      if (!b.alive || b.source !== "player") continue;

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(b.x - e.x, b.y - e.y);
        if (d <= b.radius + e.radius) {
          b.alive = false;
          e.takeDamage(b.damage, this.particles);
          if (!e.alive) {
            this.score += e.scoreVal;
            this.player.addEnergy(8); // 擊殺獲得充能
            if (e.type === "boss" && this.wave === this.maxWaves) {
              this.victory();
            }
          }
          break;
        }
      }
    }

    // 碰撞檢測 2: 敵方子彈 vs 玩家核心 & 擦彈
    for (const b of this.bullets) {
      if (!b.alive || b.source !== "enemy") continue;

      const d = Math.hypot(b.x - this.player.x, b.y - this.player.y);

      // A. 核心碰撞 (Core Hit)
      if (d <= b.radius + this.player.coreRadius) {
        if (b.phase === this.player.phase) {
          // 同色維度吸收！
          b.alive = false;
          audio.playAbsorb();
          this.player.addEnergy(4);
          this.score += 200;
          this.particles.push(new Particle(b.x, b.y, b.color, 0, -40, 0.35, 2, "+ABSORB"));
        } else {
          // 異色撞擊！受傷
          b.alive = false;
          if (this.player.takeHit(this.particles)) {
            this.showToast("⚠️ 受到異色量子彈幕直擊！失去 1 點生命！", "danger");
            if (this.player.lives <= 0) {
              this.gameOver();
            }
          }
        }
      }
      // B. 擦彈判定 (Graze)
      else if (d <= b.radius + this.player.grazeRadius && !b.grazed) {
        b.grazed = true;
        this.grazeCount++;
        this.score += 50;
        this.player.addEnergy(1.5);
        audio.playGraze();
        this.particles.push(new Particle(this.player.x, this.player.y, "#a855f7", (Math.random() - 0.5) * 30, -30, 0.2, 1.5));
      }
    }

    // 清理死亡物件
    this.enemies = this.enemies.filter(e => e.alive);
    this.bullets = this.bullets.filter(b => b.alive);

    // 更新粒子
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    this.updateHUD();
  }

  gameOver() {
    this.isGameOver = true;
    this.modalTitle.textContent = "💥 戰機量子解體！";
    this.modalTitle.style.color = "#f43f5e";
    this.modalDesc.textContent = "異色彈幕侵蝕了量子裝甲核心... 再次穿梭維度重新挑戰吧！";
    this.modalFinalScore.textContent = this.score;
    this.modalFinalGraze.textContent = this.grazeCount;
    this.modalOverlay.classList.add("active");
  }

  victory() {
    this.isVictory = true;
    this.modalTitle.textContent = "🏆 維度穿梭大捷！";
    this.modalTitle.style.color = "#00f0ff";
    this.modalDesc.textContent = "您成功消滅了終極維度領主，引領星際艦隊穿透了量子彈幕風暴！";
    this.modalFinalScore.textContent = this.score;
    this.modalFinalGraze.textContent = this.grazeCount;
    this.modalOverlay.classList.add("active");
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. 繪製視差星空
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 繪製敵人
    for (const e of this.enemies) e.draw(ctx);

    // 3. 繪製子彈
    for (const b of this.bullets) b.draw(ctx);

    // 4. 繪製玩家戰機
    if (!this.isGameOver) this.player.draw(ctx);

    // 5. 繪製粒子與飄字
    for (const p of this.particles) p.draw(ctx);
  }

  loop(currentTime) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(Math.min(dt, 0.1));
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.barrageGame = new QuantumBarrageGame();
});
