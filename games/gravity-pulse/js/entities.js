/**
 * 《引力回圈：重力幾何》實體模型 (Entities)
 * 包含：探測器核心 (Probe)、幾何引力星 (GravityNode)、幾何星鑽 (Shard)、障礙物 (Obstacle)、躍遷蟲洞 (Wormhole)、幾何粒子 (Particle)
 */

class Particle {
  constructor(x, y, color, vx, vy, maxLife = 0.5, size = 3, type = "spark") {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.size = size;
    this.type = type; // "spark" | "ring" | "text"
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.type === "ring") {
      this.size += 75 * dt;
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === "ring") {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === "text") {
      ctx.fillStyle = this.color;
      ctx.font = `bold ${this.size}px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(this.color.text || "PULSE!", this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 幾何星鑽 (Collectibles)
class Shard {
  constructor(x, y, id = 0) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.radius = 12;
    this.collected = false;
    this.angle = Math.random() * Math.PI * 2;
    this.floatTimer = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (this.collected) return;
    this.angle += 2.2 * dt;
    this.floatTimer += 3 * dt;
  }

  draw(ctx) {
    if (this.collected) return;
    const offsetY = Math.sin(this.floatTimer) * 4;
    const drawY = this.y + offsetY;

    ctx.save();
    ctx.translate(this.x, drawY);
    ctx.rotate(this.angle);

    // 外圍柔和金光
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 14;

    // 繪製八面體 / 幾何菱形水晶
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#fffbeb";
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius * 0.75, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 內部幾何核心
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 躍遷蟲洞 (Goal Wormhole)
class Wormhole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 32;
    this.angle = 0;
    this.pulse = 0;
  }

  update(dt) {
    this.angle -= 1.8 * dt;
    this.pulse += 3 * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulseScale = 1 + Math.sin(this.pulse) * 0.08;

    // 外圍躍遷引力波紋
    ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (this.radius + 14) * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // 多重旋轉螺旋幾何圓環
    ctx.rotate(this.angle);
    for (let i = 0; i < 3; i++) {
      const r = this.radius * (0.4 + i * 0.3) * pulseScale;
      ctx.strokeStyle = i === 2 ? "#c084fc" : "#a855f7";
      ctx.lineWidth = 2.5 - i * 0.5;
      ctx.setLineDash([8 + i * 4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 核心超空間黑/紫焦點
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * 0.5);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, "#a855f7");
    grad.addColorStop(1, "rgba(59, 7, 100, 0.9)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.48 * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 幾何引力節點 (Gravity Node)
class GravityNode {
  constructor(config) {
    this.id = config.id || Math.random();
    this.type = config.type || "standard"; // standard | pulsar | inverter | decaying | mobile
    this.x = config.x;
    this.y = config.y;
    this.baseX = config.x;
    this.baseY = config.y;
    this.radius = config.radius || 24;
    this.captureRadius = config.captureRadius || 95;
    this.orbitRadius = config.orbitRadius || 55;
    this.dir = config.dir !== undefined ? config.dir : 1; // 1: 順時針, -1: 逆時針
    this.baseSpeed = config.baseSpeed || 2.4; // 基礎角速度 (rad/s)
    this.currentSpeed = this.baseSpeed;

    // 衰變星特有倒數
    this.isDecaying = this.type === "decaying";
    this.maxTime = config.decayTime || 3.0; // 在軌道內可存活秒數
    this.timeLeft = this.maxTime;
    this.isExploded = false;

    // 移動星航點位移
    this.isMobile = this.type === "mobile";
    this.waypoints = config.waypoints || null; // e.g. { dx: 120, dy: 0, speed: 1.5 }
    this.moveTimer = 0;

    // 脈衝加速星屬性
    this.pulsarBoost = 1.0;

    // 動畫參數
    this.animAngle = Math.random() * Math.PI * 2;
    this.waveTimer = 0;
  }

  update(dt, isOccupied = false) {
    this.animAngle += (this.dir * 1.5) * dt;
    this.waveTimer += 2.5 * dt;

    // 移動星位置更新 (平滑正弦往返)
    if (this.isMobile && this.waypoints) {
      this.moveTimer += dt * (this.waypoints.speed || 1.2);
      const s = Math.sin(this.moveTimer);
      this.x = this.baseX + (this.waypoints.dx || 0) * s;
      this.y = this.baseY + (this.waypoints.dy || 0) * s;
    }

    // 衰變星在探測器繞行時持續倒數
    if (this.isDecaying && isOccupied && !this.isExploded) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.isExploded = true;
      }
    }

    // 脈衝星速度隨繞行微幅激增
    if (this.type === "pulsar" && isOccupied) {
      this.pulsarBoost = Math.min(2.2, this.pulsarBoost + 0.3 * dt);
      this.currentSpeed = this.baseSpeed * this.pulsarBoost;
    } else if (this.type !== "pulsar") {
      this.currentSpeed = this.baseSpeed;
    }
  }

  reset() {
    this.timeLeft = this.maxTime;
    this.isExploded = false;
    this.pulsarBoost = 1.0;
    this.currentSpeed = this.baseSpeed;
    this.moveTimer = 0;
    this.x = this.baseX;
    this.y = this.baseY;
  }

  getColor() {
    switch (this.type) {
      case "pulsar": return { main: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)", dark: "#78350f" }; // 琥珀金
      case "inverter": return { main: "#f43f5e", glow: "rgba(244, 63, 94, 0.4)", dark: "#881337" }; // 霓虹玫紅
      case "decaying": return { main: "#ef4444", glow: "rgba(239, 68, 68, 0.5)", dark: "#7f1d1d" }; // 警告赤紅
      case "mobile": return { main: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)", dark: "#4c1d95" }; // 巡航紫
      default: return { main: "#10b981", glow: "rgba(16, 185, 129, 0.4)", dark: "#064e3b" }; // 翡翠綠 (標準)
    }
  }

  draw(ctx, isOccupied = false, probeAngle = 0) {
    if (this.isExploded) return;
    const colors = this.getColor();

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. 繪製引力捕捉範圍虛線圈 (Capture Radius)
    ctx.strokeStyle = isOccupied ? colors.main : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isOccupied ? 1.5 : 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, this.captureRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 繪製精準公轉軌道環 (Orbit Ring)
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, this.orbitRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 旋轉幾何引力波紋 (Pulsing Gravity Ripple)
    const waveR = this.radius + ((Math.sin(this.waveTimer) + 1) / 2) * (this.orbitRadius - this.radius);
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, waveR, 0, Math.PI * 2);
    ctx.stroke();

    // 4. 衰變星專屬倒數外環 (Decay Countdown Arc)
    if (this.isDecaying && isOccupied) {
      const pct = this.timeLeft / this.maxTime;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.orbitRadius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }

    // 5. 核心幾何多邊形天體
    ctx.rotate(this.animAngle);
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 16;
    ctx.fillStyle = colors.dark;
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2.5;

    // 根據類型繪製不同幾何圖騰
    if (this.type === "pulsar") {
      // 八角芒星
      this.drawStar(ctx, 0, 0, 8, this.radius, this.radius * 0.6);
    } else if (this.type === "inverter") {
      // 雙向幾何菱形
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "decaying") {
      // 三角警示體
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * this.radius;
        const y = Math.sin(a) * this.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 標準六角形天體 (Hexagon)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * this.radius;
        const y = Math.sin(a) * this.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 天體正中晶核
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 6. 若探測器正在此節點公轉，即時繪製切線發射預測向量 (Tangent Aim Arrow)
    if (isOccupied) {
      this.drawTangentGuide(ctx, probeAngle, colors.main);
    }
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawTangentGuide(ctx, probeAngle, color) {
    const px = this.x + Math.cos(probeAngle) * this.orbitRadius;
    const py = this.y + Math.sin(probeAngle) * this.orbitRadius;

    // 切線方向向量
    const tanX = -Math.sin(probeAngle) * this.dir;
    const tanY = Math.cos(probeAngle) * this.dir;
    const arrowLen = 50 * (this.pulsarBoost || 1);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + tanX * arrowLen, py + tanY * arrowLen);
    ctx.stroke();

    // 箭頭頂端
    const endX = px + tanX * arrowLen;
    const endY = py + tanY * arrowLen;
    const arrowAngle = Math.atan2(tanY, tanX);

    ctx.fillStyle = color;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(arrowAngle - 0.4) * 10, endY - Math.sin(arrowAngle - 0.4) * 10);
    ctx.lineTo(endX - Math.cos(arrowAngle + 0.4) * 10, endY - Math.sin(arrowAngle + 0.4) * 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// 幾何障礙物 (Obstacle)
class Obstacle {
  constructor(config) {
    this.type = config.type || "laser"; // laser | blackhole | barrier
    this.x = config.x;
    this.y = config.y;
    this.length = config.length || 140;
    this.rotSpeed = config.rotSpeed || 0; // rad/s
    this.angle = config.angle || 0;
    this.radius = config.radius || 20;

    // 雷射定時開關
    this.isBlinking = config.blinking || false;
    this.blinkPeriod = config.blinkPeriod || 3.0; // 週期
    this.timer = config.initialTimer || 0;
    this.active = true;
  }

  update(dt) {
    this.angle += this.rotSpeed * dt;

    if (this.isBlinking) {
      this.timer += dt;
      this.active = (this.timer % this.blinkPeriod) < (this.blinkPeriod * 0.6); // 60% 時間開啟
    }
  }

  checkCollision(px, py, pr) {
    if (!this.active) return false;

    if (this.type === "blackhole") {
      const d = Math.hypot(px - this.x, py - this.y);
      return d <= this.radius + pr;
    }

    if (this.type === "laser" || this.type === "barrier") {
      // 線段膠囊體碰撞
      const halfL = this.length / 2;
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);

      const ax = this.x - cos * halfL;
      const ay = this.y - sin * halfL;
      const bx = this.x + cos * halfL;
      const by = this.y + sin * halfL;

      const dist = this.distToSegment(px, py, ax, ay, bx, by);
      return dist <= pr + 5; // 5 為雷射線寬半徑
    }
    return false;
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === "blackhole") {
      // 奇點黑洞
      ctx.rotate(this.angle);
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, this.radius);
      grad.addColorStop(0, "#000000");
      grad.addColorStop(0.7, "#180028");
      grad.addColorStop(1, "rgba(244, 63, 94, 0.8)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // 吸積盤旋轉光弧
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 1.5);
      ctx.stroke();
    } else {
      // 旋轉雷射光束 / 幾何障礙
      ctx.rotate(this.angle);
      const halfL = this.length / 2;

      if (!this.active) {
        // 蓄力警示虛線
        ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(-halfL, 0);
        ctx.lineTo(halfL, 0);
        ctx.stroke();
      } else {
        // 熾熱致命雷射光束
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 12;

        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-halfL, 0);
        ctx.lineTo(halfL, 0);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-halfL, 0);
        ctx.lineTo(halfL, 0);
        ctx.stroke();
      }

      // 兩端幾何發射器
      ctx.fillStyle = "#334155";
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-halfL, 0, 7, 0, Math.PI * 2);
      ctx.arc(halfL, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 探測器核心 (Probe)
class Probe {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.radius = 9;
    this.state = "orbiting"; // "free" | "orbiting" | "dead" | "cleared"
    this.orbitNode = null;
    this.lastNode = null;
    this.orbitAngle = 0;
    this.orbitSpeed = 2.4;
    this.trail = [];
    this.trailMax = 22;
    this.leaps = 0; // 連續跳躍成功數
  }

  launchFromNode() {
    if (this.state !== "orbiting" || !this.orbitNode) return false;

    // 計算切線發射向量速度
    const node = this.orbitNode;
    const dir = node.dir;
    const speed = (node.currentSpeed || 2.4) * (node.orbitRadius || 55);

    this.vx = -Math.sin(this.orbitAngle) * speed * dir;
    this.vy = Math.cos(this.orbitAngle) * speed * dir;

    this.state = "free";
    this.lastNode = node; // 紀錄剛彈射脫離的天體，避免在脫離捕獲圈前被立即二次吸回
    this.orbitNode = null;
    this.leaps++;
    return true;
  }

  captureByNode(node) {
    this.state = "orbiting";
    this.orbitNode = node;
    this.lastNode = null;

    // 若節點為反轉星，進場時翻轉旋轉方向
    if (node.type === "inverter") {
      node.dir *= -1;
    }

    // 計算初切角度
    const dx = this.x - node.x;
    const dy = this.y - node.y;
    this.orbitAngle = Math.atan2(dy, dx);
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, nodes, obstacles, shards, wormhole, particles) {
    if (this.state === "dead" || this.state === "cleared") return;

    // 紀錄軌跡拖尾
    this.trail.unshift({ x: this.x, y: this.y, alpha: 1.0 });
    if (this.trail.length > this.trailMax) this.trail.pop();
    for (const t of this.trail) t.alpha -= dt * 2.2;

    if (this.state === "orbiting") {
      if (!this.orbitNode || this.orbitNode.isExploded) {
        // 節點爆炸或不存在，直接彈出
        this.state = "dead";
        return;
      }

      // 公轉運動
      const speed = this.orbitNode.currentSpeed;
      this.orbitAngle += speed * this.orbitNode.dir * dt;

      // 探測器位置綁定公轉半徑
      this.x = this.orbitNode.x + Math.cos(this.orbitAngle) * this.orbitNode.orbitRadius;
      this.y = this.orbitNode.y + Math.sin(this.orbitAngle) * this.orbitNode.orbitRadius;

      // 伴隨引力牽引微光粒子
      if (Math.random() < 0.3) {
        particles.push(new Particle(this.x, this.y, "#00f0ff", (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.3, 2));
      }
    } else if (this.state === "free") {
      // 自由滑翔推進
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 檢查是否已遠離上次脫離的天體
      if (this.lastNode) {
        const dLast = Math.hypot(this.x - this.lastNode.x, this.y - this.lastNode.y);
        if (dLast > this.lastNode.captureRadius + 10) {
          this.lastNode = null;
        }
      }

      // 檢查是否進入任何引力節點的捕獲半徑
      for (const node of nodes) {
        if (node.isExploded) continue;
        if (node === this.lastNode) continue; // 剛脫離的天體在未離開捕獲半徑前不重複捕獲！

        const d = Math.hypot(this.x - node.x, this.y - node.y);
        if (d <= node.captureRadius) {
          this.captureByNode(node);
          window.gravityAudio.playCapture();

          // 捕獲光圈特效
          particles.push(new Particle(node.x, node.y, node.getColor().main, 0, 0, 0.4, node.orbitRadius, "ring"));
          break;
        }
      }
    }

    // 檢查星鑽收集
    for (const shard of shards) {
      if (!shard.collected) {
        const d = Math.hypot(this.x - shard.x, this.y - shard.y);
        if (d <= this.radius + shard.radius + 6) {
          shard.collected = true;
          window.gravityAudio.playShard(shard.id);
          particles.push(new Particle(shard.x, shard.y, "#fbbf24", 0, 0, 0.5, 30, "ring"));
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            particles.push(new Particle(shard.x, shard.y, "#fbbf24", Math.cos(a) * 60, Math.sin(a) * 60, 0.4, 2.5));
          }
        }
      }
    }

    // 檢查撞擊障礙
    for (const obs of obstacles) {
      if (obs.checkCollision(this.x, this.y, this.radius)) {
        this.die(particles);
        return;
      }
    }

    // 檢查躍遷蟲洞 (Goal)
    if (wormhole) {
      const d = Math.hypot(this.x - wormhole.x, this.y - wormhole.y);
      if (d <= this.radius + wormhole.radius * 0.7) {
        this.state = "cleared";
        window.gravityAudio.playGoal();
        for (let i = 0; i < 25; i++) {
          const a = (i / 25) * Math.PI * 2;
          particles.push(new Particle(this.x, this.y, "#c084fc", Math.cos(a) * 120, Math.sin(a) * 120, 0.7, 4));
        }
      }
    }
  }

  die(particles) {
    this.state = "dead";
    window.gravityAudio.playCrash();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const spd = Math.random() * 140 + 40;
      particles.push(new Particle(this.x, this.y, "#f43f5e", Math.cos(a) * spd, Math.sin(a) * spd, 0.6, 3));
    }
  }

  draw(ctx) {
    if (this.state === "dead") return;

    // 繪製軌跡流光
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (t.alpha <= 0) continue;
      ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * (1 - i / this.trailMax) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 若在公轉，繪製與引力節點之量子重力牽引光束 (Gravitational Tether)
    if (this.state === "orbiting" && this.orbitNode) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(this.orbitNode.x, this.orbitNode.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.restore();
    }

    // 探測器本體
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 14;

    // 外層光子防護罩
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 內核純白光芒
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
