/**
 * 《引力回圈：重力幾何》主遊戲引擎 (Gravity Pulse Game Controller)
 * 負責物理循環、攝影機追蹤、關卡載入與無盡模式、預測軌跡演算、輸入監聽與 UI 互動
 */

class GravityPulseGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 遊戲模式："stage" (15 關卡挑戰) | "endless" (無盡深空跳躍)
    this.mode = "stage";
    this.currentLevelIndex = 0; // 0-indexed (0 ~ 14)

    // 遊戲實體
    this.probe = null;
    this.nodes = [];
    this.shards = [];
    this.obstacles = [];
    this.wormhole = null;
    this.particles = [];

    // 無限深空生成器
    this.endlessGen = new EndlessGenerator();
    this.endlessScore = 0;
    this.endlessBest = parseInt(localStorage.getItem("gp_endless_best") || "0", 10);

    // 關卡進度與星級
    this.levelStars = JSON.parse(localStorage.getItem("gp_level_stars") || "{}"); // { [levelId]: 1~3 }
    this.unlockedLevel = parseInt(localStorage.getItem("gp_unlocked_level") || "1", 10);

    // 視差深空星雲與幾何網格
    this.stars = [];
    this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // 遊戲狀態
    this.isPaused = false;
    this.isCleared = false;
    this.isFailed = false;
    this.failTimer = 0;

    this.initCanvasSize();
    this.initStarfield();
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
  }

  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.2
      });
    }
  }

  initDOM() {
    // 頂部 HUD 標籤
    this.lblLevelTitle = document.getElementById("lblLevelTitle");
    this.lblTip = document.getElementById("lblTip");
    this.statStars = document.getElementById("statStars");
    this.statLeaps = document.getElementById("statLeaps");
    this.valLeaps = document.getElementById("valLeaps");
    this.modePill = document.getElementById("modePill");
    this.alertToast = document.getElementById("alertToast");

    // 控制項按鈕
    this.btnLaunch = document.getElementById("btnLaunch");
    this.btnRetry = document.getElementById("btnRetry");
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
    this.victoryStars = document.getElementById("victoryStars");
    this.btnNextLevel = document.getElementById("btnNextLevel");

    this.updateHUD();
  }

  initEvents() {
    window.addEventListener("resize", () => {
      this.initCanvasSize();
    });

    // 點擊畫布或發射按鈕進行引力彈射
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.triggerLaunch();
    });

    if (this.btnLaunch) {
      this.btnLaunch.addEventListener("click", () => this.triggerLaunch());
    }

    if (this.btnRetry) {
      this.btnRetry.addEventListener("click", () => this.restartLevel());
    }

    // 鍵盤操作 (Space / Enter 彈射, R 重試)
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        this.triggerLaunch();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        this.restartLevel();
      }
    });

    // 音效靜音切換
    if (this.btnMute) {
      this.btnMute.addEventListener("click", () => {
        const muted = window.gravityAudio.toggleMute();
        this.btnMute.textContent = muted ? "🔇 音效: 關" : "🔊 音效: 開";
      });
    }

    // 模式切換 (關卡闖關 vs 無盡深空)
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

    // 關卡選擇彈窗
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

    // 下一關按鈕
    if (this.btnNextLevel) {
      this.btnNextLevel.addEventListener("click", () => {
        this.victoryModal.classList.remove("active");
        if (this.currentLevelIndex < window.GRAVITY_LEVELS.length - 1) {
          this.loadLevel(this.currentLevelIndex + 1);
        } else {
          this.showToast("🎉 恭喜破關全部 15 關！進入無盡深空模式！", "info");
          this.mode = "endless";
          this.startEndlessMode();
        }
      });
    }

    // 關閉點擊外部
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

  // 觸發切線引力彈射
  triggerLaunch() {
    if (this.isCleared || this.isFailed) return;
    if (this.probe && this.probe.state === "orbiting") {
      const ok = this.probe.launchFromNode();
      if (ok) {
        window.gravityAudio.playRelease();
        // 彈射衝擊粒子
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push(new Particle(this.probe.x, this.probe.y, "#00f0ff", Math.cos(a) * 80, Math.sin(a) * 80, 0.35, 2.5));
        }

        if (this.mode === "endless") {
          this.endlessScore++;
          if (this.endlessScore > this.endlessBest) {
            this.endlessBest = this.endlessScore;
            localStorage.setItem("gp_endless_best", this.endlessBest.toString());
          }
        }
        this.updateHUD();
      }
    }
  }

  loadLevel(index) {
    this.mode = "stage";
    this.currentLevelIndex = index;
    const data = window.GRAVITY_LEVELS[index];
    if (!data) return;

    this.isCleared = false;
    this.isFailed = false;
    this.failTimer = 0;
    this.particles = [];

    // 初始化天體節點
    this.nodes = data.nodes.map(cfg => new GravityNode(cfg));

    // 初始化星鑽
    this.shards = data.shards.map((s, idx) => new Shard(s.x, s.y, idx));

    // 初始化障礙物
    this.obstacles = (data.obstacles || []).map(o => new Obstacle(o));

    // 初始化躍遷蟲洞
    this.wormhole = data.wormhole ? new Wormhole(data.wormhole.x, data.wormhole.y) : null;

    // 起始引力節點與探測器
    const startNode = this.nodes[data.startNodeIndex || 0];
    this.probe = new Probe(startNode.x + startNode.orbitRadius, startNode.y);
    this.probe.captureByNode(startNode);

    // 攝影機直接置中起始天體
    this.camera.x = startNode.x - this.width / 2;
    this.camera.y = startNode.y - this.height / 2;

    this.showToast(`進入關卡 ${data.id}：${data.title}`, "info");
    this.updateHUD();
  }

  startEndlessMode() {
    this.mode = "endless";
    this.isCleared = false;
    this.isFailed = false;
    this.failTimer = 0;
    this.particles = [];
    this.endlessScore = 0;
    this.wormhole = null;

    this.endlessGen.reset();

    // 生成起始標準星
    const startNode = new GravityNode({
      x: 200,
      y: 320,
      type: "standard",
      orbitRadius: 55,
      captureRadius: 90,
      baseSpeed: 2.2,
      dir: 1
    });

    this.nodes = [startNode];
    this.shards = [];
    this.obstacles = [];

    // 預先生成前方 4 個節點
    for (let i = 0; i < 4; i++) {
      const generated = this.endlessGen.generateNextNode();
      this.nodes.push(generated.node);
      if (generated.shard) this.shards.push(generated.shard);
      if (generated.obstacle) this.obstacles.push(generated.obstacle);
    }

    this.probe = new Probe(startNode.x + startNode.orbitRadius, startNode.y);
    this.probe.captureByNode(startNode);

    this.camera.x = startNode.x - this.width / 2;
    this.camera.y = startNode.y - this.height / 2;

    this.showToast("🌌 進入無盡深空模式！挑戰最高跳躍極限！", "info");
    this.updateHUD();
  }

  restartLevel() {
    if (this.mode === "endless") {
      this.startEndlessMode();
    } else {
      this.loadLevel(this.currentLevelIndex);
    }
  }

  updateHUD() {
    if (this.mode === "stage") {
      const data = window.GRAVITY_LEVELS[this.currentLevelIndex];
      if (this.lblLevelTitle) this.lblLevelTitle.textContent = `第 ${data.id} 關：${data.title}`;
      if (this.lblTip) this.lblTip.textContent = data.tip || "";
      if (this.modePill) {
        this.modePill.className = "phase-pill emerald";
        this.modePill.textContent = "🪐 關卡挑戰模式";
      }

      // 顯示本關收集到的星鑽數
      const collectedCount = this.shards.filter(s => s.collected).length;
      if (this.statStars) {
        let str = "";
        for (let i = 0; i < 3; i++) {
          str += i < collectedCount ? "⭐" : "☆";
        }
        this.statStars.textContent = str;
      }
      if (this.valLeaps) this.valLeaps.textContent = this.probe ? this.probe.leaps : 0;
    } else {
      // 無盡模式
      if (this.lblLevelTitle) this.lblLevelTitle.textContent = `無盡深空 (最高：${this.endlessBest} 跳)`;
      if (this.lblTip) this.lblTip.textContent = "連續在動態生成的引力天體間接力躍遷，不可掉入虛空或撞擊障礙！";
      if (this.modePill) {
        this.modePill.className = "phase-pill amber";
        this.modePill.textContent = "🚀 無盡深空跳躍";
      }
      if (this.statStars) this.statStars.textContent = `最佳 ${this.endlessBest}`;
      if (this.valLeaps) this.valLeaps.textContent = this.endlessScore;
    }

    if (this.btnLaunch && this.probe) {
      this.btnLaunch.disabled = this.probe.state !== "orbiting";
    }
  }

  openLevelSelectModal() {
    if (!this.levelGrid) return;
    this.levelGrid.innerHTML = "";

    window.GRAVITY_LEVELS.forEach((lvl, idx) => {
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

  handleStageClear() {
    this.isCleared = true;
    const lvl = window.GRAVITY_LEVELS[this.currentLevelIndex];
    const collectedCount = this.shards.filter(s => s.collected).length;
    const starsEarned = Math.max(1, collectedCount); // 至少 1 星 (過關)，最高 3 星

    // 紀錄星級與解鎖下一關
    const prevStars = this.levelStars[lvl.id] || 0;
    if (starsEarned > prevStars) {
      this.levelStars[lvl.id] = starsEarned;
      localStorage.setItem("gp_level_stars", JSON.stringify(this.levelStars));
    }
    if (lvl.id >= this.unlockedLevel && this.unlockedLevel < window.GRAVITY_LEVELS.length) {
      this.unlockedLevel = lvl.id + 1;
      localStorage.setItem("gp_unlocked_level", this.unlockedLevel.toString());
    }

    // 彈窗結算
    if (this.victoryTitle) this.victoryTitle.textContent = `🏆 ${lvl.title} 躍遷成功！`;
    if (this.victoryStars) this.victoryStars.textContent = "⭐".repeat(starsEarned) + "☆".repeat(3 - starsEarned);
    if (this.victoryModal) this.victoryModal.classList.add("active");
  }

  update(dt) {
    if (this.isPaused) return;

    // 更新天體與衰變倒數
    for (const node of this.nodes) {
      const isOccupied = this.probe && this.probe.state === "orbiting" && this.probe.orbitNode === node;
      node.update(dt, isOccupied);

      if (node.isDecaying && isOccupied && node.timeLeft < 1.2 && Math.random() < 0.2) {
        window.gravityAudio.playDecayWarning();
      }
    }

    // 更新障礙物
    for (const obs of this.obstacles) obs.update(dt);

    // 更新星鑽
    for (const s of this.shards) s.update(dt);

    // 更新躍遷蟲洞
    if (this.wormhole) this.wormhole.update(dt);

    // 更新粒子
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    // 更新探測器
    if (this.probe) {
      this.probe.update(dt, this.nodes, this.obstacles, this.shards, this.wormhole, this.particles);

      // 檢查是否躍遷過關
      if (this.probe.state === "cleared" && !this.isCleared) {
        this.handleStageClear();
      }

      // 檢查是否死亡重試
      if (this.probe.state === "dead" && !this.isFailed) {
        this.isFailed = true;
        this.failTimer = 0;
      }

      // 自由滑翔太遠 (超出畫面可見深空外) 亦判定墜入虛空
      if (this.probe.state === "free") {
        const distFromCamera = Math.hypot(this.probe.x - (this.camera.x + this.width / 2), this.probe.y - (this.camera.y + this.height / 2));
        if (distFromCamera > 900 && !this.isFailed) {
          this.probe.die(this.particles);
          this.isFailed = true;
          this.failTimer = 0;
        }
      }

      // 平滑攝影機跟隨
      const targetCamX = this.probe.x - this.width / 2;
      const targetCamY = this.probe.y - this.height / 2;
      this.camera.x += (targetCamX - this.camera.x) * 4.5 * dt;
      this.camera.y += (targetCamY - this.camera.y) * 4.5 * dt;

      // 無盡模式下，探測器向前推進時動態增補前方的天體
      if (this.mode === "endless" && this.probe.x > this.endlessGen.currentX - 600) {
        const generated = this.endlessGen.generateNextNode();
        this.nodes.push(generated.node);
        if (generated.shard) this.shards.push(generated.shard);
        if (generated.obstacle) this.obstacles.push(generated.obstacle);

        // 移除身後過遠的舊天體以保證流暢 60FPS
        if (this.nodes.length > 10) this.nodes.shift();
      }
    }

    // 失敗重生倒數
    if (this.isFailed) {
      this.failTimer += dt;
      if (this.failTimer > 1.1) {
        this.restartLevel();
      }
    }

    this.updateHUD();
  }

  // 繪製動態引力預測軌跡 (Predictive Trajectory)
  drawPredictiveTrajectory(ctx) {
    if (!this.probe || this.probe.state !== "orbiting" || !this.probe.orbitNode) return;

    const node = this.probe.orbitNode;
    const speed = (node.currentSpeed || 2.4) * (node.orbitRadius || 55);
    const dir = node.dir;

    let simX = this.probe.x;
    let simY = this.probe.y;
    let simVx = -Math.sin(this.probe.orbitAngle) * speed * dir;
    let simVy = Math.cos(this.probe.orbitAngle) * speed * dir;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(simX, simY);

    const simDt = 0.035;
    for (let step = 0; step < 28; step++) {
      simX += simVx * simDt;
      simY += simVy * simDt;

      // 檢查是否會被前方任何天體捕獲
      let captured = false;
      for (const other of this.nodes) {
        if (other === node) continue;
        const d = Math.hypot(simX - other.x, simY - other.y);
        if (d <= other.captureRadius) {
          ctx.lineTo(simX, simY);
          captured = true;
          break;
        }
      }

      if (captured) break;
      ctx.lineTo(simX, simY);
    }

    ctx.stroke();
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // 套用攝影機平移視角
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. 繪製深空幾何網格 (Geometric Space Grid)
    const gridSize = 100;
    const startGridX = Math.floor(this.camera.x / gridSize) * gridSize;
    const startGridY = Math.floor(this.camera.y / gridSize) * gridSize;

    ctx.strokeStyle = "rgba(16, 185, 129, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startGridX; x < startGridX + this.width + gridSize; x += gridSize) {
      ctx.moveTo(x, startGridY);
      ctx.lineTo(x, startGridY + this.height + gridSize);
    }
    for (let y = startGridY; y < startGridY + this.height + gridSize; y += gridSize) {
      ctx.moveTo(startGridX, y);
      ctx.lineTo(startGridX + this.width + gridSize, y);
    }
    ctx.stroke();

    // 2. 視差深空星子
    for (const s of this.stars) {
      // 根據攝影機進行視差位移
      const drawX = (s.x - this.camera.x * 0.15) % 2000;
      const drawY = (s.y - this.camera.y * 0.15) % 1200;
      const finalX = drawX < 0 ? drawX + 2000 : drawX;
      const finalY = drawY < 0 ? drawY + 1200 : drawY;

      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(finalX + this.camera.x, finalY + this.camera.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 繪製預測切線軌跡虛線
    this.drawPredictiveTrajectory(ctx);

    // 4. 繪製所有引力節點天體
    for (const node of this.nodes) {
      const isOccupied = this.probe && this.probe.state === "orbiting" && this.probe.orbitNode === node;
      const probeAngle = isOccupied ? this.probe.orbitAngle : 0;
      node.draw(ctx, isOccupied, probeAngle);
    }

    // 5. 繪製障礙物
    for (const obs of this.obstacles) obs.draw(ctx);

    // 6. 繪製星鑽
    for (const s of this.shards) s.draw(ctx);

    // 7. 繪製躍遷蟲洞
    if (this.wormhole) this.wormhole.draw(ctx);

    // 8. 繪製探測器
    if (this.probe) this.probe.draw(ctx);

    // 9. 繪製粒子特效
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
  window.gravityGame = new GravityPulseGame();
});
