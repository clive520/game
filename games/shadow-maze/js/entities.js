/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 遊戲實體系統 (Entities: Player, Guard AI, Keycard, Battery & Exit Gate)
 */

// ==========================================
// 1. 主角玩家 (Player)
// ==========================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.angle = 0; // 手電筒照射朝向 (徑度)

    // 行動與速度
    this.walkSpeed = 135;
    this.runSpeed = 225;
    this.isRunning = false;
    this.noiseRadius = 0; // 腳步聲傳播半徑

    // 耐力與精力條
    this.stamina = 100;
    this.maxStamina = 100;

    // 手電筒系統
    this.flashlightOn = true;
    this.battery = 100;
    this.maxBattery = 100;
    this.flashlightRange = 310;
    this.flashlightFov = Math.PI * 0.34; // 約 61 度角
    this.flickerTimer = 0;
    this.isFlickering = false;

    // 狀態與物品
    this.hasKeycard = false;
    this.alive = true;
    this.escaped = false;

    // 滑鼠點擊導航路徑 (Click-to-Move Path)
    this.path = [];
  }

  // 設定滑鼠點擊移動目的地 (A* 尋路至目標點)
  setMoveTarget(targetX, targetY, maze) {
    if (!this.alive || this.escaped) return;

    const S = maze.tileSize;
    let tGridX = Math.floor(targetX / S);
    let tGridY = Math.floor(targetY / S);

    // 限制在地圖格內
    tGridX = Math.max(0, Math.min(maze.cols - 1, tGridX));
    tGridY = Math.max(0, Math.min(maze.rows - 1, tGridY));

    // 若點擊在牆壁上，尋找最靠近的開闊相鄰通道格
    if (maze.grid[tGridY][tGridX] === 1) {
      const neighbors = [
        { x: tGridX, y: tGridY - 1 }, { x: tGridX, y: tGridY + 1 },
        { x: tGridX - 1, y: tGridY }, { x: tGridX + 1, y: tGridY }
      ].filter(n => n.x >= 0 && n.x < maze.cols && n.y >= 0 && n.y < maze.rows && maze.grid[n.y][n.x] === 0);

      if (neighbors.length > 0) {
        // 挑選離滑鼠點擊點最近的通道格
        neighbors.sort((a, b) => {
          const da = Math.hypot((a.x + 0.5) * S - targetX, (a.y + 0.5) * S - targetY);
          const db = Math.hypot((b.x + 0.5) * S - targetX, (b.y + 0.5) * S - targetY);
          return da - db;
        });
        tGridX = neighbors[0].x;
        tGridY = neighbors[0].y;
        targetX = (tGridX + 0.5) * S;
        targetY = (tGridY + 0.5) * S;
      } else {
        return; // 無可到達鄰格
      }
    }

    // 檢查從目前位置是否有一條無阻隔的直線視野 (Line of Sight)
    const hasDirectLine = RaycastLighting.hasLineOfSight(this.x, this.y, targetX, targetY, maze.segments);
    if (hasDirectLine) {
      this.path = [{ x: targetX, y: targetY }];
      return;
    }

    // 若有轉角隔牆，使用 A* 尋路
    const pGridX = Math.floor(this.x / S);
    const pGridY = Math.floor(this.y / S);
    const navPath = maze.findPath(pGridX, pGridY, tGridX, tGridY);

    if (navPath && navPath.length > 0) {
      // 終點精確置於玩家點擊的目標點
      navPath.push({ x: targetX, y: targetY });
      this.path = navPath;
    } else {
      this.path = [{ x: targetX, y: targetY }];
    }
  }

  update(dt, input, maze) {
    if (!this.alive || this.escaped) return;

    // 判斷移動向量 (鍵盤優先，其次滑鼠導航路徑)
    let vx = 0;
    let vy = 0;
    let isMoving = false;

    if (input.moveX !== 0 || input.moveY !== 0) {
      // 鍵盤移動中，清除滑鼠尋路點
      this.path = [];
      const mag = Math.hypot(input.moveX, input.moveY);
      this.isRunning = input.shift && this.stamina > 5;
      const speed = this.isRunning ? this.runSpeed : this.walkSpeed;
      vx = (input.moveX / mag) * speed * dt;
      vy = (input.moveY / mag) * speed * dt;
      isMoving = true;
    } else if (this.path && this.path.length > 0) {
      // 依照滑鼠導航路徑行進
      const nextWp = this.path[0];
      const dx = nextWp.x - this.x;
      const dy = nextWp.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        // 抵達該導航節點
        this.path.shift();
        if (this.path.length === 0) {
          // 已到達最終點擊地點，停下腳步！
          isMoving = false;
        } else {
          isMoving = true;
        }
      } else {
        this.isRunning = input.shift && this.stamina > 5;
        const speed = this.isRunning ? this.runSpeed : this.walkSpeed;
        vx = (dx / dist) * speed * dt;
        vy = (dy / dist) * speed * dt;
        isMoving = true;
      }
    } else {
      this.isRunning = false;
    }

    // 1. 耐力與跑步聲
    if (this.isRunning && isMoving) {
      this.stamina = Math.max(0, this.stamina - 26 * dt);
      this.noiseRadius = 175;
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 18 * dt);
      this.noiseRadius = isMoving ? 35 : 0;
    }

    // 2. 移動與碰撞校正
    if (isMoving) {
      const resX = maze.checkCircleCollision(this.x + vx, this.y, this.radius);
      this.x = resX.x;
      const resY = maze.checkCircleCollision(this.x, this.y + vy, this.radius);
      this.y = resY.y;

      if (window.mazeAudio) {
        window.mazeAudio.playFootstep(this.isRunning);
      }
    }

    // 3. 手電筒方向鎖定游標/瞄準點 (即時跟隨滑鼠)
    this.angle = input.aimAngle;

    // 4. 手電筒電力消耗與低電量閃爍
    if (this.flashlightOn && this.battery > 0) {
      this.battery = Math.max(0, this.battery - 1.6 * dt); // 約 60 秒耗盡

      if (this.battery < 15) {
        this.flickerTimer += dt;
        if (this.flickerTimer > 0.12) {
          this.flickerTimer = 0;
          this.isFlickering = Math.random() < 0.45;
        }
      } else {
        this.isFlickering = false;
      }
    } else {
      this.flashlightOn = false;
      this.isFlickering = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 主角外觀 (特戰探索者)
    // 身體
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 戰術背包
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-this.radius - 2, -6, 5, 12);

    // 雙手手持手電筒
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(this.radius - 2, 4, 3.5, 0, Math.PI * 2);
    ctx.arc(this.radius - 2, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 金屬手電筒本體
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(this.radius - 3, -3, 8, 6);

    // 手電筒反光燈罩鏡面
    if (this.flashlightOn && !this.isFlickering) {
      ctx.fillStyle = "#fef08a";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.radius + 5, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ==========================================
// 2. 巡邏守衛 AI (Patrol Guard / Enemy)
// ==========================================
const GuardState = {
  PATROL: "PATROL",       // 綠燈巡邏
  SUSPICIOUS: "SUSPICIOUS", // 黃燈起疑轉向
  CHASE: "CHASE"          // 紅燈狂怒追擊！
};

class Guard {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.radius = 14;
    this.angle = config.angle || 0;
    this.waypoints = config.waypoints || [{ x: this.x, y: this.y }];
    this.currentWpIndex = 0;

    // AI 行為與狀態
    this.state = GuardState.PATROL;
    this.stateTimer = 0;
    this.patrolSpeed = 65;
    this.chaseSpeed = 155;
    this.suspiciousSpeed = 80;

    // 守衛的獨立視野範圍
    this.visionRange = 210;
    this.visionFov = Math.PI * 0.36; // 約 65 度

    // 記憶點與追擊尋路
    this.investigateTarget = null;
    this.lostPlayerTimer = 0;
    this.path = [];
    this.pathUpdateTimer = 0;

    // 是否被主角手電筒照亮 (核心可見性開關)
    this.isLitByPlayer = false;
  }

  update(dt, player, maze) {
    this.stateTimer += dt;
    this.pathUpdateTimer += dt;

    // 1. 檢驗是否直接目擊主角
    const canSeePlayer = player.alive && RaycastLighting.isPlayerInGuardVision(this, player, maze.segments);

    // 2. 檢驗是否聽見主角跑步聲
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    const canHearPlayer = player.alive && (distToPlayer <= player.noiseRadius) &&
                          RaycastLighting.hasLineOfSight(this.x, this.y, player.x, player.y, maze.segments);

    // 狀態轉移狀態機
    if (canSeePlayer) {
      if (this.state !== GuardState.CHASE) {
        if (window.mazeAudio) window.mazeAudio.playAlert();
      }
      this.state = GuardState.CHASE;
      this.investigateTarget = { x: player.x, y: player.y };
      this.lostPlayerTimer = 0;
    } else if (canHearPlayer && this.state !== GuardState.CHASE) {
      if (this.state !== GuardState.SUSPICIOUS) {
        if (window.mazeAudio) window.mazeAudio.playSuspicious();
      }
      this.state = GuardState.SUSPICIOUS;
      this.investigateTarget = { x: player.x, y: player.y };
      this.stateTimer = 0;
    }

    // 各狀態行為處理
    if (this.state === GuardState.CHASE) {
      this.lostPlayerTimer += dt;
      if (this.lostPlayerTimer > 4.5) {
        // 跟丟主角超過 4.5 秒，轉為起疑搜索
        this.state = GuardState.SUSPICIOUS;
        this.stateTimer = 0;
      }

      // 追向主角位置 (若視線通暢直接衝刺，否則透過 A* 尋路)
      const hasDirectLine = RaycastLighting.hasLineOfSight(this.x, this.y, player.x, player.y, maze.segments);
      let targetX = player.x;
      let targetY = player.y;

      if (!hasDirectLine && this.pathUpdateTimer > 0.4) {
        this.pathUpdateTimer = 0;
        const startGrid = { x: Math.floor(this.x / maze.tileSize), y: Math.floor(this.y / maze.tileSize) };
        const endGrid = { x: Math.floor(player.x / maze.tileSize), y: Math.floor(player.y / maze.tileSize) };
        this.path = maze.findPath(startGrid.x, startGrid.y, endGrid.x, endGrid.y);
      }

      if (this.path && this.path.length > 0 && !hasDirectLine) {
        const nextNode = this.path[0];
        if (Math.hypot(nextNode.x - this.x, nextNode.y - this.y) < 18) {
          this.path.shift();
        }
        if (this.path.length > 0) {
          targetX = this.path[0].x;
          targetY = this.path[0].y;
        }
      }

      this.moveTowards(targetX, targetY, this.chaseSpeed, dt, maze);

    } else if (this.state === GuardState.SUSPICIOUS) {
      if (this.investigateTarget) {
        const d = Math.hypot(this.investigateTarget.x - this.x, this.investigateTarget.y - this.y);
        if (d > 20) {
          this.moveTowards(this.investigateTarget.x, this.investigateTarget.y, this.suspiciousSpeed, dt, maze);
        } else {
          // 到達調查點，環顧四周
          this.angle += 1.8 * dt;
          if (this.stateTimer > 3.0) {
            this.state = GuardState.PATROL;
            this.investigateTarget = null;
          }
        }
      } else {
        this.state = GuardState.PATROL;
      }

    } else {
      // PATROL 巡邏
      if (this.waypoints.length > 0) {
        const targetWp = this.waypoints[this.currentWpIndex];
        const dist = Math.hypot(targetWp.x - this.x, targetWp.y - this.y);

        if (dist < 18) {
          // 抵達巡邏點，切換至下一個
          this.currentWpIndex = (this.currentWpIndex + 1) % this.waypoints.length;
        } else {
          this.moveTowards(targetWp.x, targetWp.y, this.patrolSpeed, dt, maze);
        }
      }
    }

    // 3. 抓住主角判定
    if (player.alive && distToPlayer < (this.radius + player.radius + 2)) {
      player.alive = false;
      if (window.mazeAudio) window.mazeAudio.playCaught();
    }
  }

  // 移向目標點並轉向
  moveTowards(targetX, targetY, speed, dt, maze) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const targetAngle = Math.atan2(dy, dx);

    // 平滑旋轉
    let diff = targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 5.5 * dt);

    const vx = Math.cos(this.angle) * speed * dt;
    const vy = Math.sin(this.angle) * speed * dt;

    const resX = maze.checkCircleCollision(this.x + vx, this.y, this.radius);
    this.x = resX.x;
    const resY = maze.checkCircleCollision(this.x, this.y + vy, this.radius);
    this.y = resY.y;
  }

  // 繪製守衛的光錐 (即便守衛本體在暗處，地面射燈依然依物理投影可見，警告玩家)
  drawVisionCone(ctx, mazeSegments) {
    const polygon = RaycastLighting.computeConeVisibilityPolygon(
      this.x,
      this.y,
      this.angle,
      this.visionFov,
      this.visionRange,
      mazeSegments
    );

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();

    let colorCenter, colorEdge;
    if (this.state === GuardState.CHASE) {
      colorCenter = "rgba(239, 68, 68, 0.75)";
      colorEdge = "rgba(220, 38, 38, 0.05)";
    } else if (this.state === GuardState.SUSPICIOUS) {
      colorCenter = "rgba(234, 179, 8, 0.55)";
      colorEdge = "rgba(202, 138, 4, 0.05)";
    } else {
      colorCenter = "rgba(34, 197, 94, 0.45)";
      colorEdge = "rgba(22, 163, 74, 0.05)";
    }

    const grad = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.visionRange);
    grad.addColorStop(0, colorCenter);
    grad.addColorStop(0.7, colorCenter.replace(/[\d\.]+\)$/, "0.2)"));
    grad.addColorStop(1, colorEdge);

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // 繪製守衛本體 (※ 關鍵規則：只有被手電筒照亮時才會畫出本體！)
  drawBody(ctx) {
    if (!this.isLitByPlayer) return; // 暗夜隱身！

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 警報狀態輪廓光
    if (this.state === GuardState.CHASE) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
    }

    // 守衛本體 (生化守衛)
    ctx.fillStyle = (this.state === GuardState.CHASE) ? "#991b1b" : "#1f2937";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 守衛護肩裝甲
    ctx.fillStyle = (this.state === GuardState.CHASE) ? "#dc2626" : "#4b5563";
    ctx.fillRect(-this.radius, -8, 6, 16);

    // 探照燈支架
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(this.radius - 2, -4, 9, 8);

    // 狀態表情指示符標籤浮在守衛頭頂
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y - 20);
    ctx.font = "bold 15px 'JetBrains Mono', sans-serif";
    ctx.textAlign = "center";

    if (this.state === GuardState.CHASE) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("❗", 0, 0);
    } else if (this.state === GuardState.SUSPICIOUS) {
      ctx.fillStyle = "#eab308";
      ctx.fillText("❓", 0, 0);
    }
    ctx.restore();
  }
}

