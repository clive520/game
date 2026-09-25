/**
 * 《法式滾球：普羅旺斯大師》(Pétanque: Provence Masters)
 * 遊戲主邏輯控制器 (Game Engine, Turn State Machine, AI & Interaction)
 */

(function () {
  'use strict';

  // 遊戲狀態常數
  const GameState = {
    WAITING_JACK: 'WAITING_JACK',     // 等待擲出目標小木球
    PLAYING_JACK: 'PLAYING_JACK',     // 目標小木球飛行/滾動中
    WAITING_BOULE: 'WAITING_BOULE',   // 輪到球員瞄準投球
    PLAYING_BOULE: 'PLAYING_BOULE',   // 鐵球飛行/滾動中
    ROUND_OVER: 'ROUND_OVER',         // 本輪 (Mène) 結束結算
    MATCH_OVER: 'MATCH_OVER'          // 整場比賽結束
  };

  // 投球模式
  const ThrowMode = {
    POINT: 'POINT', // 指球 (貼地長滾，精準靠攏)
    SHOOT: 'SHOOT'  // 擊球 (高弧度高拋，砸擊對手球)
  };

  class PetanqueGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      // 虛擬畫布高解析邏輯座標 (寬 540 x 高 820)
      this.logicalWidth = 540;
      this.logicalHeight = 820;
      this.arenaBounds = {
        minX: 28,
        maxX: 512,
        minY: 40,
        maxY: 780
      };

      // 擲球圈位置 (起點位於底部中央)
      this.throwCircle = {
        x: this.logicalWidth / 2,
        y: 730,
        radius: 34
      };

      // 目標球允許停留的有效區間 (距離起點約 6~10 米)
      this.jackValidZone = {
        minY: 140,
        maxY: 460
      };

      // 實體儲存
      this.cochonnet = null; // 目標小木球
      this.boules = [];      // 場上所有金屬鐵球
      this.particles = [];   // 沙塵與火花

      // 比賽計分與局數 (每隊 3 顆鐵球，獲勝目標 7 分)
      this.maxScore = 7;
      this.scoreBlue = 0;
      this.scoreRed = 0;
      this.roundNumber = 1;
      this.blueRemaining = 3;
      this.redRemaining = 3;

      // 當前輪次狀態
      this.state = GameState.WAITING_JACK;
      this.currentTurn = 'blue'; // 'blue' (玩家) 或 'red' (對手/AI)
      this.starterTeam = 'blue';  // 擲木球的隊伍
      this.throwMode = ThrowMode.POINT;
      this.vsAi = true;          // 單人對抗 AI (普羅旺斯老爹 Pierre)
      this.showTape = true;      // 是否顯示皮尺測量
      this.aiThinking = false;

      // 拖曳瞄準操作
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.dragCurrent = { x: 0, y: 0 };

      // 碎石地面紋理快取
      this.gravelBgCanvas = null;

      // 動畫幀循環計時
      this.lastTime = performance.now();

      this.initCanvasSize();
      this.generateGravelTexture();
      this.bindEvents();
      this.bindUI();

      // 開始新一局
      this.startNewMatch();

      requestAnimationFrame((t) => this.gameLoop(t));
    }

    // 畫布自適應縮放
    initCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width || this.logicalWidth;
      const h = rect.height || this.logicalHeight;

      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.resetTransform();
      this.ctx.scale((w * dpr) / this.logicalWidth, (h * dpr) / this.logicalHeight);
    }

    // 生成普羅旺斯陽光碎石紅土地紋理
    generateGravelTexture() {
      const bg = document.createElement('canvas');
      bg.width = this.logicalWidth;
      bg.height = this.logicalHeight;
      const bctx = bg.getContext('2d');

      // 1. 底層紅褐赭石漸層 (Sun-drenched Ochre & Terracotta)
      const grad = bctx.createLinearGradient(0, 0, 0, this.logicalHeight);
      grad.addColorStop(0, '#c28859');
      grad.addColorStop(0.5, '#b47746');
      grad.addColorStop(1, '#9f6032');
      bctx.fillStyle = grad;
      bctx.fillRect(0, 0, bg.width, bg.height);

      // 2. 模擬成千上萬顆自然碎石微粒與泥沙雜色
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * bg.width;
        const y = Math.random() * bg.height;
        const size = Math.random() * 2.2 + 0.6;
        const shade = Math.random();

        if (shade > 0.65) {
          bctx.fillStyle = `rgba(255, 235, 205, ${Math.random() * 0.25})`;
        } else if (shade > 0.3) {
          bctx.fillStyle = `rgba(80, 40, 20, ${Math.random() * 0.35})`;
        } else {
          bctx.fillStyle = `rgba(180, 120, 80, ${Math.random() * 0.4})`;
        }

        bctx.beginPath();
        bctx.arc(x, y, size, 0, Math.PI * 2);
        bctx.fill();
      }

      this.gravelBgCanvas = bg;
    }

    // 事件監聽綁定
    bindEvents() {
      window.addEventListener('resize', () => this.initCanvasSize());

      const getPointerPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: ((clientX - rect.left) / rect.width) * this.logicalWidth,
          y: ((clientY - rect.top) / rect.height) * this.logicalHeight
        };
      };

      const startAim = (e) => {
        if (this.state !== GameState.WAITING_JACK && this.state !== GameState.WAITING_BOULE) return;
        if (this.vsAi && this.currentTurn === 'red') return; // AI 回合不接收玩家輸入

        const pos = getPointerPos(e);
        // 只能從下半部或擲球圈附近發起拉力
        if (pos.y < 500) return;

        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;

        if (window.petanqueAudio) {
          window.petanqueAudio.resume();
        }
      };

      const moveAim = (e) => {
        if (!this.isDragging) return;
        this.dragCurrent = getPointerPos(e);
      };

      const endAim = () => {
        if (!this.isDragging) return;
        this.isDragging = false;

        const dx = this.dragStart.x - this.dragCurrent.x;
        const dy = this.dragStart.y - this.dragCurrent.y;
        const pullDist = Math.hypot(dx, dy);

        // 防誤觸 (拖曳距離太短視為無效)
        if (pullDist < 18) return;

        // 計算投擲力道與角度
        // 拉力向後拉，反向射出 (Sling 控制)；若使用者往前推，則取向前方向
        let vx, vy;
        if (dy < -10) {
          // 向後拉：反作用力向上發射
          vx = -dx * 4.2;
          vy = -dy * 4.4;
        } else {
          // 往前推：直接順著方向發射
          vx = (this.dragCurrent.x - this.dragStart.x) * 4.2;
          vy = (this.dragCurrent.y - this.dragStart.y) * 4.4;
        }

        // 力道上限限制
        const speed = Math.hypot(vx, vy);
        const maxSpeed = 820;
        if (speed > maxSpeed) {
          vx = (vx / speed) * maxSpeed;
          vy = (vy / speed) * maxSpeed;
        }

        // 確保向上投出
        if (vy > -80) vy = -80;

        this.executeThrow(vx, vy);
      };

      this.canvas.addEventListener('mousedown', startAim);
      window.addEventListener('mousemove', moveAim);
      window.addEventListener('mouseup', endAim);

      this.canvas.addEventListener('touchstart', startAim, { passive: false });
      window.addEventListener('touchmove', moveAim, { passive: false });
      window.addEventListener('touchend', endAim);
    }

    // 介面按鈕綁定
    bindUI() {
      // 投球模式切換
      const btnPoint = document.getElementById('btn-mode-point');
      const btnShoot = document.getElementById('btn-mode-shoot');
      if (btnPoint && btnShoot) {
        btnPoint.addEventListener('click', () => {
          this.throwMode = ThrowMode.POINT;
          btnPoint.classList.add('active');
          btnShoot.classList.remove('active');
          if (window.petanqueAudio) window.petanqueAudio.playWhoosh();
        });
        btnShoot.addEventListener('click', () => {
          this.throwMode = ThrowMode.SHOOT;
          btnShoot.classList.add('active');
          btnPoint.classList.remove('active');
          if (window.petanqueAudio) window.petanqueAudio.playWhoosh();
        });
      }

      // 音效切換
      const btnMute = document.getElementById('btn-sound-toggle');
      if (btnMute) {
        btnMute.addEventListener('click', () => {
          if (window.petanqueAudio) {
            const isMuted = window.petanqueAudio.toggleMute();
            btnMute.textContent = isMuted ? '🔇 靜音' : '🔊 音效';
            btnMute.classList.toggle('muted', isMuted);
          }
        });
      }

      // 皮尺切換
      const btnTape = document.getElementById('btn-tape-toggle');
      if (btnTape) {
        btnTape.addEventListener('click', () => {
          this.showTape = !this.showTape;
          btnTape.classList.toggle('active', this.showTape);
        });
      }

      // 遊戲模式切換 (單人 vs 雙人同機)
      const btnModeToggle = document.getElementById('btn-mode-toggle');
      if (btnModeToggle) {
        btnModeToggle.addEventListener('click', () => {
          this.vsAi = !this.vsAi;
          btnModeToggle.textContent = this.vsAi ? '👤 單人 vs 大師' : '👥 雙人輪流投';
          this.showNotice(this.vsAi ? '切換為【單人對抗法式大師】' : '切換為【雙人同機對決】');
          this.updateHUD();
        });
      }

      // 規則說明彈窗
      const btnHelp = document.getElementById('btn-help');
      const modalHelp = document.getElementById('help-modal');
      const btnCloseHelp = document.getElementById('btn-close-help');
      if (btnHelp && modalHelp && btnCloseHelp) {
        btnHelp.addEventListener('click', () => modalHelp.classList.remove('hidden'));
        btnCloseHelp.addEventListener('click', () => modalHelp.classList.add('hidden'));
      }

      // 重開本局/重啟比賽按鈕
      const btnRestart = document.getElementById('btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          this.startNewMatch();
        });
      }

      // 結算彈窗下一步按鈕
      const btnNextRound = document.getElementById('btn-next-round');
      if (btnNextRound) {
        btnNextRound.addEventListener('click', () => {
          document.getElementById('round-modal').classList.add('hidden');
          if (this.scoreBlue >= this.maxScore || this.scoreRed >= this.maxScore) {
            this.showMatchEndModal();
          } else {
            this.startNewRound();
          }
        });
      }

      const btnMatchPlayAgain = document.getElementById('btn-match-play-again');
      if (btnMatchPlayAgain) {
        btnMatchPlayAgain.addEventListener('click', () => {
          document.getElementById('match-modal').classList.add('hidden');
          this.startNewMatch();
        });
      }
    }

    // 啟動一場全新比賽
    startNewMatch() {
      this.scoreBlue = 0;
      this.scoreRed = 0;
      this.roundNumber = 1;
      this.starterTeam = 'blue';
      document.getElementById('match-modal')?.classList.add('hidden');
      document.getElementById('round-modal')?.classList.add('hidden');
      this.startNewRound();
    }

    // 啟動新一輪 (Mène)
    startNewRound() {
      this.cochonnet = null;
      this.boules = [];
      this.particles = [];
      this.blueRemaining = 3;
      this.redRemaining = 3;
      this.currentTurn = this.starterTeam;
      this.state = GameState.WAITING_JACK;
      this.aiThinking = false;

      this.updateHUD();
      this.showNotice(
        this.currentTurn === 'blue'
          ? '👉 請藍隊投出目標小木球 (Cochonnet)'
          : '👉 請紅隊投出目標小木球 (Cochonnet)'
      );

      // 若是 AI 擲木球，啟動 AI 流程
      if (this.vsAi && this.currentTurn === 'red') {
        this.scheduleAiTurn();
      }
    }

    // 執行投擲
    executeThrow(vx, vy) {
      if (window.petanqueAudio) window.petanqueAudio.playWhoosh();

      if (this.state === GameState.WAITING_JACK) {
        // 投擲目標小木球 (木球通常地滾)
        this.cochonnet = new Boule({
          team: 'jack',
          x: this.throwCircle.x,
          y: this.throwCircle.y,
          z: 0,
          vx: vx * 0.72,
          vy: vy * 0.72,
          vz: 0
        });
        this.state = GameState.PLAYING_JACK;
        this.updateHUD();
      } else if (this.state === GameState.WAITING_BOULE) {
        // 投擲金屬鐵球
        const isBlue = this.currentTurn === 'blue';
        let vz = 0;

        if (this.throwMode === ThrowMode.SHOOT) {
          // 擊球高拋模式：給予垂直初速度，水平初速微調
          vz = Math.min(420, Math.hypot(vx, vy) * 0.75);
          vx *= 0.85;
          vy *= 0.85;
        }

        const boule = new Boule({
          team: this.currentTurn,
          x: this.throwCircle.x,
          y: this.throwCircle.y,
          z: vz > 0 ? 8 : 0,
          vx: vx,
          vy: vy,
          vz: vz
        });

        this.boules.push(boule);

        if (isBlue) {
          this.blueRemaining--;
        } else {
          this.redRemaining--;
        }

        this.state = GameState.PLAYING_BOULE;
        this.updateHUD();
      }
    }

    // AI 智慧決策投擲 (普羅旺斯老爹 Pierre)
    scheduleAiTurn() {
      if (this.aiThinking) return;
      this.aiThinking = true;

      const thinkingMsg = document.getElementById('ai-status');
      if (thinkingMsg) thinkingMsg.textContent = '老爹 Pierre 正在觀察球局...';

      const delay = 1100 + Math.random() * 500;
      setTimeout(() => {
        if (this.state === GameState.WAITING_JACK) {
          // AI 投擲小木球：目標投在 Y: 220 ~ 360 間
          const targetY = 240 + Math.random() * 120;
          const targetX = this.logicalWidth / 2 + (Math.random() - 0.5) * 80;
          const dist = this.throwCircle.y - targetY;
          const vy = -dist * 1.55;
          const vx = (targetX - this.throwCircle.x) * 1.5;
          this.executeThrow(vx, vy);
        } else if (this.state === GameState.WAITING_BOULE) {
          // AI 投擲鐵球：依情勢決定 指球 (Point) 或 擊球 (Shoot/Tir)
          const targetJack = this.cochonnet;
          const best = this.getBestBoule();

          // 如果藍隊持有得分球且離小木球極近 (< 45px)，AI 有 55% 機率嘗試高拋擊球 (Carreau)
          const shouldShoot = (best && best.team === 'blue' && Math.hypot(best.x - targetJack.x, best.y - targetJack.y) < 55 && Math.random() < 0.55);

          if (shouldShoot) {
            this.throwMode = ThrowMode.SHOOT;
            // 瞄準藍隊的最佳球
            const targetX = best.x + (Math.random() - 0.5) * 12;
            const targetY = best.y + (Math.random() - 0.5) * 12;
            const dist = this.throwCircle.y - targetY;
            const vy = -dist * 1.45;
            const vx = (targetX - this.throwCircle.x) * 1.4;
            this.executeThrow(vx, vy);
          } else {
            this.throwMode = ThrowMode.POINT;
            // 指球：精準滾向目標小木球
            const targetX = targetJack.x + (Math.random() - 0.5) * 16;
            const targetY = targetJack.y + (Math.random() - 0.5) * 20;
            const dist = this.throwCircle.y - targetY;
            const vy = -dist * 1.48;
            const vx = (targetX - this.throwCircle.x) * 1.45;
            this.executeThrow(vx, vy);
          }
        }

        this.aiThinking = false;
        if (thinkingMsg) thinkingMsg.textContent = '';
      }, delay);
    }

    // 計算目前場上最接近小木球的球 (Best boule)
    getBestBoule() {
      if (!this.cochonnet || this.boules.length === 0) return null;
      let best = null;
      let minDist = Infinity;

      for (const b of this.boules) {
        const d = Math.hypot(b.x - this.cochonnet.x, b.y - this.cochonnet.y);
        if (d < minDist) {
          minDist = d;
          best = b;
        }
      }
      return best;
    }

    // 檢查場上所有球體是否均已停止移動
    areAllBallsStopped() {
      if (this.cochonnet && !this.cochonnet.isStopped) return false;
      for (const b of this.boules) {
        if (!b.isStopped) return false;
      }
      return true;
    }

    // 實體與物理更新
    update(dt) {
      // 1. 更新小木球
      if (this.cochonnet) {
        BallPhysics.updateBall(this.cochonnet, dt, this.arenaBounds);
      }

      // 2. 更新所有金屬球
      for (const b of this.boules) {
        BallPhysics.updateBall(b, dt, this.arenaBounds);
      }

      // 3. 多體碰撞檢測 (包含小木球)
      const allBalls = [];
      if (this.cochonnet) allBalls.push(this.cochonnet);
      allBalls.push(...this.boules);

      BallPhysics.resolveCollisions(allBalls, (b1, b2, intensity, isCarreau) => {
        // 生成碰撞火花粒子
        const midX = (b1.x + b2.x) / 2;
        const midY = (b1.y + b2.y) / 2;
        const count = isCarreau ? 16 : 8;

        for (let p = 0; p < count; p++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 120 + 40;
          this.particles.push(new PetanqueParticle(
            midX,
            midY,
            isCarreau ? '#fef08a' : '#f97316',
            Math.cos(angle) * spd,
            Math.sin(angle) * spd,
            0.35,
            Math.random() * 3.5 + 1.5
          ));
        }

        // 若達成 Carreau (原地定桿替換)，顯示喝采飄字！
        if (isCarreau) {
          this.particles.push(new PetanqueParticle(
            midX,
            midY - 20,
            '#fbbf24',
            0,
            -35,
            0.9,
            18,
            '💥 CARREAU!'
          ));
        }
      });

      // 4. 更新粒子系統
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dt);
        if (this.particles[i].life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // 5. 輪次狀態切換檢定
      if (this.state === GameState.PLAYING_JACK) {
        if (this.cochonnet && this.cochonnet.isStopped) {
          // 檢驗小木球是否停留在有效區間內
          if (this.cochonnet.y < this.jackValidZone.minY || this.cochonnet.y > this.jackValidZone.maxY) {
            this.showNotice('⚠️ 小木球出界或距離不合規，重新擲出！');
            this.cochonnet = null;
            this.state = GameState.WAITING_JACK;
            if (this.vsAi && this.currentTurn === 'red') {
              this.scheduleAiTurn();
            }
          } else {
            // 木球就位，開始由擲出木球的隊伍投第一顆鐵球
            this.state = GameState.WAITING_BOULE;
            this.showNotice(`🎯 小木球就位！輪到 ${this.currentTurn === 'blue' ? '藍隊' : '紅隊'} 投出第 1 顆鐵球`);
            this.updateHUD();
            if (this.vsAi && this.currentTurn === 'red') {
              this.scheduleAiTurn();
            }
          }
        }
      } else if (this.state === GameState.PLAYING_BOULE) {
        if (this.areAllBallsStopped()) {
          this.resolveNextTurn();
        }
      }
    }

    // 核心法式滾球輪替邏輯 (Official Pétanque Turn Rules)
    resolveNextTurn() {
      // 若雙方均無球可用，本輪結束
      if (this.blueRemaining === 0 && this.redRemaining === 0) {
        this.concludeRound();
        return;
      }

      // 若其中一隊球已投完，由另一隊投完剩下所有球
      if (this.blueRemaining === 0) {
        this.currentTurn = 'red';
      } else if (this.redRemaining === 0) {
        this.currentTurn = 'blue';
      } else {
        // 雙方都有球：場上離小木球「較遠」的隊伍必須投球 (奪回點數或迫使對手耗球)
        const best = this.getBestBoule();
        if (best) {
          // 最佳球是藍隊，則輪到紅隊投球；反之亦然
          this.currentTurn = (best.team === 'blue') ? 'red' : 'blue';
        }
      }

      this.state = GameState.WAITING_BOULE;
      this.updateHUD();

      const teamName = this.currentTurn === 'blue' ? '藍隊 (你)' : (this.vsAi ? '老爹 Pierre' : '紅隊');
      this.showNotice(`👉 輪到 ${teamName} 投球！`);

      if (this.vsAi && this.currentTurn === 'red') {
        this.scheduleAiTurn();
      }
    }

    // 本輪 (Mène) 結算得分
    concludeRound() {
      this.state = GameState.ROUND_OVER;
      const best = this.getBestBoule();

      if (!best || !this.cochonnet) {
        this.showNotice('本輪流局，雙方均未得分！');
        return;
      }

      const winningTeam = best.team;
      const otherTeam = (winningTeam === 'blue') ? 'red' : 'blue';

      // 尋找敗隊最靠近小木球的那顆球的距離
      let closestOpponentDist = Infinity;
      for (const b of this.boules) {
        if (b.team === otherTeam) {
          const d = Math.hypot(b.x - this.cochonnet.x, b.y - this.cochonnet.y);
          if (d < closestOpponentDist) closestOpponentDist = d;
        }
      }

      // 計算勝隊有幾顆球比敗隊最接近的球更靠攏
      let pointsScored = 0;
      for (const b of this.boules) {
        if (b.team === winningTeam) {
          const d = Math.hypot(b.x - this.cochonnet.x, b.y - this.cochonnet.y);
          if (d < closestOpponentDist) {
            pointsScored++;
          }
        }
      }

      // 加分與下局開球權歸本局勝隊
      if (winningTeam === 'blue') {
        this.scoreBlue += pointsScored;
        this.starterTeam = 'blue';
      } else {
        this.scoreRed += pointsScored;
        this.starterTeam = 'red';
      }

      if (window.petanqueAudio) {
        if (winningTeam === 'blue') {
          window.petanqueAudio.playCheer();
        } else {
          window.petanqueAudio.playLanding();
        }
      }

      this.updateHUD();
      this.showRoundEndModal(winningTeam, pointsScored);
    }

    // 顯示本輪結算彈窗
    showRoundEndModal(winner, points) {
      const modal = document.getElementById('round-modal');
      const title = document.getElementById('round-modal-title');
      const text = document.getElementById('round-modal-text');
      const scoreDisp = document.getElementById('round-modal-score');

      if (modal && title && text && scoreDisp) {
        const isBlueWin = (winner === 'blue');
        title.textContent = isBlueWin ? '🎉 藍隊 贏得本輪！' : '🥖 紅隊 贏得本輪！';
        title.style.color = isBlueWin ? '#38bdf8' : '#f43f5e';
        text.textContent = `共 ${points} 顆滾球比對手更靠近小木球，獲得 +${points} 分！`;
        scoreDisp.textContent = `目前總比分：藍隊 ${this.scoreBlue} - ${this.scoreRed} 紅隊`;
        modal.classList.remove('hidden');
      }
    }

    // 顯示全場結束彈窗
    showMatchEndModal() {
      this.state = GameState.MATCH_OVER;
      const modal = document.getElementById('match-modal');
      const title = document.getElementById('match-modal-title');
      const text = document.getElementById('match-modal-text');

      const isBlueChamp = (this.scoreBlue >= this.maxScore);

      if (window.petanqueAudio) {
        if (isBlueChamp) window.petanqueAudio.playFanfare();
      }

      if (modal && title && text) {
        title.textContent = isBlueChamp ? '🏆 榮膺普羅旺斯滾球大師！' : '🥖 惜敗！去向老爹 Pierre 討杯茴香酒吧！';
        title.style.color = isBlueChamp ? '#fbbf24' : '#f43f5e';
        text.textContent = `終場比分：藍隊 ${this.scoreBlue} - ${this.scoreRed} 紅隊 (獲勝門檻: ${this.maxScore}分)`;
        modal.classList.remove('hidden');
      }
    }

    // 畫面更新提示文字
    showNotice(text) {
      const el = document.getElementById('game-notice');
      if (el) el.textContent = text;
    }

    // 更新抬頭顯示器 (HUD)
    updateHUD() {
      const elBlueScore = document.getElementById('score-blue');
      const elRedScore = document.getElementById('score-red');
      const elRoundNum = document.getElementById('round-num');
      const elTurnBanner = document.getElementById('turn-banner');

      if (elBlueScore) elBlueScore.textContent = this.scoreBlue;
      if (elRedScore) elRedScore.textContent = this.scoreRed;
      if (elRoundNum) elRoundNum.textContent = this.roundNumber;

      // 剩餘球數圖示 (Pips)
      const renderPips = (containerId, count, teamColor) => {
        const c = document.getElementById(containerId);
        if (!c) return;
        c.innerHTML = '';
        for (let i = 0; i < 3; i++) {
          const pip = document.createElement('span');
          pip.className = `boule-pip ${teamColor} ${i < count ? 'active' : 'empty'}`;
          c.appendChild(pip);
        }
      };

      renderPips('blue-boules-pips', this.blueRemaining, 'blue');
      renderPips('red-boules-pips', this.redRemaining, 'red');

      if (elTurnBanner) {
        if (this.state === GameState.WAITING_JACK) {
          elTurnBanner.textContent = `🎯 ${this.currentTurn === 'blue' ? '藍隊' : '紅隊'} 擲出小木球`;
          elTurnBanner.className = `turn-banner ${this.currentTurn}`;
        } else {
          elTurnBanner.textContent = `⚡ 輪到 ${this.currentTurn === 'blue' ? '藍隊' : (this.vsAi ? '老爹 Pierre' : '紅隊')} 投球`;
          elTurnBanner.className = `turn-banner ${this.currentTurn}`;
        }
      }
    }

    // 繪製球場、邊界線與投球圈
    drawCourt() {
      // 1. 繪製碎石底圖
      if (this.gravelBgCanvas) {
        this.ctx.drawImage(this.gravelBgCanvas, 0, 0);
      }

      this.ctx.save();

      // 2. 球場邊界線 (White Chalk Line)
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 6]);
      this.ctx.strokeRect(
        this.arenaBounds.minX,
        this.arenaBounds.minY,
        this.arenaBounds.maxX - this.arenaBounds.minX,
        this.arenaBounds.maxY - this.arenaBounds.minY
      );

      // 3. 小木球有效區域指示線 (Yellow subtle dashed lines)
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);

      // 上界線 (10米)
      this.ctx.beginPath();
      this.ctx.moveTo(this.arenaBounds.minX, this.jackValidZone.minY);
      this.ctx.lineTo(this.arenaBounds.maxX, this.jackValidZone.minY);
      this.ctx.stroke();

      // 下界線 (6米)
      this.ctx.beginPath();
      this.ctx.moveTo(this.arenaBounds.minX, this.jackValidZone.maxY);
      this.ctx.lineTo(this.arenaBounds.maxX, this.jackValidZone.maxY);
      this.ctx.stroke();

      // 區域文字標註
      this.ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
      this.ctx.font = '11px sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillText('10m 限位線', this.arenaBounds.maxX - 10, this.jackValidZone.minY - 6);
      this.ctx.fillText('6m 投擲線', this.arenaBounds.maxX - 10, this.jackValidZone.maxY + 16);

      // 4. 經典紅色擲球圈 (Cercle de pétanque - 雙腳必須站在圈內投擲)
      this.ctx.setLineDash([]);
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 3.5;
      this.ctx.beginPath();
      this.ctx.arc(this.throwCircle.x, this.throwCircle.y, this.throwCircle.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // 圈內陰影
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      this.ctx.fill();

      // 圈心標註
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('擲球圈 (Cercle)', this.throwCircle.x, this.throwCircle.y + 4);

      this.ctx.restore();
    }

    // 繪製拖曳瞄準輔助虛線與拋物線預覽
    drawAimGuide() {
      if (!this.isDragging) return;

      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const pullDist = Math.hypot(dx, dy);
      if (pullDist < 12) return;

      let vx, vy;
      if (dy < -10) {
        vx = -dx * 4.2;
        vy = -dy * 4.4;
      } else {
        vx = (this.dragCurrent.x - this.dragStart.x) * 4.2;
        vy = (this.dragCurrent.y - this.dragStart.y) * 4.4;
      }

      // 上限
      const spd = Math.hypot(vx, vy);
      if (spd > 820) {
        vx = (vx / spd) * 820;
        vy = (vy / spd) * 820;
      }
      if (vy > -80) vy = -80;

      this.ctx.save();

      // 1. 拖曳彈簧橡皮筋 (拉力線)
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(this.throwCircle.x, this.throwCircle.y);
      this.ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
      this.ctx.stroke();

      // 握持指針環
      this.ctx.fillStyle = '#f59e0b';
      this.ctx.beginPath();
      this.ctx.arc(this.dragCurrent.x, this.dragCurrent.y, 10, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. 模擬軌跡預覽點 (Trajectory Prediction Dots)
      const isShoot = (this.state === GameState.WAITING_BOULE && this.throwMode === ThrowMode.SHOOT);
      let simX = this.throwCircle.x;
      let simY = this.throwCircle.y;
      let simZ = isShoot ? 8 : 0;
      let simVx = isShoot ? vx * 0.85 : vx;
      let simVy = isShoot ? vy * 0.85 : vy;
      let simVz = isShoot ? Math.min(420, Math.hypot(vx, vy) * 0.75) : 0;

      const simDt = 0.04;
      const dotsCount = 18;

      for (let step = 0; step < dotsCount; step++) {
        if (simZ > 0 || simVz > 0) {
          simX += simVx * simDt;
          simY += simVy * simDt;
          simZ += simVz * simDt;
          simVz -= 980 * simDt;
          if (simZ <= 0) {
            simZ = 0;
            simVz = 0;
            simVx *= 0.65;
            simVy *= 0.65;
          }
        } else {
          simX += simVx * simDt;
          simY += simVy * simDt;
          const friction = 340 * simDt;
          const s = Math.hypot(simVx, simVy);
          if (s > 0) {
            const ns = Math.max(0, s - friction);
            simVx *= ns / s;
            simVy *= ns / s;
          }
        }

        const alpha = 1 - (step / dotsCount);
        const radius = Math.max(2, (isShoot ? (3 + simZ * 0.05) : 3.5));

        this.ctx.fillStyle = isShoot
          ? `rgba(244, 63, 94, ${alpha * 0.85})`
          : `rgba(56, 189, 248, ${alpha * 0.85})`;

        this.ctx.beginPath();
        this.ctx.arc(simX, simY - simZ, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // 繪製所有實體
    render() {
      this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

      // 1. 繪製球場
      this.drawCourt();

      // 2. 繪製皮尺測量
      if (this.showTape && this.cochonnet) {
        TapeMeasure.draw(this.ctx, this.cochonnet, this.boules, this.getBestBoule());
      }

      // 3. 繪製小木球
      if (this.cochonnet) {
        this.cochonnet.draw(this.ctx);
      }

      // 4. 繪製所有鐵球 (按 Y 軸座標排序，呈現 2.5D 前後遮擋層次)
      const sortedBoules = [...this.boules].sort((a, b) => a.y - b.y);
      for (const b of sortedBoules) {
        b.draw(this.ctx);
      }

      // 5. 繪製粒子效果
      for (const p of this.particles) {
        p.draw(this.ctx);
      }

      // 6. 繪製拖曳瞄準器
      this.drawAimGuide();
    }

    // 主遊戲循環
    gameLoop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  // 當 DOM 載入後啟動遊戲
  window.addEventListener('DOMContentLoaded', () => {
    window.petanqueAudio = new PetanqueAudioSystem();
    window.petanqueGame = new PetanqueGame();
  });
})();
