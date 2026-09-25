/**
 * 《星際守望者：迷宮防線》主引擎與狀態控制 (Main Game Controller)
 */
class CyberDefenseGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 網格佈局 (22 欄 x 14 列，每格 48px)
    this.cols = 22;
    this.rows = 14;
    this.cellSize = 48;
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;

    // 核心系統
    this.pathfinding = new PathfindingSystem(this.cols, this.rows);
    this.commander = new Commander(
      this.cellSize * 4,
      Math.floor(this.rows / 2) * this.cellSize + this.cellSize / 2
    );

    // 遊戲狀態
    this.gold = 300;
    this.lives = 20;
    this.wave = 0;
    this.maxWaves = 15;
    this.score = 0;
    this.gameSpeed = 1;
    this.isPaused = false;
    this.isGameOver = false;
    this.isVictory = false;

    // 實體集合
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];

    // 波次生成狀態
    this.waveInProgress = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.85;

    // 建造與交互
    this.selectedBuildType = null; // 'pulse' | 'railgun' | 'emp' | 'missile'
    this.selectedTower = null;
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.mousePos = { x: 0, y: 0 };
    this.keysDown = {};

    // 裝飾動畫計時
    this.pulsePhase = 0;

    this.initDOM();
    this.initEvents();
    this.updateHUD();

    // 啟動主循環
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initDOM() {
    // HUD 元素快取
    this.goldLabel = document.getElementById("valGold");
    this.livesLabel = document.getElementById("valLives");
    this.waveLabel = document.getElementById("valWave");
    this.scoreLabel = document.getElementById("valScore");
    this.btnStartWave = document.getElementById("btnStartWave");
    this.toastEl = document.getElementById("alertToast");

    // 指揮官技能
    this.btnSkillEMP = document.getElementById("btnSkillEMP");
    this.btnSkillOrbital = document.getElementById("btnSkillOrbital");
    this.cdLabelEMP = document.getElementById("cdEMP");
    this.cdLabelOrbital = document.getElementById("cdOrbital");

    // 塔選單卡片
    this.towerCards = document.querySelectorAll(".tower-card");

    // 塔詳細面板
    this.inspectPanel = document.getElementById("inspectPanel");
    this.inspectName = document.getElementById("inspectName");
    this.inspectStats = document.getElementById("inspectStats");
    this.btnUpgrade = document.getElementById("btnUpgrade");
    this.btnSell = document.getElementById("btnSell");

    // 彈窗
    this.modalOverlay = document.getElementById("modalOverlay");
    this.modalTitle = document.getElementById("modalTitle");
    this.modalDesc = document.getElementById("modalDesc");
    this.modalFinalScore = document.getElementById("modalFinalScore");
    this.modalFinalWave = document.getElementById("modalFinalWave");
    this.btnModalRestart = document.getElementById("btnModalRestart");

    // 作戰指南說明彈窗
    this.helpModal = document.getElementById("helpModal");
    this.btnHelp = document.getElementById("btnHelp");
    this.btnCloseHelp = document.getElementById("btnCloseHelp");
    this.btnGotIt = document.getElementById("btnGotIt");
  }

  initEvents() {
    // 監聽鍵盤
    window.addEventListener("keydown", (e) => {
      this.keysDown[e.key.toLowerCase()] = true;

      // 快速造塔熱鍵 1-4
      if (e.key === "1") this.selectBuildType("pulse");
      if (e.key === "2") this.selectBuildType("railgun");
      if (e.key === "3") this.selectBuildType("emp");
      if (e.key === "4") this.selectBuildType("missile");

      // 技能熱鍵 Q, E
      if (e.key === "q" || e.key === "Q") this.triggerSkillEMP();
      if (e.key === "e" || e.key === "E") this.triggerSkillOrbital();

      // 空白鍵開始下一波
      if (e.code === "Space" && !this.waveInProgress && !this.isGameOver) {
        e.preventDefault();
        this.startNextWave();
      }

      // Escape 取消選取
      if (e.key === "Escape") {
        this.deselectAll();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown[e.key.toLowerCase()] = false;
    });

    // 畫布滑鼠事件
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;

      this.hoverCol = Math.floor(this.mousePos.x / this.cellSize);
      this.hoverRow = Math.floor(this.mousePos.y / this.cellSize);
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoverCol = -1;
      this.hoverRow = -1;
    });

    // 左鍵點擊：建造防禦塔 / 選取既有塔
    this.canvas.addEventListener("click", () => {
      audio.resume();

      if (this.hoverCol < 0 || this.hoverRow < 0) return;

      // 1. 若處於造塔模式
      if (this.selectedBuildType) {
        this.handleBuildTower(this.hoverCol, this.hoverRow);
        return;
      }

      // 2. 若點擊到已有防禦塔，選中檢視
      const clickedTower = this.towers.find(t => t.col === this.hoverCol && t.row === this.hoverRow);
      if (clickedTower) {
        this.selectTower(clickedTower);
      } else {
        this.deselectAll();
      }
    });

    // 右鍵點擊：命令指揮官機甲移動
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      audio.resume();
      this.commander.targetX = Math.max(16, Math.min(this.canvas.width - 16, this.mousePos.x));
      this.commander.targetY = Math.max(16, Math.min(this.canvas.height - 16, this.mousePos.y));

      // 點擊移動微特效
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.particles.push(new Particle(
          this.commander.targetX, this.commander.targetY, "#38bdf8",
          Math.cos(a) * 40, Math.sin(a) * 40, 0.25, 2
        ));
      }
    });

    // 建造欄點擊
    this.towerCards.forEach(card => {
      card.addEventListener("click", () => {
        const type = card.dataset.tower;
        if (this.selectedBuildType === type) {
          this.deselectAll();
        } else {
          this.selectBuildType(type);
        }
      });
    });

    // 塔升級與販售按鈕
    if (this.btnUpgrade) {
      this.btnUpgrade.addEventListener("click", () => {
        if (!this.selectedTower) return;
        if (this.gold >= this.selectedTower.upgradeCost) {
          this.gold -= this.selectedTower.upgradeCost;
          this.selectedTower.upgrade();
          this.updateHUD();
          this.showToast(`升級成功！等級已提升至 Lv.${this.selectedTower.level}`, "info");
        } else {
          audio.playError();
          this.showToast("晶體資源不足，無法升級！", "danger");
        }
      });
    }

    if (this.btnSell) {
      this.btnSell.addEventListener("click", () => {
        if (!this.selectedTower) return;
        this.gold += this.selectedTower.sellValue;
        this.pathfinding.setObstacle(this.selectedTower.col, this.selectedTower.row, false);
        this.towers = this.towers.filter(t => t !== this.selectedTower);
        this.recalculateAllEnemyPaths();
        audio.playBuild();
        this.showToast(`已折價回收防禦塔，獲得 +${this.selectedTower.sellValue} 晶體`, "info");
        this.deselectAll();
        this.updateHUD();
      });
    }

    // 指揮官技能按鈕
    if (this.btnSkillEMP) {
      this.btnSkillEMP.addEventListener("click", () => this.triggerSkillEMP());
    }
    if (this.btnSkillOrbital) {
      this.btnSkillOrbital.addEventListener("click", () => this.triggerSkillOrbital());
    }

    // 波次按鈕
    if (this.btnStartWave) {
      this.btnStartWave.addEventListener("click", () => this.startNextWave());
    }

    // 加速與音效控制
    const btnSpeed = document.getElementById("btnSpeed");
    if (btnSpeed) {
      btnSpeed.addEventListener("click", () => {
        this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
        btnSpeed.textContent = `⚡ 速度: ${this.gameSpeed}x`;
        btnSpeed.classList.toggle("active", this.gameSpeed === 2);
      });
    }

    const btnMute = document.getElementById("btnMute");
    if (btnMute) {
      btnMute.addEventListener("click", () => {
        const enabled = audio.toggleMute();
        btnMute.textContent = enabled ? "🔊 音效: 開" : "🔇 音效: 關";
        btnMute.classList.toggle("active", !enabled);
      });
    }

    // 重新開始
    if (this.btnModalRestart) {
      this.btnModalRestart.addEventListener("click", () => this.restartGame());
    }

    // 作戰指南說明彈窗開關事件
    if (this.btnHelp && this.helpModal) {
      this.btnHelp.addEventListener("click", () => {
        this.helpModal.classList.add("active");
      });
    }

    if (this.btnCloseHelp && this.helpModal) {
      this.btnCloseHelp.addEventListener("click", () => {
        this.helpModal.classList.remove("active");
      });
    }

    if (this.btnGotIt && this.helpModal) {
      this.btnGotIt.addEventListener("click", () => {
        this.helpModal.classList.remove("active");
      });
    }

    if (this.helpModal) {
      this.helpModal.addEventListener("click", (e) => {
        if (e.target === this.helpModal) {
          this.helpModal.classList.remove("active");
        }
      });
    }
  }

  selectBuildType(type) {
    this.selectedBuildType = type;
    this.selectedTower = null;
    this.towerCards.forEach(c => {
      c.classList.toggle("selected", c.dataset.tower === type);
    });
    if (this.inspectPanel) this.inspectPanel.style.display = "none";
  }

  selectTower(tower) {
    this.selectedTower = tower;
    this.selectedBuildType = null;
    this.towerCards.forEach(c => c.classList.remove("selected"));

    if (this.inspectPanel) {
      this.inspectPanel.style.display = "flex";
      this.inspectName.textContent = `${tower.name} (Lv.${tower.level})`;
      this.inspectStats.textContent = `傷害: ${tower.actualDamage} | 射程: ${tower.actualRange} | 射速: ${tower.fireRate}s`;
      this.btnUpgrade.textContent = tower.level < 3 ? `升級 (-${tower.upgradeCost}💎)` : "已達滿級";
      this.btnUpgrade.disabled = tower.level >= 3;
      this.btnSell.textContent = `出售 (+${tower.sellValue}💎)`;
    }
  }

  deselectAll() {
    this.selectedBuildType = null;
    this.selectedTower = null;
    this.towerCards.forEach(c => c.classList.remove("selected"));
    if (this.inspectPanel) this.inspectPanel.style.display = "none";
  }

  showToast(msg, type = "info") {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.className = `alert-toast show ${type}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.className = "alert-toast";
    }, 2800);
  }

  // 嘗試建造防禦塔（迷宮建造驗證）
  handleBuildTower(col, row) {
    const costMap = { pulse: 50, railgun: 120, emp: 80, missile: 150 };
    const cost = costMap[this.selectedBuildType] || 50;

    if (this.gold < cost) {
      audio.playError();
      this.showToast(`資源不足！建造需要 ${cost} 晶體。`, "danger");
      return;
    }

    // 檢查 A* 防堵死驗證
    const check = this.pathfinding.canBuildAt(col, row, this.enemies.filter(e => e.alive));
    if (!check.ok) {
      audio.playError();
      this.showToast(check.reason, "danger");
      return;
    }

    // 扣除晶體、設置路障
    this.gold -= cost;
    this.pathfinding.setObstacle(col, row, true);

    const newTower = new Tower(col, row, this.selectedBuildType, this.cellSize);
    this.towers.push(newTower);

    // 讓所有場上現存敵人更新尋路路線！
    this.recalculateAllEnemyPaths();

    audio.playBuild();
    this.updateHUD();

    // 建造完成微粒子
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.particles.push(new Particle(
        newTower.x, newTower.y, newTower.color,
        Math.cos(a) * 60, Math.sin(a) * 60, 0.35, 2.5
      ));
    }
  }

  recalculateAllEnemyPaths() {
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.updatePath();
      }
    }
  }

  // 指揮官技能觸發
  triggerSkillEMP() {
    if (this.commander.castEMP(this.enemies, this.particles)) {
      this.showToast("⚡ EMP 全局脈衝已觸發！機械敵軍已癱瘓！", "info");
    }
  }

  triggerSkillOrbital() {
    if (this.commander.castOrbital(this.mousePos.x, this.mousePos.y, this.enemies, this.particles)) {
      this.showToast("🚀 軌道精準轟炸已抵達指定座標！", "info");
    }
  }

  // 開始新波次
  startNextWave() {
    if (this.waveInProgress || this.isGameOver || this.isVictory) return;

    this.wave++;
    this.waveInProgress = true;
    audio.playWaveStart();

    // 提早開波獎勵 25 晶體
    this.gold += 25;
    this.showToast(`第 ${this.wave} 波機械軍團入侵！(提早迎戰獎勵 +25 晶體)`, "info");

    this.spawnQueue = this.generateWaveQueue(this.wave);
    this.spawnTimer = 0.5;

    this.updateHUD();
  }

  generateWaveQueue(wave) {
    const queue = [];
    if (wave === 1) {
      for (let i = 0; i < 8; i++) queue.push("scout");
    } else if (wave === 2) {
      for (let i = 0; i < 6; i++) queue.push("scout");
      for (let i = 0; i < 6; i++) queue.push("trooper");
    } else if (wave === 3) {
      for (let i = 0; i < 12; i++) queue.push("trooper");
      for (let i = 0; i < 4; i++) queue.push("scout");
    } else if (wave === 4) {
      for (let i = 0; i < 10; i++) queue.push("trooper");
      for (let i = 0; i < 3; i++) queue.push("mech");
    } else if (wave === 5) {
      // 第五波首領戰
      for (let i = 0; i < 8; i++) queue.push("scout");
      queue.push("boss");
      for (let i = 0; i < 4; i++) queue.push("mech");
    } else if (wave <= 9) {
      const count = 10 + wave * 2;
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        if (rand < 0.35) queue.push("scout");
        else if (rand < 0.75) queue.push("trooper");
        else queue.push("mech");
      }
    } else if (wave <= 14) {
      for (let i = 0; i < 12; i++) queue.push("scout");
      for (let i = 0; i < 12; i++) queue.push("trooper");
      for (let i = 0; i < 8; i++) queue.push("mech");
    } else {
      // 最終旗艦決戰
      for (let i = 0; i < 15; i++) queue.push("scout");
      queue.push("boss");
      for (let i = 0; i < 10; i++) queue.push("mech");
      queue.push("boss");
    }
    return queue;
  }

  updateHUD() {
    if (this.goldLabel) this.goldLabel.textContent = this.gold;
    if (this.livesLabel) this.livesLabel.textContent = this.lives;
    if (this.waveLabel) this.waveLabel.textContent = `${this.wave} / ${this.maxWaves}`;
    if (this.scoreLabel) this.scoreLabel.textContent = this.score;

    if (this.btnStartWave) {
      this.btnStartWave.disabled = this.waveInProgress || this.isGameOver || this.isVictory;
      this.btnStartWave.textContent = this.waveInProgress ? "戰鬥進行中..." : (this.wave === 0 ? "啟動第一波 ➔" : "呼叫下一波 ➔");
    }

    // 技能按鈕冷卻渲染
    if (this.btnSkillEMP) {
      const empCd = Math.ceil(this.commander.empCooldown);
      this.btnSkillEMP.disabled = empCd > 0;
      this.cdLabelEMP.textContent = empCd > 0 ? `(${empCd}s)` : "";
    }
    if (this.btnSkillOrbital) {
      const orbCd = Math.ceil(this.commander.orbitalCooldown);
      this.btnSkillOrbital.disabled = orbCd > 0;
      this.cdLabelOrbital.textContent = orbCd > 0 ? `(${orbCd}s)` : "";
    }

    if (this.selectedTower) {
      this.selectTower(this.selectedTower);
    }
  }

  restartGame() {
    this.gold = 300;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.isGameOver = false;
    this.isVictory = false;
    this.waveInProgress = false;
    this.spawnQueue = [];
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.pathfinding.resetGrid();
    this.commander.x = this.cellSize * 4;
    this.commander.y = Math.floor(this.rows / 2) * this.cellSize + this.cellSize / 2;
    this.commander.targetX = this.commander.x;
    this.commander.targetY = this.commander.y;
    this.deselectAll();
    this.modalOverlay.classList.remove("active");
    this.updateHUD();
  }

  // 主遊戲運算更新
  update(rawDt) {
    if (this.isGameOver || this.isVictory) return;

    const dt = Math.min(rawDt, 0.1) * this.gameSpeed;
    this.pulsePhase += dt * 3;

    // 鍵盤移動指揮官
    const moveStep = this.commander.speed * dt;
    let kx = 0;
    let ky = 0;
    if (this.keysDown["w"] || this.keysDown["arrowup"]) ky -= 1;
    if (this.keysDown["s"] || this.keysDown["arrowdown"]) ky += 1;
    if (this.keysDown["a"] || this.keysDown["arrowleft"]) kx -= 1;
    if (this.keysDown["d"] || this.keysDown["arrowright"]) kx += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      this.commander.x = Math.max(16, Math.min(this.canvas.width - 16, this.commander.x + (kx / len) * moveStep));
      this.commander.y = Math.max(16, Math.min(this.canvas.height - 16, this.commander.y + (ky / len) * moveStep));
      this.commander.targetX = this.commander.x;
      this.commander.targetY = this.commander.y;
    }

    // 更新指揮官
    this.commander.update(dt, this.enemies, this.projectiles, this.particles);

    // 處理敵人生成波次隊列
    if (this.waveInProgress && this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        const enemyType = this.spawnQueue.shift();
        this.enemies.push(new Enemy(enemyType, this.wave, this.pathfinding, this.cellSize));
      }
    }

    // 更新所有防禦塔
    for (const tower of this.towers) {
      tower.update(dt, this.enemies, this.projectiles, this.particles);
    }

    // 更新所有射彈
    for (const proj of this.projectiles) {
      proj.update(dt, this.enemies, this.particles);
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // 更新所有敵人
    for (const enemy of this.enemies) {
      enemy.update(dt, this.particles);
      if (enemy.reachedExit) {
        this.lives--;
        audio.playExplosion();
        this.showToast("⚠️ 基地能量核心遭敵軍滲透！扣除 1 點生命！", "danger");
        if (this.lives <= 0) {
          this.lives = 0;
          this.gameOver(false);
        }
      } else if (!enemy.alive && !enemy.reachedExit) {
        // 敵人被擊殺獲得獎金與分數
        this.gold += enemy.bounty;
        this.score += enemy.bounty * 10;
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);

    // 更新粒子特效
    for (const p of this.particles) {
      p.update(dt);
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // 檢查波次是否結束
    if (this.waveInProgress && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveInProgress = false;
      if (this.wave >= this.maxWaves) {
        this.gameOver(true);
      } else {
        this.showToast(`第 ${this.wave} 波完全肅清！準備迎接下一波！`, "info");
      }
    }

    this.updateHUD();
  }

  gameOver(isWin) {
    if (isWin) {
      this.isVictory = true;
      this.modalTitle.textContent = "🏆 基地守衛成功！";
      this.modalTitle.className = "modal-title victory";
      this.modalDesc.textContent = "指揮官！您成功構築了不可跨越的星際防線，徹底粉碎了侵略軍團的所有進攻！";
    } else {
      this.isGameOver = true;
      this.modalTitle.textContent = "💥 基地防線陷落！";
      this.modalTitle.className = "modal-title defeat";
      this.modalDesc.textContent = "能量核心已被敵軍徹底摧毀... 重整旗鼓，再次啟動防衛協議吧！";
    }

    this.modalFinalScore.textContent = this.score;
    this.modalFinalWave.textContent = `${this.wave} / ${this.maxWaves}`;
    this.modalOverlay.classList.add("active");
  }

  // 繪製畫布渲染
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. 繪製棋盤網格
    this.drawGrid(ctx);

    // 2. 繪製當前 A* 預覽動態路徑（亮藍色粒子流）
    this.drawPathGuide(ctx);

    // 3. 繪製防禦塔
    for (const tower of this.towers) {
      const isSelected = this.selectedTower === tower;
      tower.draw(ctx, isSelected);
    }

    // 4. 繪製敵人
    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    // 5. 繪製射彈
    for (const proj of this.projectiles) {
      proj.draw(ctx);
    }

    // 6. 繪製指揮官機甲
    this.commander.draw(ctx);

    // 7. 繪製粒子
    for (const p of this.particles) {
      p.draw(ctx);
    }

    // 8. 繪製懸浮造塔預覽（綠色合法 / 紅色堵死）
    if (this.selectedBuildType && this.hoverCol >= 0 && this.hoverRow >= 0) {
      this.drawBuildHoverPreview(ctx);
    }
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.lineWidth = 1;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.cellSize;
        const y = r * this.cellSize;

        ctx.strokeStyle = "rgba(56, 189, 248, 0.07)";
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      }
    }

    // 繪製入侵傳送門 (Entrance: Col 0, Mid Row)
    const startX = this.pathfinding.start.col * this.cellSize + this.cellSize / 2;
    const startY = this.pathfinding.start.row * this.cellSize + this.cellSize / 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#f43f5e";
    ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
    ctx.beginPath();
    ctx.arc(startX, startY, this.cellSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 繪製終點基地核心 (Exit: Col cols-1, Mid Row)
    const exitX = this.pathfinding.exit.col * this.cellSize + this.cellSize / 2;
    const exitY = this.pathfinding.exit.row * this.cellSize + this.cellSize / 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#06b6d4";
    ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
    ctx.beginPath();
    ctx.arc(exitX, exitY, this.cellSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // 繪製從入口到終點的動態尋路指引
  drawPathGuide(ctx) {
    const mainPath = this.pathfinding.findPath(this.pathfinding.start, this.pathfinding.exit);
    if (!mainPath || mainPath.length === 0) return;

    ctx.save();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    for (let i = 0; i < mainPath.length; i++) {
      const node = mainPath[i];
      const px = node.col * this.cellSize + this.cellSize / 2;
      const py = node.row * this.cellSize + this.cellSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 沿著路線漂浮的能量光斑
    const phase = (this.pulsePhase % 1);
    for (let i = 0; i < mainPath.length - 1; i += 2) {
      const curr = mainPath[i];
      const next = mainPath[i + 1] || curr;
      const curX = curr.col * this.cellSize + this.cellSize / 2;
      const curY = curr.row * this.cellSize + this.cellSize / 2;
      const nxtX = next.col * this.cellSize + this.cellSize / 2;
      const nxtY = next.row * this.cellSize + this.cellSize / 2;

      const px = curX + (nxtX - curX) * phase;
      const py = curY + (nxtY - curY) * phase;

      ctx.fillStyle = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 繪製懸浮建造預覽
  drawBuildHoverPreview(ctx) {
    const col = this.hoverCol;
    const row = this.hoverRow;
    const x = col * this.cellSize;
    const y = row * this.cellSize;
    const check = this.pathfinding.canBuildAt(col, row, this.enemies.filter(e => e.alive));

    ctx.save();
    if (check.ok) {
      // 合法放置：綠色高亮
      ctx.fillStyle = "rgba(52, 211, 153, 0.2)";
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, this.cellSize, this.cellSize);
      ctx.strokeRect(x, y, this.cellSize, this.cellSize);
    } else {
      // 違規或堵死：紅色警示
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, this.cellSize, this.cellSize);
      ctx.strokeRect(x, y, this.cellSize, this.cellSize);
    }
    ctx.restore();
  }

  loop(currentTime) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// 頁面載入完成後啟動遊戲
window.addEventListener("DOMContentLoaded", () => {
  window.gameInstance = new CyberDefenseGame();
});
