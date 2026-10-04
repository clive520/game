/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 遊戲主控制器 (Main Game Loop, Camera, Input, Lighting Compositing & HUD)
 */

(function () {
  'use strict';

  class ShadowMazeGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      // 關卡與難度
      this.currentLevel = 1;
      this.maxLevel = 3;

      // 實體與地圖
      this.maze = null;
      this.player = null;
      this.guards = [];
      this.keycard = null;
      this.batteries = [];
      this.exitGate = null;
      this.dustParticles = [];

      // 鏡頭 (平滑跟隨)
      this.camera = { x: 0, y: 0 };

      // 輸入狀態
      this.input = {
        moveX: 0,
        moveY: 0,
        shift: false,
        aimAngle: 0,
        mouseWorldX: 0,
        mouseWorldY: 0
      };
      this.keys = {};

      // 虛擬搖桿 (手機端)
      this.joystick = {
        active: false,
        identifier: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
      };

      // 心跳計時器
      this.heartbeatTimer = 0;

      // 離屏黑霧光影渲染畫布 (Fog of War Mask Canvas)
      this.fogCanvas = document.createElement('canvas');
      this.fogCtx = this.fogCanvas.getContext('2d');

      // 畫面長寬自適應
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // 綁定輸入與 UI
      this.bindControls();
      this.bindUI();

      // 初始化關卡
      this.loadLevel(this.currentLevel);

      // 啟動主循環
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    // 視窗畫布自適應
    resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);

      if (this.fogCanvas) {
        this.fogCanvas.width = this.canvas.width;
        this.fogCanvas.height = this.canvas.height;
        this.fogCtx.resetTransform();
        this.fogCtx.scale(dpr, dpr);
      }
    }

    // 載入特定關卡
    loadLevel(lvl) {
      this.currentLevel = lvl;

      // 依關卡難度設定迷宮大小與守衛數量
      let cols = 19;
      let rows = 19;
      let guardCount = 2;

      if (lvl === 2) {
        cols = 23;
        rows = 23;
        guardCount = 4;
      } else if (lvl === 3) {
        cols = 27;
        rows = 27;
        guardCount = 6;
      }

      this.maze = new MazeGenerator(cols, rows, 54);

      // 建立主角
      this.player = new Player(this.maze.spawnPoint.x, this.maze.spawnPoint.y);
      this.camera.x = this.player.x;
      this.camera.y = this.player.y;

      // 建立出口與鑰匙卡
      this.exitGate = new ExitGate(this.maze.exitPoint.x, this.maze.exitPoint.y);
      this.keycard = new ItemPickup(this.maze.keycardPoint.x, this.maze.keycardPoint.y, 'keycard');

      // 建立備用電池
      this.batteries = this.maze.batteryPoints.map(bp => new ItemPickup(bp.x, bp.y, 'battery'));

      // 建立巡邏守衛
      this.guards = [];
      const actualCount = Math.min(guardCount, this.maze.guardPatrols.length);
      for (let i = 0; i < actualCount; i++) {
        const patrol = this.maze.guardPatrols[i];
        this.guards.push(new Guard({
          x: patrol.spawn.x,
          y: patrol.spawn.y,
          waypoints: patrol.waypoints
        }));
      }

      // 生成環境浮游塵埃粒子
      this.dustParticles = [];
      for (let i = 0; i < 45; i++) {
        this.dustParticles.push({
          x: Math.random() * (this.maze.cols * this.maze.tileSize),
          y: Math.random() * (this.maze.rows * this.maze.tileSize),
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          alpha: Math.random() * 0.4 + 0.2
        });
      }

      this.updateHUD();
      this.showNotice(`🚨 第 ${this.currentLevel} 區：尋找【逃生門禁卡】並避開巡邏守衛！`);

      // 隱藏各類彈窗
      document.getElementById('modal-gameover')?.classList.add('hidden');
      document.getElementById('modal-levelclear')?.classList.add('hidden');
      document.getElementById('modal-victory')?.classList.add('hidden');
    }

    // 鍵盤與滑鼠/觸控事件
    bindControls() {
      // 鍵盤移動
      window.addEventListener('keydown', (e) => {
        this.keys[e.key.toLowerCase()] = true;
        if (e.key === ' ' || e.key.toLowerCase() === 'f') {
          // 切換手電筒
          this.toggleFlashlight();
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
      });

      // 滑鼠瞄準
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // 轉換為世界座標
        this.input.mouseWorldX = screenX - (this.width / 2) + this.camera.x;
        this.input.mouseWorldY = screenY - (this.height / 2) + this.camera.y;

        if (this.player) {
          this.input.aimAngle = Math.atan2(
            this.input.mouseWorldY - this.player.y,
            this.input.mouseWorldX - this.player.x
          );
        }
      });

      // 觸控支援 (手機雙拇指)
      this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (let t of e.changedTouches) {
          const rect = this.canvas.getBoundingClientRect();
          const tx = t.clientX - rect.left;
          const ty = t.clientY - rect.top;

          // 左半部觸控視為移動搖桿
          if (tx < this.width * 0.45 && !this.joystick.active) {
            this.joystick.active = true;
            this.joystick.identifier = t.identifier;
            this.joystick.startX = tx;
            this.joystick.startY = ty;
            this.joystick.currentX = tx;
            this.joystick.currentY = ty;
          } else {
            // 右半部觸控視為瞄準轉向
            const worldX = tx - (this.width / 2) + this.camera.x;
            const worldY = ty - (this.height / 2) + this.camera.y;
            this.input.aimAngle = Math.atan2(worldY - this.player.y, worldX - this.player.x);
          }
        }
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let t of e.changedTouches) {
          const rect = this.canvas.getBoundingClientRect();
          const tx = t.clientX - rect.left;
          const ty = t.clientY - rect.top;

          if (this.joystick.active && t.identifier === this.joystick.identifier) {
            this.joystick.currentX = tx;
            this.joystick.currentY = ty;
            const dx = tx - this.joystick.startX;
            const dy = ty - this.joystick.startY;
            const dist = Math.hypot(dx, dy);
            const maxDist = 45;

            if (dist > 5) {
              this.input.moveX = dx / Math.max(dist, maxDist);
              this.input.moveY = dy / Math.max(dist, maxDist);
            }
          } else {
            const worldX = tx - (this.width / 2) + this.camera.x;
            const worldY = ty - (this.height / 2) + this.camera.y;
            this.input.aimAngle = Math.atan2(worldY - this.player.y, worldX - this.player.x);
          }
        }
      }, { passive: false });

      const endTouch = (e) => {
        for (let t of e.changedTouches) {
          if (this.joystick.active && t.identifier === this.joystick.identifier) {
            this.joystick.active = false;
            this.joystick.identifier = null;
            this.input.moveX = 0;
            this.input.moveY = 0;
          }
        }
      };

      this.canvas.addEventListener('touchend', endTouch);
      this.canvas.addEventListener('touchcancel', endTouch);
    }

    // 綁定按鈕與彈窗 UI
    bindUI() {
      // 開關手電筒按鈕
      const btnFlashlight = document.getElementById('btn-flashlight-toggle');
      if (btnFlashlight) {
        btnFlashlight.addEventListener('click', () => this.toggleFlashlight());
      }

      // 疾跑按鈕 (手機)
      const btnSprint = document.getElementById('btn-sprint-toggle');
      if (btnSprint) {
        btnSprint.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.input.shift = true;
          btnSprint.classList.add('active');
        });
        btnSprint.addEventListener('touchend', () => {
          this.input.shift = false;
          btnSprint.classList.remove('active');
        });
        btnSprint.addEventListener('mousedown', () => {
          this.input.shift = true;
          btnSprint.classList.add('active');
        });
        window.addEventListener('mouseup', () => {
          this.input.shift = false;
          btnSprint.classList.remove('active');
        });
      }

      // 音效切換
      const btnSound = document.getElementById('btn-sound-toggle');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          if (window.mazeAudio) {
            const isMuted = window.mazeAudio.toggleMute();
            btnSound.textContent = isMuted ? '🔇 靜音' : '🔊 音效';
            btnSound.classList.toggle('muted', isMuted);
          }
        });
      }

      // 規則說明彈窗
      const btnHelp = document.getElementById('btn-help');
      const modalHelp = document.getElementById('modal-help');
      const btnCloseHelp = document.getElementById('btn-close-help');
      if (btnHelp && modalHelp && btnCloseHelp) {
        btnHelp.addEventListener('click', () => modalHelp.classList.remove('hidden'));
        btnCloseHelp.addEventListener('click', () => modalHelp.classList.add('hidden'));
      }

      // 重新開始
      const btnRetry = document.getElementById('btn-retry');
      if (btnRetry) {
        btnRetry.addEventListener('click', () => {
          this.loadLevel(this.currentLevel);
        });
      }

      // 下一關
      const btnNextLevel = document.getElementById('btn-next-level');
      if (btnNextLevel) {
        btnNextLevel.addEventListener('click', () => {
          document.getElementById('modal-levelclear')?.classList.add('hidden');
          if (this.currentLevel < this.maxLevel) {
            this.loadLevel(this.currentLevel + 1);
          } else {
            this.showVictoryModal();
          }
        });
      }

      // 通關重新遊玩
      const btnPlayAgain = document.getElementById('btn-play-again');
      if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', () => {
          document.getElementById('modal-victory')?.classList.add('hidden');
          this.loadLevel(1);
        });
      }
    }

    // 切換手電筒
    toggleFlashlight() {
      if (!this.player || this.player.battery <= 0) return;
      this.player.flashlightOn = !this.player.flashlightOn;
      if (window.mazeAudio) window.mazeAudio.playFlashlightClick();
      const btn = document.getElementById('btn-flashlight-toggle');
      if (btn) btn.classList.toggle('active', this.player.flashlightOn);
    }

    // 提示通知
    showNotice(text) {
      const el = document.getElementById('game-notice');
      if (el) el.textContent = text;
    }

    // 更新鍵盤輸入
    updateInput() {
      if (this.joystick.active) return; // 手機搖桿優先

      let mx = 0;
      let my = 0;

      if (this.keys['w'] || this.keys['arrowup']) my -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) my += 1;
      if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) mx += 1;

      this.input.moveX = mx;
      this.input.moveY = my;
      this.input.shift = !!this.keys['shift'];
    }

    // 更新抬頭顯示器
    updateHUD() {
      // 電量
      const elBattery = document.getElementById('hud-battery-fill');
      const elBatteryVal = document.getElementById('hud-battery-val');
      if (elBattery && this.player) {
        const pct = Math.max(0, Math.min(100, Math.round(this.player.battery)));
        elBattery.style.width = `${pct}%`;
        if (elBatteryVal) elBatteryVal.textContent = `${pct}%`;
        elBattery.style.background = pct < 20 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#22c55e';
      }

      // 耐力
      const elStamina = document.getElementById('hud-stamina-fill');
      if (elStamina && this.player) {
        const pct = Math.max(0, Math.min(100, Math.round(this.player.stamina)));
        elStamina.style.width = `${pct}%`;
      }

      // 關卡標籤
      const elLevel = document.getElementById('hud-level-label');
      if (elLevel) elLevel.textContent = `區域 B${this.currentLevel}`;

      // 任務目標提示
      const elObjective = document.getElementById('hud-objective-text');
      if (elObjective && this.player) {
        if (!this.player.hasKeycard) {
          elObjective.innerHTML = `🔍 尋找【逃生門禁卡】<span style="color:#fbbf24"> (未取得)</span>`;
        } else {
          elObjective.innerHTML = `🚨 門禁已解除！迅速逃往【逃生出口】！<span style="color:#22c55e"> (已取得)</span>`;
        }
      }
    }

    // 心跳與警戒警報音頻更新
    updateHeartbeat(dt) {
      if (!this.player || !this.player.alive) return;

      let nearestDist = Infinity;
      let isAnyChasing = false;

      for (const g of this.guards) {
        const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
        if (d < nearestDist) nearestDist = d;
        if (g.state === GuardState.CHASE) isAnyChasing = true;
      }

      // 依距離與追擊狀態動態調整心跳頻率
      let interval = 1.6;
      let intensity = 0.3;

      if (isAnyChasing) {
        interval = 0.42; // 急促狂跳
        intensity = 1.0;
      } else if (nearestDist < 260) {
        const factor = 1 - (nearestDist / 260);
        interval = 1.2 - factor * 0.6;
        intensity = 0.4 + factor * 0.4;
      }

      this.heartbeatTimer += dt;
      if (this.heartbeatTimer >= interval) {
        this.heartbeatTimer = 0;
        if (window.mazeAudio) {
          window.mazeAudio.triggerHeartbeat(intensity);
        }
      }

      // 當守衛追擊時，全螢幕邊緣閃爍紅光警示
      const borderWarning = document.getElementById('screen-alert-vignette');
      if (borderWarning) {
        borderWarning.classList.toggle('active', isAnyChasing);
      }
    }

    // 邏輯更新
    update(dt) {
      if (!this.player) return;

      this.updateInput();
      this.player.update(dt, this.input, this.maze);

      // 平滑鏡頭插值
      this.camera.x += (this.player.x - this.camera.x) * 0.12;
      this.camera.y += (this.player.y - this.camera.y) * 0.12;

      // 更新守衛
      for (const g of this.guards) {
        g.update(dt, this.player, this.maze);
      }

      // 更新可見性檢測 (※ 核心要求：守衛只有在被手電筒或微光照亮時，其本體才可被看見！)
      for (const g of this.guards) {
        g.isLitByPlayer = RaycastLighting.isTargetLitByFlashlight(
          this.player,
          g.x,
          g.y,
          this.maze.segments
        );
      }

      // 更新物品
      if (this.keycard) this.keycard.update(dt, this.player);
      for (const b of this.batteries) {
        b.update(dt, this.player);
      }

      // 更新出口
      if (this.exitGate) {
        this.exitGate.update(dt, this.player);
      }

      // 更新環境微粒
      for (const p of this.dustParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // 更新心跳
      this.updateHeartbeat(dt);

      // 更新 HUD
      this.updateHUD();

      // 勝敗判斷
      if (!this.player.alive) {
        document.getElementById('modal-gameover')?.classList.remove('hidden');
      } else if (this.player.escaped) {
        if (this.currentLevel < this.maxLevel) {
          document.getElementById('modal-levelclear')?.classList.remove('hidden');
        } else {
          document.getElementById('modal-victory')?.classList.remove('hidden');
        }
      }
    }

    // 繪製迷宮地磚與牆體
    drawWorld() {
      const S = this.maze.tileSize;
      const startCol = Math.max(0, Math.floor((this.camera.x - this.width / 2) / S) - 1);
      const endCol = Math.min(this.maze.cols, Math.ceil((this.camera.x + this.width / 2) / S) + 1);
      const startRow = Math.max(0, Math.floor((this.camera.y - this.height / 2) / S) - 1);
      const endRow = Math.min(this.maze.rows, Math.ceil((this.camera.y + this.height / 2) / S) + 1);

      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const x = c * S;
          const y = r * S;

          if (this.maze.grid[r][c] === 1) {
            // 金屬高科技迷宮厚牆
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x, y, S, S);

            ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);

            // 頂部導角亮線
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
          } else {
            // 水泥通道地磚
            ctx.fillStyle = '#181e29';
            ctx.fillRect(x, y, S, S);

            ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, S, S);
          }
        }
      }
    }

    // 畫面渲染主流程 (多層動態光影與黑霧遮罩)
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // ==========================================
      // 第一階段：計算光影可見多邊形 (Raycasting)
      // ==========================================
      // 手電筒錐形光束多邊形
      let conePoly = null;
      if (this.player.flashlightOn && !this.player.isFlickering && this.player.battery > 0) {
        conePoly = RaycastLighting.computeConeVisibilityPolygon(
          this.player.x,
          this.player.y,
          this.player.angle,
          this.player.flashlightFov,
          this.player.flashlightRange,
          this.maze.segments
        );
      }

      // 360 度近身微光多邊形 (約 50px 半徑)
      const radialPoly = RaycastLighting.computeRadialVisibilityPolygon(
        this.player.x,
        this.player.y,
        50,
        this.maze.segments
      );

      // ==========================================
      // 第二階段：底層世界渲染 (地磚、牆壁、道具、出口)
      // ==========================================
      ctx.save();
      ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);

      // 1. 繪製世界背景 (迷宮地磚與牆壁)
      const S = this.maze.tileSize;
      const startCol = Math.max(0, Math.floor((this.camera.x - this.width / 2) / S) - 1);
      const endCol = Math.min(this.maze.cols, Math.ceil((this.camera.x + this.width / 2) / S) + 1);
      const startRow = Math.max(0, Math.floor((this.camera.y - this.height / 2) / S) - 1);
      const endRow = Math.min(this.maze.rows, Math.ceil((this.camera.y + this.height / 2) / S) + 1);

      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const x = c * S;
          const y = r * S;
          if (this.maze.grid[r][c] === 1) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x, y, S, S);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
          } else {
            ctx.fillStyle = '#151922';
            ctx.fillRect(x, y, S, S);
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
            ctx.strokeRect(x, y, S, S);
          }
        }
      }

      // 2. 繪製出口閘門
      if (this.exitGate) {
        this.exitGate.draw(ctx, this.player.hasKeycard);
      }

      // 3. 繪製關鍵道具與電池
      if (this.keycard) {
        const isKeyLit = RaycastLighting.isTargetLitByFlashlight(this.player, this.keycard.x, this.keycard.y, this.maze.segments);
        this.keycard.draw(ctx, isKeyLit);
      }
      for (const b of this.batteries) {
        const isBatLit = RaycastLighting.isTargetLitByFlashlight(this.player, b.x, b.y, this.maze.segments);
        b.draw(ctx, isBatLit);
      }

      // 4. 繪製守衛投射在地面上的探照光錐 (在黑霧覆蓋前繪製)
      for (const g of this.guards) {
        g.drawVisionCone(ctx, this.maze.segments);
      }

      ctx.restore();

      // ==========================================
      // 第三階段：黑霧遮罩 (Fog of War Mask) 掏空受光區域
      // ==========================================
      if (this.fogCtx) {
        this.fogCtx.clearRect(0, 0, this.width, this.height);
        // 全螢幕沉浸黑霧 (未被照射的通道與牆壁隱沒於黑夜)
        this.fogCtx.fillStyle = 'rgba(3, 7, 18, 0.96)';
        this.fogCtx.fillRect(0, 0, this.width, this.height);

        this.fogCtx.save();
        this.fogCtx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);
        this.fogCtx.globalCompositeOperation = 'destination-out';

        // 掏空手電筒光束
        if (conePoly && conePoly.length > 2) {
          this.fogCtx.beginPath();
          this.fogCtx.moveTo(conePoly[0].x, conePoly[0].y);
          for (let i = 1; i < conePoly.length; i++) {
            this.fogCtx.lineTo(conePoly[i].x, conePoly[i].y);
          }
          this.fogCtx.closePath();

          const grad = this.fogCtx.createRadialGradient(
            this.player.x, this.player.y, 4,
            this.player.x, this.player.y, this.player.flashlightRange
          );
          grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
          grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.92)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
          this.fogCtx.fillStyle = grad;
          this.fogCtx.fill();
        }

        // 掏空主角身邊微光
        if (radialPoly && radialPoly.length > 2) {
          this.fogCtx.beginPath();
          this.fogCtx.moveTo(radialPoly[0].x, radialPoly[0].y);
          for (let i = 1; i < radialPoly.length; i++) {
            this.fogCtx.lineTo(radialPoly[i].x, radialPoly[i].y);
          }
          this.fogCtx.closePath();

          const radGrad = this.fogCtx.createRadialGradient(
            this.player.x, this.player.y, 2,
            this.player.x, this.player.y, 52
          );
          radGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
          radGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
          this.fogCtx.fillStyle = radGrad;
          this.fogCtx.fill();
        }

        // 掏空守衛的探照燈視野 (守衛的光柱也能照亮走廊黑霧)
        for (const g of this.guards) {
          const gPoly = RaycastLighting.computeConeVisibilityPolygon(
            g.x, g.y, g.angle, g.visionFov, g.visionRange, this.maze.segments
          );
          if (gPoly && gPoly.length > 2) {
            this.fogCtx.beginPath();
            this.fogCtx.moveTo(gPoly[0].x, gPoly[0].y);
            for (let i = 1; i < gPoly.length; i++) {
              this.fogCtx.lineTo(gPoly[i].x, gPoly[i].y);
            }
            this.fogCtx.closePath();
            this.fogCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.fogCtx.fill();
          }
        }

        this.fogCtx.restore();
        this.fogCtx.globalCompositeOperation = 'source-over';

        // 將黑霧遮罩疊加回主畫面
        ctx.drawImage(this.fogCanvas, 0, 0, this.width, this.height);
      }

      // ==========================================
      // 第四階段：頂層光束氛圍、角色實體與微粒渲染
      // ==========================================
      ctx.save();
      ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);

      // 1. 手電筒光束的金色溫暖氛圍光
      if (conePoly && conePoly.length > 2) {
        ctx.beginPath();
        ctx.moveTo(conePoly[0].x, conePoly[0].y);
        for (let i = 1; i < conePoly.length; i++) {
          ctx.lineTo(conePoly[i].x, conePoly[i].y);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(
          this.player.x, this.player.y, 4,
          this.player.x, this.player.y, this.player.flashlightRange
        );
        grad.addColorStop(0, 'rgba(255, 255, 240, 0.38)');
        grad.addColorStop(0.35, 'rgba(254, 240, 138, 0.22)');
        grad.addColorStop(0.75, 'rgba(253, 224, 71, 0.08)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // 2. 守衛實體 (※ 關鍵規則：只有被主角手電筒照亮時才會畫出本體！)
      for (const g of this.guards) {
        g.drawBody(ctx);
      }

      // 3. 主角本體
      this.player.draw(ctx);

      // 4. 手電筒光柱中的漂浮微塵
      ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
      for (const p of this.dustParticles) {
        if (RaycastLighting.isTargetLitByFlashlight(this.player, p.x, p.y, this.maze.segments)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // ==========================================
      // 第五階段：UI 互動層 (手機虛擬搖桿)
      // ==========================================
      if (this.joystick.active) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.joystick.startX, this.joystick.startY, 45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.beginPath();
        ctx.arc(this.joystick.currentX, this.joystick.currentY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 遊戲主循環
    gameLoop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  // 頁面載入啟動
  window.addEventListener('DOMContentLoaded', () => {
    window.mazeAudio = new MazeAudioSystem();
    window.shadowMazeGame = new ShadowMazeGame();
  });
})();