// ==========================================
// 3. 目標物品 (Keycard) & 備用電池 (Battery)
// ==========================================
class ItemPickup {
  constructor(x, y, type = "keycard") {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.type = type; // "keycard" | "battery"
    this.collected = false;
    this.pulseAngle = Math.random() * Math.PI * 2;
  }

  update(dt, player) {
    if (this.collected) return;
    this.pulseAngle += 3.5 * dt;

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < (this.radius + player.radius)) {
      this.collected = true;
      if (this.type === "keycard") {
        player.hasKeycard = true;
        if (window.mazeAudio) {
          window.mazeAudio.playPickup(true);
          window.mazeAudio.playDoorUnlock();
        }
      } else if (this.type === "battery") {
        player.battery = Math.min(player.maxBattery, player.battery + 40);
        if (window.mazeAudio) window.mazeAudio.playPickup(false);
      }
    }
  }

  draw(ctx, isLit) {
    if (this.collected) return;
    // 即使在暗處也發出微弱自體螢光，吸引玩家探索
    const alpha = isLit ? 1.0 : 0.45;
    const pulse = 1 + Math.sin(this.pulseAngle) * 0.18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);

    if (this.type === "keycard") {
      // 金色逃生門禁卡
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-10, -7, 20, 14);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-8, -4, 6, 8); // 晶片
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(2, -3, 5, 2);  // 綠色條碼
    } else {
      // 綠色備用鋰電池
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#10b981";
      ctx.fillRect(-7, -10, 14, 20);

      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(-3, -13, 6, 3); // 電極柱

      // 閃電符號
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡", 0, 4);
    }

    ctx.restore();
  }
}

// ==========================================
// 4. 逃生出口閘門 (Exit Gate)
// ==========================================
class ExitGate {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 24;
    this.beaconAngle = 0;
  }

  update(dt, player) {
    this.beaconAngle += 4 * dt;
    if (player.hasKeycard && player.alive) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < 26) {
        player.escaped = true;
        if (window.mazeAudio) window.mazeAudio.playVictory();
      }
    }
  }

  draw(ctx, isUnlocked) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 出口外框
    ctx.strokeStyle = isUnlocked ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 3;
    ctx.strokeRect(-18, -18, 36, 36);

    ctx.fillStyle = isUnlocked ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)";
    ctx.fillRect(-18, -18, 36, 36);

    // 呼吸信標光
    if (isUnlocked) {
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 11px 'JetBrains Mono', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", 0, -2);
      ctx.fillText("➔", 0, 10);
    } else {
      ctx.fillStyle = "#f87171";
      ctx.font = "bold 11px 'JetBrains Mono', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LOCKED", 0, 4);
    }

    ctx.restore();
  }
}

window.Player = Player;
window.Guard = Guard;
window.GuardState = GuardState;
window.ItemPickup = ItemPickup;
window.ExitGate = ExitGate;
