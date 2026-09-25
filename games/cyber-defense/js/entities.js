/**
 * 實體模組 (Entities Module)
 * 指揮官機甲、4種防禦塔、4種機械侵略者、子彈與粒子特效
 */

// 粒子特效
class Particle {
  constructor(x, y, color, vx, vy, life = 0.5, size = 3) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 實體：星際指揮官 (The Commander)
class Commander {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.speed = 180;
    this.radius = 16;
    this.range = 130;
    this.damage = 18;
    this.fireRate = 0.28;
    this.fireTimer = 0;
    
    // 技能冷卻系統 (秒)
    this.empCooldown = 0;
    this.empMaxCd = 10;
    this.empRadius = 150;

    this.orbitalCooldown = 0;
    this.orbitalMaxCd = 18;
    this.orbitalRadius = 100;
  }

  update(dt, enemies, projectiles, particles) {
    // 1. 移動處理（平滑趨向目標點）
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      const step = Math.min(dist, this.speed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;

      // 移動尾焰粒子
      if (Math.random() < 0.4) {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 8,
          this.y + (Math.random() - 0.5) * 8,
          "#38bdf8",
          -dx * 0.3 + (Math.random() - 0.5) * 20,
          -dy * 0.3 + (Math.random() - 0.5) * 20,
          0.3,
          2.5
        ));
      }
    }

    // 2. 技能冷卻遞減
    if (this.empCooldown > 0) this.empCooldown = Math.max(0, this.empCooldown - dt);
    if (this.orbitalCooldown > 0) this.orbitalCooldown = Math.max(0, this.orbitalCooldown - dt);

    // 3. 自動雷射射擊最近敵人
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      let closest = null;
      let minDist = this.range;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d < minDist) {
          minDist = d;
          closest = enemy;
        }
      }

      if (closest) {
        this.fireTimer = this.fireRate;
        projectiles.push(new Projectile(
          this.x, this.y, closest, "bullet", this.damage, "#38bdf8", 480
        ));
        audio.playLaser();
      }
    }
  }

  // 施放 EMP 脈衝
  castEMP(enemies, particles) {
    if (this.empCooldown > 0) return false;
    this.empCooldown = this.empMaxCd;
    audio.playEMP();

    // 衝擊波粒子環
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      particles.push(new Particle(
        this.x, this.y, "#06b6d4",
        Math.cos(angle) * 220,
        Math.sin(angle) * 220,
        0.5,
        4
      ));
    }

    // 對半徑內機械敵軍施加 50 傷害與 3.5 秒完全癱瘓暈眩
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (d <= this.empRadius) {
        enemy.takeDamage(50, particles);
        enemy.applyStun(3.5);
      }
    }
    return true;
  }

  // 施放 軌道轟炸
  castOrbital(targetX, targetY, enemies, particles) {
    if (this.orbitalCooldown > 0) return false;
    this.orbitalCooldown = this.orbitalMaxCd;
    audio.playExplosion();

    // 爆炸粒子光芒
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 40;
      particles.push(new Particle(
        targetX, targetY, "#f43f5e",
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.6,
        5
      ));
    }

    // 範圍內造成 220 毀滅打擊
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.x - targetX, enemy.y - targetY);
      if (d <= this.orbitalRadius) {
        enemy.takeDamage(220, particles);
      }
    }
    return true;
  }

  draw(ctx) {
    ctx.save();
    // 射程微光圈
    ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 機甲外光暈
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#06b6d4";

    // 機甲底座外環
    ctx.fillStyle = "#0284c7";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 機甲核心
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 機甲裝甲翼
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, Math.PI - 0.6, Math.PI + 0.6);
    ctx.stroke();

    ctx.restore();
  }
}

