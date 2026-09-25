/**
 * 《飛刀大作戰：月牙刃風暴》主遊戲引擎 (Game Controller)
 * 負責物理循環、攝影機跟隨、刀刃對撞火花演算、角色本體直擊斬殺、即時排行榜與大逃殺判定
 */

class KnifeStormGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 畫布與攝影機
    this.width = 800;
    this.height = 600;
    this.camera = { x: 1200, y: 1200 };

    // 遊戲狀態
    this.isGameOver = false;
    this.isVictory = false;
    this.matchTime = 0;

    // 實體
    this.arena = new Arena(2400);
    this.player = null;
    this.characters = [];
    this.particles = [];
    this.killLogs = [];

    // 控制輸入
    this.keys = {};
    this.mousePos = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isSpacePressed = false;
    this.isShiftPressed = false;

    this.initCanvasSize();
    this.initDOM();
    this.initEvents();
    this.startNewMatch();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  initDOM() {
    this.valKnives = document.getElementById("valKnives");
    this.valKills = document.getElementById("valKills");
    this.valAlive = document.getElementById("valAlive");
    this.valRank = document.getElementById("valRank");
    this.boostFill = document.getElementById("boostFill");
    this.leaderboardEl = document.getElementById("leaderboardList");
    this.killFeedEl = document.getElementById("killFeed");
    this.alertToast = document.getElementById("alertToast");

    // 底部控制
    this.btnDefense = document.getElementById("btnDefense");
    this.btnBoost = document.getElementById("btnBoost");
    this.btnHelp = document.getElementById("btnHelp");
    this.btnMute = document.getElementById("btnMute");

    // 彈窗
    this.helpModal = document.getElementById("helpModal");
    this.resultModal = document.getElementById("resultModal");
    this.resultTitle = document.getElementById("resultTitle");
    this.resultRank = document.getElementById("resultRank");
    this.resultKills = document.getElementById("resultKills");
    this.btnRestart = document.getElementById("btnRestart");

    this.updateHUD();
  }

  initEvents() {
    window.addEventListener("resize", () => this.initCanvasSize());

    // 鍵盤移動與姿態
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        this.isSpacePressed = true;
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        this.isShiftPressed = true;
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "Space") this.isSpacePressed = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.isShiftPressed = false;
    });

    // 滑鼠游標跟隨導向
    this.canvas.addEventListener("pointermove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.isMouseDown = true;
      if (e.button === 2) {
        // 滑鼠右鍵衝刺
        this.isShiftPressed = true;
      }
    });

    window.addEventListener("pointerup", (e) => {
      this.isMouseDown = false;
      if (e.button === 2) this.isShiftPressed = false;
    });

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // 按鈕控制
    if (this.btnDefense) {
      this.btnDefense.addEventListener("pointerdown", () => this.isSpacePressed = true);
      this.btnDefense.addEventListener("pointerup", () => this.isSpacePressed = false);
    }
    if (this.btnBoost) {
      this.btnBoost.addEventListener("pointerdown", () => this.isShiftPressed = true);
      this.btnBoost.addEventListener("pointerup", () => this.isShiftPressed = false);
    }

    if (this.btnMute) {
      this.btnMute.addEventListener("click", () => {
        const muted = window.knifeAudio.toggleMute();
        this.btnMute.textContent = muted ? "🔇 音效: 關" : "🔊 音效: 開";
      });
    }

    if (this.btnHelp && this.helpModal) {
      this.btnHelp.addEventListener("click", () => this.helpModal.classList.add("active"));
    }
    const btnGotIt = document.getElementById("btnGotIt");
    if (btnGotIt && this.helpModal) {
      btnGotIt.addEventListener("click", () => this.helpModal.classList.remove("active"));
    }
    const btnCloseHelp = document.getElementById("btnCloseHelp");
    if (btnCloseHelp && this.helpModal) {
      btnCloseHelp.addEventListener("click", () => this.helpModal.classList.remove("active"));
    }

    if (this.btnRestart) {
      this.btnRestart.addEventListener("click", () => {
        this.resultModal.classList.remove("active");
        this.startNewMatch();
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === this.helpModal) this.helpModal.classList.remove("active");
    });
  }

  showToast(msg, type = "info") {
    if (!this.alertToast) return;
    this.alertToast.textContent = msg;
    this.alertToast.className = `alert-toast show ${type}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.alertToast.className = "alert-toast";
    }, 2800);
  }

  addDeathNotice(killer, victim) {
    const notice = `${killer.name} 💥 終結了 ${victim.name}`;
    this.killLogs.unshift(notice);
    if (this.killLogs.length > 4) this.killLogs.pop();

    if (this.killFeedEl) {
      this.killFeedEl.innerHTML = this.killLogs.map(n => `<div class="kill-tag">${n}</div>`).join("");
    }
  }

  startNewMatch() {
    this.isGameOver = false;
    this.isVictory = false;
    this.matchTime = 0;
    this.particles = [];
    this.killLogs = [];
    if (this.killFeedEl) this.killFeedEl.innerHTML = "";

    // 重置競技場
    this.arena = new Arena(2400);

    // 建立玩家角色 (金陽月牙刃)
    this.player = new Character({
      name: "星際刀狂 (玩家)",
      isPlayer: true,
      x: 1200,
      y: 1200,
      skinKey: "gold",
      initialKnives: 3
    });

    // 建立 9 位各具風采的 AI 俠客對手
    const aiConfigs = [
      { name: "青龍劍仙", skinKey: "emerald" },
      { name: "碧玉修羅", skinKey: "emerald" },
      { name: "金輪法王", skinKey: "gold" },
      { name: "血刀老祖", skinKey: "crimson" },
      { name: "赤焰狂徒", skinKey: "crimson" },
      { name: "幽冥邪尊", skinKey: "violet" },
      { name: "紫電妖瞳", skinKey: "violet" },
      { name: "凌霜遊俠", skinKey: "cyan" },
      { name: "天刀宋缺", skinKey: "cyan" }
    ];

    this.characters = [this.player];

    for (let i = 0; i < aiConfigs.length; i++) {
      const angle = (i / aiConfigs.length) * Math.PI * 2;
      const dist = Math.random() * 500 + 400;
      const x = 1200 + Math.cos(angle) * dist;
      const y = 1200 + Math.sin(angle) * dist;

      this.characters.push(new Character({
        name: aiConfigs[i].name,
        isPlayer: false,
        x,
        y,
        skinKey: aiConfigs[i].skinKey,
        initialKnives: 3 + Math.floor(Math.random() * 2)
      }));
    }

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;

    this.showToast("⚔️ 飛刀大逃殺開戰！拾取飛刀，力爭霸主！", "info");
    this.updateHUD();
  }

  updatePlayerInput() {
    if (!this.player || !this.player.alive) return;

    // 姿態判斷：Space 鍵或靜止 -> 金鐘罩防禦態；Shift 鍵 -> 衝刺
    if (this.isSpacePressed) {
      this.player.stance = "defense";
    } else if (this.isShiftPressed && this.player.boostEnergy > 10) {
      this.player.stance = "boost";
    } else {
      this.player.stance = "normal";
    }

    // 計算移動向量 (優先取鍵盤 WASD，否則取滑鼠游標指針)
    let dirX = 0;
    let dirY = 0;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) dirY -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) dirY += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) dirX -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) dirX += 1;

    if (dirX !== 0 || dirY !== 0) {
      const len = Math.hypot(dirX, dirY);
      this.player.vx = dirX / len;
      this.player.vy = dirY / len;
    } else {
      // 根據滑鼠相對中心點位移
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const dx = this.mousePos.x - centerX;
      const dy = this.mousePos.y - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > 25) {
        this.player.vx = dx / dist;
        this.player.vy = dy / dist;
      } else {
        this.player.vx = 0;
        this.player.vy = 0;
      }
    }
  }

  // 物理碰撞檢測：刀對刀火花、刀對本體擊殺、本體拾取氣泡
  handleCollisions() {
    // 1. 角色碰觸地面飛刀氣泡 (Pickup)
    for (const char of this.characters) {
      if (!char.alive) continue;
      for (const bubble of this.arena.looseBubbles) {
        if (!bubble.alive) continue;
        const d = Math.hypot(char.x - bubble.x, char.y - bubble.y);
        if (d <= char.radius + bubble.radius + 8) {
          bubble.alive = false;
          char.addKnife();
          if (char.isPlayer) {
            window.knifeAudio.playPickup(char.knifeCount);
          }
          // 拾取小光環
          this.particles.push(new SparkParticle(bubble.x, bubble.y, char.skinConfig.outer, 0, -30, 0.35, 12, "+1 BLADE"));
        }
      }
    }

    // 2. 刀 vs 刀碰撞 ＆ 刀 vs 實體斬殺
    const living = this.characters.filter(c => c.alive);

    for (let i = 0; i < living.length; i++) {
      const c1 = living[i];
      for (let j = i + 1; j < living.length; j++) {
        const c2 = living[j];

        const charDist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        // 若兩角色相距過遠，跳過細部刀刃判定
        if (charDist > c1.getOrbitRadius() + c2.getOrbitRadius() + 60) continue;

        // A. 刀 vs 刀對撞 (Blade clash)
        let clashHappened = false;
        for (const b1 of c1.blades) {
          for (const b2 of c2.blades) {
            const bDist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            if (bDist <= b1.radius + b2.radius) {
              clashHappened = true;

              // 劇烈火花噴濺 (💥 如截圖中爆炸火花)
              const midX = (b1.x + b2.x) / 2;
              const midY = (b1.y + b2.y) / 2;
              for (let k = 0; k < 6; k++) {
                const a = Math.random() * Math.PI * 2;
                const spd = Math.random() * 160 + 80;
                this.particles.push(new SparkParticle(midX, midY, "#fbbf24", Math.cos(a) * spd, Math.sin(a) * spd, 0.25, 4));
              }

              // 金鐘罩彈刀判定
              if (c1.stance === "defense" && c2.stance !== "defense") {
                window.knifeAudio.playDeflect();
                // 彈開對手並震落對方一把刀
                if (c2.blades.length > 2) {
                  const dropped = c2.removeKnife();
                  if (dropped) this.arena.looseBubbles.push(new LooseKnifeBubble(b2.x, b2.y, c2.skinKey));
                }
              } else if (c2.stance === "defense" && c1.stance !== "defense") {
                window.knifeAudio.playDeflect();
                if (c1.blades.length > 2) {
                  const dropped = c1.removeKnife();
                  if (dropped) this.arena.looseBubbles.push(new LooseKnifeBubble(b1.x, b1.y, c1.skinKey));
                }
              } else {
                window.knifeAudio.playClash();
              }
              break;
            }
          }
          if (clashHappened) break;
        }

        // B. 刀 vs 角色本體直擊 (Body Slashed Elimination)
        // 檢查 c1 的刀刃是否直擊 c2 本體
        if (c2.alive && c2.stance !== "defense") {
          for (const b of c1.blades) {
            const d = Math.hypot(b.x - c2.x, b.y - c2.y);
            if (d <= b.radius + c2.radius * 0.75) {
              this.eliminateCharacter(c2, c1);
              break;
            }
          }
        }

        // 檢查 c2 的刀刃是否直擊 c1 本體
        if (c1.alive && c1.stance !== "defense") {
          for (const b of c2.blades) {
            const d = Math.hypot(b.x - c1.x, b.y - c1.y);
            if (d <= b.radius + c1.radius * 0.75) {
              this.eliminateCharacter(c1, c2);
              break;
            }
          }
        }
      }
    }
  }

  eliminateCharacter(victim, killer) {
    if (!victim.alive) return;
    victim.alive = false;
    killer.kills++;

    window.knifeAudio.playKill();
    this.addDeathNotice(killer, victim);

    // 陣亡者大爆飛刀氣泡！
    this.arena.spawnDeathBurst(victim.x, victim.y, victim.knifeCount, victim.skinKey);

    // 震撼爆破粒子
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 220 + 60;
      this.particles.push(new SparkParticle(victim.x, victim.y, victim.skinConfig.outer, Math.cos(a) * spd, Math.sin(a) * spd, 0.45, 5));
    }
    this.particles.push(new SparkParticle(victim.x, victim.y - 20, "#f43f5e", 0, -60, 0.8, 16, "SLAIN!"));

    // 檢查玩家是否陣亡
    if (victim.isPlayer) {
      this.handleGameOver();
      return;
    }

    // 檢查玩家是否成為唯一倖存者 (吃雞獲勝)
    const living = this.characters.filter(c => c.alive);
    if (living.length === 1 && living[0].isPlayer) {
      this.handleVictory();
    }
  }

  handleGameOver() {
    this.isGameOver = true;
    window.knifeAudio.playDefeat();

    const living = this.characters.filter(c => c.alive);
    const finalRank = living.length + 1;

    if (this.resultTitle) {
      this.resultTitle.textContent = "💥 俠客陣亡！";
      this.resultTitle.style.color = "#f43f5e";
    }
    if (this.resultRank) this.resultRank.textContent = `第 ${finalRank} 名`;
    if (this.resultKills) this.resultKills.textContent = `${this.player.kills} 次斬殺`;
    if (this.resultModal) this.resultModal.classList.add("active");
  }

  handleVictory() {
    this.isVictory = true;
    window.knifeAudio.playVictory();

    if (this.resultTitle) {
      this.resultTitle.textContent = "🏆 大吉大利，今晚吃雞！";
      this.resultTitle.style.color = "#fbbf24";
    }
    if (this.resultRank) this.resultRank.textContent = "👑 冠軍霸主！";
    if (this.resultKills) this.resultKills.textContent = `${this.player.kills} 次斬殺`;
    if (this.resultModal) this.resultModal.classList.add("active");
  }

  updateHUD() {
    if (this.player) {
      if (this.valKnives) this.valKnives.textContent = this.player.knifeCount;
      if (this.valKills) this.valKills.textContent = this.player.kills;
      if (this.boostFill) {
        const pct = Math.round((this.player.boostEnergy / this.player.maxBoostEnergy) * 100);
        this.boostFill.style.width = `${pct}%`;
      }
    }

    // 生存人數與排行
    const living = this.characters.filter(c => c.alive);
    if (this.valAlive) this.valAlive.textContent = living.length;

    // 排行榜即時計算 (按刀數由多到少排序)
    const sorted = [...living].sort((a, b) => b.knifeCount - a.knifeCount);
    const playerRankIndex = sorted.findIndex(c => c.isPlayer);
    if (this.valRank && playerRankIndex !== -1) {
      this.valRank.textContent = `#${playerRankIndex + 1}`;
    }

    if (this.leaderboardEl) {
      this.leaderboardEl.innerHTML = sorted.slice(0, 5).map((c, idx) => `
        <li class="${c.isPlayer ? 'is-player' : ''}">
          <span class="rank-badge">${idx === 0 ? '👑' : idx + 1}</span>
          <span class="rank-name">${c.name}</span>
          <span class="rank-score">${c.knifeCount} 刃</span>
        </li>
      `).join("");
    }
  }

  update(dt) {
    if (this.isGameOver || this.isVictory) return;

    this.matchTime += dt;

    // 1. 玩家操作更新
    this.updatePlayerInput();

    // 2. AI 思考與決策
    for (const char of this.characters) {
      if (!char.isPlayer && char.alive) {
        char.updateAI(dt, this.characters, this.arena.looseBubbles, this.arena.safeZone);
      }
    }

    // 3. 所有角色移動與飛刀更新
    for (const char of this.characters) {
      char.update(dt, this.arena.bounds);
    }

    // 4. 競技場與毒圈推進
    this.arena.update(dt, this.characters);

    // 5. 碰撞檢測 (刀碰刀、刀直擊本體、吃刀)
    this.handleCollisions();

    // 6. 粒子更新
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    // 7. 平滑攝影機跟隨玩家
    if (this.player && this.player.alive) {
      this.camera.x += (this.player.x - this.camera.x) * 6 * dt;
      this.camera.y += (this.player.y - this.camera.y) * 6 * dt;
    }

    this.updateHUD();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // 攝影機視角置中
    const viewLeft = this.camera.x - this.width / 2;
    const viewTop = this.camera.y - this.height / 2;
    ctx.translate(-viewLeft, -viewTop);

    // 1. 繪製競技場擂台地磚、邊界與毒圈
    this.arena.draw(ctx, { x: viewLeft, y: viewTop }, this.width, this.height);

    // 2. 繪製所有俠客角色與其身周飛刀陣
    const living = this.characters.filter(c => c.alive);
    const sorted = [...living].sort((a, b) => b.knifeCount - a.knifeCount);
    const leader = sorted[0];

    for (const char of living) {
      char.draw(ctx, char === leader);
    }

    // 3. 繪製火花與斬擊特效
    for (const p of this.particles) p.draw(ctx);

    ctx.restore();
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
  window.knifeGame = new KnifeStormGame();
});
