/**
 * 《星際泡泡龍：光子消消樂》遊戲主引擎 (Game Controller)
 * 負責物理循環、折射預測瞄準線、射擊碰撞判定、三消爆破、懸空自由落體、警戒線與關卡存檔
 */

class BubbleShooterGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 遊戲模式："stage" (20 關卡) | "endless" (無盡下壓狂潮)
    this.mode = "stage";
    this.currentLevelIndex = 0; // 0 ~ 19

    // 遊戲數值
    this.score = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.maxMisses = 5; // 5 次未消除下壓一次天花板
    this.dangerRow = 12; // 超過第 12 行觸發警戒線判定

    // 狀態
    this.isShooting = false;
    this.isGameOver = false;
    this.isVictory = false;

    // 實體
    this.grid = null;
    this.cannon = null;
    this.shootingBubble = null;
    this.fallingBubbles = [];
    this.particles = [];

    // 準星與瞄準
    this.aimPos = { x: 220, y: 100 };

    // 關卡進度與無盡紀錄
    this.levelStars = JSON.parse(localStorage.getItem("bubble_stars") || "{}");
    this.unlockedLevel = parseInt(localStorage.getItem("bubble_unlocked") || "1", 10);
    this.endlessBest = parseInt(localStorage.getItem("bubble_endless_best") || "0", 10);

    this.initCanvasSize();
    this.initDOM();
    this.initEvents();

    // 載入初始關卡
    this.loadLevel(this.currentLevelIndex);

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    // 動態計算泡泡半徑 (10 列泡泡滿版適配)
    this.bubbleRadius = Math.max(16, Math.min(26, Math.floor(this.width / 20.5)));

    if (this.grid) {
      this.grid.radius = this.bubbleRadius;
      this.grid.rowHeight = this.bubbleRadius * Math.sqrt(3);
    }
    if (this.cannon) {
      this.cannon.x = this.width / 2;
      this.cannon.y = this.height - this.bubbleRadius * 2.2;
      this.cannon.radius = this.bubbleRadius;
    }
  }

  initDOM() {
    this.lblLevelTitle = document.getElementById("lblLevelTitle");
    this.lblScore = document.getElementById("valScore");
    this.lblCombo = document.getElementById("valCombo");
    this.modePill = document.getElementById("modePill");
    this.alertToast = document.getElementById("alertToast");
    this.foulDots = document.getElementById("foulDots");

    // 控制按鈕
    this.btnSwap = document.getElementById("btnSwap");
    this.btnLevels = document.getElementById("btnLevels");
    this.btnToggleMode = document.getElementById("btnToggleMode");
    this.btnHelp = document.getElementById("btnHelp");
    this.btnMute = document.getElementById("btnMute");

    // 彈窗
    this.helpModal = document.getElementById("helpModal");
    this.levelSelectModal = document.getElementById("levelSelectModal");
    this.levelGrid = document.getElementById("levelGrid");
    this.victoryModal = document.getElementById("victoryModal");
    this.victoryTitle = document.getElementById("victoryTitle");
    this.victoryScore = document.getElementById("victoryScore");
    this.victoryStars = document.getElementById("victoryStars");
    this.btnNextLevel = document.getElementById("btnNextLevel");

    this.gameOverModal = document.getElementById("gameOverModal");
    this.gameOverScore = document.getElementById("gameOverScore");
    this.btnRetry = document.getElementById("btnRetry");

    this.updateHUD();
  }

  initEvents() {
    window.addEventListener("resize", () => this.initCanvasSize());

    // 滑鼠與觸控移動瞄準
    const updateAim = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      this.aimPos = { x, y };
      if (this.cannon) this.cannon.aimAt(x, y);
    };

    this.canvas.addEventListener("pointermove", (e) => {
      updateAim(e.clientX, e.clientY);
    });

    // 點擊發射泡泡
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      updateAim(e.clientX, e.clientY);
      this.shoot();
    });

    // 鍵盤操作 (Space 射擊, C 交換備彈, R 重試)
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === " " || e.key === "Spacebar" || e.keyCode === 32) {
        e.preventDefault();
        this.shoot();
      } else if (e.code === "KeyC" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        this.swapBubbles();
      } else if (e.code === "KeyR" || e.key === "r" || e.key === "R") {
        e.preventDefault();
        this.restartLevel();
      }
    });

    // 備彈切換按鈕
    if (this.btnSwap) {
      this.btnSwap.addEventListener("click", () => this.swapBubbles());
    }

    // 音效開關
    if (this.btnMute) {
      this.btnMute.addEventListener("click", () => {
        const muted = window.bubbleAudio.toggleMute();
        this.btnMute.textContent = muted ? "🔇 音效: 關" : "🔊 音效: 開";
      });
    }

    // 模式切換
    if (this.btnToggleMode) {
      this.btnToggleMode.addEventListener("click", () => {
        this.mode = this.mode === "stage" ? "endless" : "stage";
        if (this.mode === "endless") {
          this.startEndlessMode();
        } else {
          this.loadLevel(this.currentLevelIndex);
        }
      });
    }

    // 選關彈窗
    if (this.btnLevels && this.levelSelectModal) {
      this.btnLevels.addEventListener("click", () => this.openLevelSelectModal());
    }

    // 幫助指南彈窗
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

    // 下一關
    if (this.btnNextLevel) {
      this.btnNextLevel.addEventListener("click", () => {
        this.victoryModal.classList.remove("active");
        if (this.currentLevelIndex < window.BUBBLE_LEVELS.length - 1) {
          this.loadLevel(this.currentLevelIndex + 1);
        } else {
          this.showToast("🎉 恭喜通關全部 20 關！進入無盡下壓狂潮！", "info");
          this.mode = "endless";
          this.startEndlessMode();
        }
      });
    }

    // 重試
    if (this.btnRetry) {
      this.btnRetry.addEventListener("click", () => {
        this.gameOverModal.classList.remove("active");
        this.restartLevel();
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === this.levelSelectModal) this.levelSelectModal.classList.remove("active");
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

  loadLevel(index) {
    this.mode = "stage";
    this.currentLevelIndex = index;
    const lvl = window.BUBBLE_LEVELS[index];
    if (!lvl) return;

    this.isShooting = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.score = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.fallingBubbles = [];
    this.particles = [];

    // 初始化網格
    this.grid = new BubbleGrid(10, 16, this.bubbleRadius);
    for (let r = 0; r < lvl.layout.length; r++) {
      const row = lvl.layout[r];
      const maxCols = (r % 2 === 1) ? this.grid.cols - 1 : this.grid.cols;
      for (let c = 0; c < maxCols; c++) {
        const color = row[c];
        if (color) {
          this.grid.cells[r][c] = { color };
        }
      }
    }

    // 初始化砲台
    const cannonY = this.height - this.bubbleRadius * 2.2;
    this.cannon = new CannonTurret(this.width / 2, cannonY, this.bubbleRadius);
    this.cannon.aimAt(this.aimPos.x, this.aimPos.y);

    const colors = this.grid.getExistingColors();
    this.cannon.setColors(
      colors[Math.floor(Math.random() * colors.length)],
      colors[Math.floor(Math.random() * colors.length)]
    );

    this.showToast(`進入第 ${lvl.id} 關：${lvl.title}`, "info");
    this.updateHUD();
  }

  startEndlessMode() {
    this.mode = "endless";
    this.isShooting = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.score = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.fallingBubbles = [];
    this.particles = [];

    this.grid = new BubbleGrid(10, 16, this.bubbleRadius);
    // 生成頂部 5 行泡泡
    for (let r = 0; r < 5; r++) {
      const rowColors = window.EndlessBubbleGenerator.generateRow(10, r % 2 === 1);
      for (let c = 0; c < rowColors.length; c++) {
        this.grid.cells[r][c] = { color: rowColors[c] };
      }
    }

    const cannonY = this.height - this.bubbleRadius * 2.2;
    this.cannon = new CannonTurret(this.width / 2, cannonY, this.bubbleRadius);
    this.cannon.aimAt(this.aimPos.x, this.aimPos.y);

    const colors = this.grid.getExistingColors();
    this.cannon.setColors(
      colors[Math.floor(Math.random() * colors.length)],
      colors[Math.floor(Math.random() * colors.length)]
    );

    this.showToast("🌌 進入無盡下壓狂潮！保持冷靜迅速消除！", "info");
    this.updateHUD();
  }

  restartLevel() {
    if (this.mode === "endless") {
      this.startEndlessMode();
    } else {
      this.loadLevel(this.currentLevelIndex);
    }
  }

  swapBubbles() {
    if (this.isShooting || this.isGameOver || this.isVictory) return;
    if (this.cannon) this.cannon.swapBubbles();
  }

  shoot() {
    if (this.isShooting || this.isGameOver || this.isVictory || !this.cannon) return;

    window.bubbleAudio.playShoot();
    this.isShooting = true;

    this.shootingBubble = new ShootingBubble(
      this.cannon.x,
      this.cannon.y,
      this.cannon.angle,
      this.cannon.currentBubble,
      this.bubbleRadius
    );
  }

  // 繪製雷射折射預測虛線 (Predictive Trajectory Guide)
  drawAimTrajectory(ctx) {
    if (this.isShooting || this.isGameOver || this.isVictory || !this.cannon) return;

    let currX = this.cannon.x;
    let currY = this.cannon.y;
    let dirX = Math.cos(this.cannon.angle);
    let dirY = Math.sin(this.cannon.angle);

    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(currX, currY);

    const stepDist = 8;
    let bounces = 0;
    const maxBounces = 3;

    for (let i = 0; i < 280; i++) {
      currX += dirX * stepDist;
      currY += dirY * stepDist;

      // 檢查碰到左右牆壁折射
      if (currX - this.bubbleRadius <= 0) {
        currX = this.bubbleRadius;
        dirX = -dirX;
        ctx.lineTo(currX, currY);
        bounces++;
        if (bounces > maxBounces) break;
      } else if (currX + this.bubbleRadius >= this.width) {
        currX = this.width - this.bubbleRadius;
        dirX = -dirX;
        ctx.lineTo(currX, currY);
        bounces++;
        if (bounces > maxBounces) break;
      }

      // 檢查碰到天花板或相鄰泡泡
      if (currY - this.bubbleRadius <= 0) {
        ctx.lineTo(currX, currY);
        break;
      }

      // 檢查是否與任何格子中的現有泡泡碰撞 (距離小於 2 * R)
      let hit = false;
      for (let r = 0; r < this.grid.rows; r++) {
        const maxCols = (r % 2 === 1) ? this.grid.cols - 1 : this.grid.cols;
        for (let c = 0; c < maxCols; c++) {
          if (this.grid.cells[r][c] !== null) {
            const pos = this.grid.getCellPos(r, c);
            const d = Math.hypot(currX - pos.x, currY - pos.y);
            if (d <= this.bubbleRadius * 1.85) {
              hit = true;
              break;
            }
          }
        }
        if (hit) break;
      }

      if (hit) {
        ctx.lineTo(currX, currY);
        break;
      }
    }

    ctx.stroke();

    // 在預測落點繪製光圈瞄準星
    ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(currX, currY, this.bubbleRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 泡泡吸附與三消判定邏輯
  onBubbleSnap(snapCoord, bubbleColor) {
    this.grid.cells[snapCoord.r][snapCoord.c] = { color: bubbleColor };

    // 1. 三消 Flood-Fill 判定
    const matches = this.grid.findMatches(snapCoord.r, snapCoord.c);

    if (matches.length >= 3 || bubbleColor === "bomb" || bubbleColor === "laser") {
      this.comboStreak++;
      window.bubbleAudio.playPop(this.comboStreak);

      if (bubbleColor === "bomb") window.bubbleAudio.playBomb();
      else if (bubbleColor === "laser") window.bubbleAudio.playLaser();

      // 消除匹配的泡泡
      let popPoints = 0;
      for (const { r, c } of matches) {
        const b = this.grid.cells[r][c];
        if (b) {
          const pos = this.grid.getCellPos(r, c);
          // 產生彩光爆裂粒子
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = Math.random() * 120 + 40;
            this.particles.push(new BubbleParticle(pos.x, pos.y, window.BUBBLE_COLORS[b.color]?.hex || "#fff", Math.cos(a) * spd, Math.sin(a) * spd, 0.4, 3.5));
          }
          this.grid.cells[r][c] = null;
          popPoints += 30;
        }
      }

      const totalMatchScore = popPoints * this.comboStreak;
      this.score += totalMatchScore;

      // 飄出連擊字樣
      const hitPos = this.grid.getCellPos(snapCoord.r, snapCoord.c);
      const comboText = this.comboStreak > 1 ? `COMBO x${this.comboStreak}! +${totalMatchScore}` : `+${totalMatchScore}`;
      this.particles.push(new BubbleParticle(hitPos.x, hitPos.y - 15, "#fbbf24", 0, -40, 0.65, 14, comboText));

      // 2. 懸空泡泡脫落判定 (Orphan Detection)
      const orphans = this.grid.findOrphans();
      if (orphans.length > 0) {
        window.bubbleAudio.playDropCascade(orphans.length);
        const dropScore = orphans.length * 80 * this.comboStreak;
        this.score += dropScore;

        for (const orphan of orphans) {
          const pos = this.grid.getCellPos(orphan.r, orphan.c);
          this.fallingBubbles.push(new FallingBubble(pos.x, pos.y, orphan.bubble.color, this.bubbleRadius));
          this.grid.cells[orphan.r][orphan.c] = null;
        }

        this.particles.push(new BubbleParticle(hitPos.x, hitPos.y + 20, "#38bdf8", 0, -50, 0.8, 16, `MEGA DROP! +${dropScore}`));
      }
    } else {
      // 未產生三消，中斷連擊並累計失誤
      this.comboStreak = 0;
      this.missCount++;

      if (this.missCount >= this.maxMisses) {
        this.missCount = 0;
        this.showToast("⚠️ 天花板下壓一層！", "danger");
        this.grid.pushDownRow();
      }
    }

    // 檢查盤面是否全清
    if (this.grid.isEmpty()) {
      this.stageClear();
      return;
    }

    // 檢查泡泡是否觸碰到底部危險警戒線 (第 12 行)
    if (this.grid.hasReachedDangerLine(this.dangerRow)) {
      this.gameOver();
      return;
    }

    // 重新裝填砲台備彈
    const availableColors = this.grid.getExistingColors();
    this.cannon.currentBubble = this.cannon.nextBubble;
    this.cannon.nextBubble = availableColors[Math.floor(Math.random() * availableColors.length)];
    this.isShooting = false;
    this.shootingBubble = null;
    this.updateHUD();
  }

  stageClear() {
    this.isVictory = true;
    this.isShooting = false;
    window.bubbleAudio.playVictory();

    const stars = this.score > 2500 ? 3 : this.score > 1200 ? 2 : 1;
    const lvl = window.BUBBLE_LEVELS[this.currentLevelIndex];

    const prevStars = this.levelStars[lvl.id] || 0;
    if (stars > prevStars) {
      this.levelStars[lvl.id] = stars;
      localStorage.setItem("bubble_stars", JSON.stringify(this.levelStars));
    }
    if (lvl.id >= this.unlockedLevel && this.unlockedLevel < window.BUBBLE_LEVELS.length) {
      this.unlockedLevel = lvl.id + 1;
      localStorage.setItem("bubble_unlocked", this.unlockedLevel.toString());
    }

    if (this.victoryTitle) this.victoryTitle.textContent = `🏆 ${lvl.title} 全清獲勝！`;
    if (this.victoryScore) this.victoryScore.textContent = this.score;
    if (this.victoryStars) this.victoryStars.textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    if (this.victoryModal) this.victoryModal.classList.add("active");
  }

  gameOver() {
    this.isGameOver = true;
    this.isShooting = false;
    window.bubbleAudio.playGameOver();

    if (this.gameOverScore) this.gameOverScore.textContent = this.score;
    if (this.gameOverModal) this.gameOverModal.classList.add("active");
  }

  openLevelSelectModal() {
    if (!this.levelGrid) return;
    this.levelGrid.innerHTML = "";

    window.BUBBLE_LEVELS.forEach((lvl, idx) => {
      const card = document.createElement("button");
      const isLocked = lvl.id > this.unlockedLevel;
      const starsEarned = this.levelStars[lvl.id] || 0;

      card.className = `level-card ${isLocked ? "locked" : ""} ${idx === this.currentLevelIndex ? "current" : ""}`;
      card.disabled = isLocked;

      card.innerHTML = `
        <div class="lvl-number">${isLocked ? "🔒" : lvl.id}</div>
        <div class="lvl-name">${lvl.title}</div>
        <div class="lvl-stars">${"⭐".repeat(starsEarned)}${"☆".repeat(3 - starsEarned)}</div>
      `;

      card.addEventListener("click", () => {
        this.loadLevel(idx);
        this.levelSelectModal.classList.remove("active");
      });

      this.levelGrid.appendChild(card);
    });

    this.levelSelectModal.classList.add("active");
  }

  updateHUD() {
    if (this.mode === "stage") {
      const lvl = window.BUBBLE_LEVELS[this.currentLevelIndex];
      if (this.lblLevelTitle) this.lblLevelTitle.textContent = `第 ${lvl.id} 關：${lvl.title}`;
      if (this.modePill) {
        this.modePill.className = "phase-pill emerald";
        this.modePill.textContent = "🫧 關卡星圖模式";
      }
    } else {
      if (this.lblLevelTitle) this.lblLevelTitle.textContent = `無盡下壓狂潮`;
      if (this.modePill) {
        this.modePill.className = "phase-pill amber";
        this.modePill.textContent = "🚀 無盡下壓狂潮";
      }
    }

    if (this.lblScore) this.lblScore.textContent = this.score;
    if (this.lblCombo) this.lblCombo.textContent = this.comboStreak > 1 ? `x${this.comboStreak}` : "0";

    // 更新天花板下壓失誤次數指示點
    if (this.foulDots) {
      let dotsHtml = "";
      for (let i = 0; i < this.maxMisses; i++) {
        dotsHtml += `<span class="foul-dot ${i < this.missCount ? "active" : ""}"></span>`;
      }
      this.foulDots.innerHTML = dotsHtml;
    }
  }

  update(dt) {
    if (this.isGameOver || this.isVictory) return;

    if (this.cannon) this.cannon.update(dt);

    // 更新發射中的飛行泡泡
    if (this.isShooting && this.shootingBubble) {
      this.shootingBubble.update(dt, this.width);

      // 檢查是否碰到天花板或任何泡泡
      let collided = false;

      // A. 天花板判定
      if (this.shootingBubble.y - this.bubbleRadius <= 0) {
        collided = true;
      } else {
        // B. 與現有盤面泡泡碰撞檢測
        for (let r = 0; r < this.grid.rows; r++) {
          const maxCols = (r % 2 === 1) ? this.grid.cols - 1 : this.grid.cols;
          for (let c = 0; c < maxCols; c++) {
            if (this.grid.cells[r][c] !== null) {
              const pos = this.grid.getCellPos(r, c);
              const dist = Math.hypot(this.shootingBubble.x - pos.x, this.shootingBubble.y - pos.y);
              if (dist <= this.bubbleRadius * 1.8) {
                collided = true;
                break;
              }
            }
          }
          if (collided) break;
        }
      }

      if (collided) {
        // 尋找最近的可用六角網格吸附
        const snap = this.grid.snapToNearestCell(this.shootingBubble.x, this.shootingBubble.y);
        if (snap) {
          this.onBubbleSnap(snap, this.shootingBubble.color);
        } else {
          // 意外容錯：天花板強行卡位
          this.grid.cells[0][0] = { color: this.shootingBubble.color };
          this.isShooting = false;
          this.shootingBubble = null;
        }
      }
    }

    // 更新自由落體的懸空泡泡
    for (const fb of this.fallingBubbles) fb.update(dt, this.height);
    this.fallingBubbles = this.fallingBubbles.filter(fb => fb.alive);

    // 更新粒子
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 繪製底部死亡警戒線 (Danger Warning Line)
    const dangerY = this.radius + this.dangerRow * (this.grid ? this.grid.rowHeight : 35);
    ctx.save();
    ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(this.width, dangerY);
    ctx.stroke();

    ctx.fillStyle = "rgba(244, 63, 94, 0.7)";
    ctx.font = "bold 10px 'JetBrains Mono', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("DANGER LINE", this.width - 12, dangerY - 6);
    ctx.restore();

    // 2. 繪製盤面上的所有泡泡
    if (this.grid) {
      for (let r = 0; r < this.grid.rows; r++) {
        const maxCols = (r % 2 === 1) ? this.grid.cols - 1 : this.grid.cols;
        for (let c = 0; c < maxCols; c++) {
          const b = this.grid.cells[r][c];
          if (b) {
            const pos = this.grid.getCellPos(r, c);
            BubbleDrawer.drawBubble(ctx, pos.x, pos.y, this.bubbleRadius, b.color);
          }
        }
      }
    }

    // 3. 繪製雷射折射預測瞄準線
    this.drawAimTrajectory(ctx);

    // 4. 繪製砲台與裝載泡泡
    if (this.cannon) this.cannon.draw(ctx);

    // 5. 繪製發射中的拋射泡泡
    if (this.isShooting && this.shootingBubble) {
      this.shootingBubble.draw(ctx);
    }

    // 6. 繪製自由落體的脫落泡泡
    for (const fb of this.fallingBubbles) fb.draw(ctx);

    // 7. 繪製粒子特效
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
  window.bubbleGame = new BubbleShooterGame();
});