// 實體：防禦塔類別 (Defense Towers)
class Tower {
  constructor(col, row, type, cellSize) {
    this.col = col;
    this.row = row;
    this.type = type;
    this.cellSize = cellSize;
    this.x = col * cellSize + cellSize / 2;
    this.y = row * cellSize + cellSize / 2;
    this.level = 1;
    this.fireTimer = 0;
    this.target = null;
    this.beamTime = 0; // 磁軌砲光束顯示時間
    this.beamEnd = null;

    this.initStats();
  }

  initStats() {
    switch (this.type) {
      case "pulse":
        this.name = "脈衝光子塔";
        this.baseCost = 50;
        this.range = 120;
        this.damage = 18;
        this.fireRate = 0.32;
        this.color = "#06b6d4";
        break;
      case "railgun":
        this.name = "重力磁軌砲";
        this.baseCost = 120;
        this.range = 230;
        this.damage = 75;
        this.fireRate = 1.3;
        this.color = "#a855f7";
        break;
      case "emp":
        this.name = "電磁緩速塔";
        this.baseCost = 80;
        this.range = 105;
        this.damage = 8;
        this.fireRate = 0.9;
        this.color = "#38bdf8";
        this.slowFactor = 0.5; // 減速 50%
        this.slowDuration = 2.0;
        break;
      case "missile":
        this.name = "高爆巡弋導彈";
        this.baseCost = 150;
        this.range = 180;
        this.damage = 60;
        this.fireRate = 1.4;
        this.splashRadius = 65;
        this.color = "#f43f5e";
        break;
    }
    this.applyLevelStats();
  }

  applyLevelStats() {
    const multi = 1 + (this.level - 1) * 0.45;
    this.actualDamage = Math.round(this.damage * multi);
    this.actualRange = Math.round(this.range * (1 + (this.level - 1) * 0.12));
    this.upgradeCost = Math.round(this.baseCost * (1.1 * this.level));
    this.sellValue = Math.round((this.baseCost + (this.level > 1 ? this.baseCost * 0.8 : 0)) * 0.7);
  }

  upgrade() {
    if (this.level < 3) {
      this.level++;
      this.applyLevelStats();
      audio.playBuild();
      return true;
    }
    return false;
  }

  update(dt, enemies, projectiles, particles) {
    this.fireTimer -= dt;
    if (this.beamTime > 0) this.beamTime -= dt;

    // 尋找射程內的最優先敵軍（距離終點最近的敵軍）
    let bestEnemy = null;
    let minPathIndex = Infinity;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= this.actualRange) {
        // 敵人剩餘路徑越少越優先集火
        const remainingSteps = enemy.path.length - enemy.pathIndex;
        if (remainingSteps < minPathIndex) {
          minPathIndex = remainingSteps;
          bestEnemy = enemy;
        }
      }
    }

    this.target = bestEnemy;

    if (this.target && this.fireTimer <= 0) {
      this.fireTimer = this.fireRate;
      this.shoot(projectiles, particles, enemies);
    }
  }

  shoot(projectiles, particles, enemies) {
    if (!this.target) return;

    if (this.type === "pulse") {
      audio.playLaser();
      projectiles.push(new Projectile(
        this.x, this.y, this.target, "bullet", this.actualDamage, this.color, 520
      ));
    } else if (this.type === "railgun") {
      // 磁軌砲貫穿一直線！
      audio.playRailgun();
      this.beamTime = 0.2;
      const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      const endX = this.x + Math.cos(angle) * this.actualRange;
      const endY = this.y + Math.sin(angle) * this.actualRange;
      this.beamEnd = { x: endX, y: endY };

      // 直線射線碰撞所有穿過的敵軍
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const d = distToSegment({ x: this.x, y: this.y }, this.beamEnd, { x: enemy.x, y: enemy.y });
        if (d <= enemy.radius + 6) {
          enemy.takeDamage(this.actualDamage, particles);
        }
      }
    } else if (this.type === "emp") {
      audio.playEMP();
      // 範圍擴散環
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        particles.push(new Particle(
          this.x, this.y, this.color,
          Math.cos(a) * 110,
          Math.sin(a) * 110,
          0.35,
          3
        ));
      }
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist <= this.actualRange) {
          enemy.takeDamage(this.actualDamage, particles);
          enemy.applySlow(this.slowFactor, this.slowDuration);
        }
      }
    } else if (this.type === "missile") {
      audio.playMissileLaunch();
      projectiles.push(new Projectile(
        this.x, this.y, this.target, "missile", this.actualDamage, this.color, 320, this.splashRadius
      ));
    }
  }

  draw(ctx, isSelected = false) {
    ctx.save();

    // 若被選中，繪製高亮射程光圈
    if (isSelected) {
      ctx.strokeStyle = this.color;
      ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.actualRange, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 塔基座（科幻方形金屬塊）
    const half = this.cellSize * 0.42;
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(this.x - half, this.y - half, half * 2, half * 2, 4);
    ctx.fill();
    ctx.stroke();

    // 塔芯發光能量源
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, half * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 等級指示燈
    for (let i = 0; i < this.level; i++) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(this.x - half + 6 + i * 7, this.y - half + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 磁軌砲高能貫穿雷射光束渲染
    if (this.beamTime > 0 && this.beamEnd) {
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 5 * (this.beamTime / 0.2);
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#a855f7";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.beamEnd.x, this.beamEnd.y);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * (this.beamTime / 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 實體：敵軍 (Mechanical Invaders)
class Enemy {
  constructor(type, waveNumber, pathfinding, cellSize) {
    this.type = type;
    this.cellSize = cellSize;
    this.pathfinding = pathfinding;

    // 起點
    this.gridCol = pathfinding.start.col;
    this.gridRow = pathfinding.start.row;
    this.x = this.gridCol * cellSize + cellSize / 2;
    this.y = this.gridRow * cellSize + cellSize / 2;

    this.alive = true;
    this.reachedExit = false;

    // 狀態效果
    this.stunTime = 0;
    this.slowTime = 0;
    this.slowFactor = 1.0;

    this.initStats(waveNumber);
    this.updatePath();
  }

  initStats(wave) {
    const scale = 1 + (wave - 1) * 0.22;
    switch (this.type) {
      case "scout":
        this.name = "偵察無人機";
        this.baseSpeed = 95;
        this.maxHp = Math.round(65 * scale);
        this.bounty = 10;
        this.radius = 10;
        this.color = "#38bdf8";
        break;
      case "trooper":
        this.name = "生化機械兵";
        this.baseSpeed = 65;
        this.maxHp = Math.round(150 * scale);
        this.bounty = 16;
        this.radius = 12;
        this.color = "#fbbf24";
        break;
      case "mech":
        this.name = "重裝突擊甲";
        this.baseSpeed = 40;
        this.maxHp = Math.round(480 * scale);
        this.bounty = 38;
        this.radius = 16;
        this.color = "#f43f5e";
        break;
      case "boss":
        this.name = "星艦泰坦";
        this.baseSpeed = 26;
        this.maxHp = Math.round(2200 * scale);
        this.bounty = 220;
        this.radius = 24;
        this.color = "#a855f7";
        break;
    }
    this.hp = this.maxHp;
  }

  // 更新當前 A* 尋路路徑
  updatePath() {
    const startNode = { col: this.gridCol, row: this.gridRow };
    const newPath = this.pathfinding.findPath(startNode, this.pathfinding.exit);
    if (newPath && newPath.length > 0) {
      this.path = newPath;
      this.pathIndex = 0;
    }
  }

  applySlow(factor, duration) {
    this.slowFactor = factor;
    this.slowTime = Math.max(this.slowTime, duration);
  }

  applyStun(duration) {
    this.stunTime = Math.max(this.stunTime, duration);
  }

  takeDamage(amount, particles) {
    this.hp -= amount;
    // 飛濺霓虹碎片
    for (let i = 0; i < 4; i++) {
      particles.push(new Particle(
        this.x, this.y, this.color,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
        0.25,
        2
      ));
    }
    if (this.hp <= 0 && this.alive) {
      this.alive = false;
      this.onDeath(particles);
    }
  }

  onDeath(particles) {
    audio.playExplosion();
    const count = this.type === "boss" ? 60 : 20;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 140 + 20;
      particles.push(new Particle(
        this.x, this.y, this.color,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.5,
        Math.random() * 3 + 2
      ));
    }
  }

  update(dt, particles) {
    if (!this.alive) return;

    // 狀態倒數
    if (this.stunTime > 0) {
      this.stunTime -= dt;
      return; // 癱瘓中無法移動
    }

    if (this.slowTime > 0) {
      this.slowTime -= dt;
      if (this.slowTime <= 0) this.slowFactor = 1.0;
    }

    if (!this.path || this.pathIndex >= this.path.length) return;

    // 當前目標網格點
    const targetNode = this.path[this.pathIndex];
    const targetX = targetNode.col * this.cellSize + this.cellSize / 2;
    const targetY = targetNode.row * this.cellSize + this.cellSize / 2;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    const curSpeed = this.baseSpeed * this.slowFactor;
    const step = curSpeed * dt;

    if (dist <= step) {
      this.x = targetX;
      this.y = targetY;
      this.gridCol = targetNode.col;
      this.gridRow = targetNode.row;
      this.pathIndex++;

      // 檢查是否攻抵核心終點
      if (this.pathIndex >= this.path.length) {
        this.alive = false;
        this.reachedExit = true;
      }
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.gridCol = Math.floor(this.x / this.cellSize);
      this.gridRow = Math.floor(this.y / this.cellSize);
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();

    // 減速光環
    if (this.slowTime > 0) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 敵人本體
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();

    if (this.type === "scout") {
      // 三角形敏捷機身
      ctx.moveTo(this.x + this.radius, this.y);
      ctx.lineTo(this.x - this.radius * 0.7, this.y - this.radius * 0.7);
      ctx.lineTo(this.x - this.radius * 0.3, this.y);
      ctx.lineTo(this.x - this.radius * 0.7, this.y + this.radius * 0.7);
      ctx.closePath();
    } else if (this.type === "mech" || this.type === "boss") {
      // 八角形裝甲突擊型
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    } else {
      // 圓形標準步兵
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    }
    ctx.fill();

    // 迷你血量條
    const barW = this.radius * 2.2;
    const barH = 3.5;
    const barX = this.x - barW / 2;
    const barY = this.y - this.radius - 8;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(barX, barY, barW, barH);

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#eab308" : "#ef4444";
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.restore();
  }
}

// 實體：飛射子彈 (Projectiles)
class Projectile {
  constructor(x, y, target, type, damage, color, speed, splash = 0) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.type = type;
    this.damage = damage;
    this.color = color;
    this.speed = speed;
    this.splash = splash;
    this.alive = true;
  }

  update(dt, enemies, particles) {
    if (!this.alive) return;
    if (!this.target.alive) {
      this.alive = false;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= step || dist < 10) {
      this.hit(enemies, particles);
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  hit(enemies, particles) {
    this.alive = false;

    if (this.splash > 0) {
      // 範圍濺射爆炸
      audio.playExplosion();
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 80 + 20;
        particles.push(new Particle(
          this.x, this.y, this.color,
          Math.cos(a) * spd,
          Math.sin(a) * spd,
          0.35,
          3
        ));
      }

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d <= this.splash) {
          enemy.takeDamage(this.damage, particles);
        }
      }
    } else {
      // 單體命中
      this.target.takeDamage(this.damage, particles);
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.type === "missile" ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 輔助函式：點到線段距離計算 (用於磁軌砲射線判定)
function distToSegment(p1, p2, p) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (p1.x + t * dx), p.y - (p1.y + t * dy));
}
