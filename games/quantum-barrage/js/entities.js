/**
 * 量子彈幕實體模組 (Entities Module)
 * 玩家戰機 (雙相維度)、子彈 (藍/紅)、敵人軍團、Boss 與粒子系統
 */

// 粒子與飄字
class Particle {
  constructor(x, y, color, vx, vy, life = 0.4, size = 3, text = null) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.text = text;
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

    if (this.text) {
      ctx.fillStyle = this.color;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.text, this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 實體：玩家戰機 (Quantum Fighter)
class PlayerShip {
  constructor(canvasWidth, canvasHeight) {
    this.cw = canvasWidth;
    this.ch = canvasHeight;
    this.x = canvasWidth / 2;
    this.y = canvasHeight - 100;
    this.speed = 360;

    // 核心判定半徑 (微判定點)
    this.coreRadius = 3.5;
    this.grazeRadius = 26;
    this.visualRadius = 16;

    // 維度相位: 'blue' (Alpha) 或 'pink' (Beta)
    this.phase = "blue";

    // 狀態
    this.lives = 3;
    this.maxLives = 5;
    this.energy = 0; // 0 ~ 100
    this.maxEnergy = 100;
    this.invulnerableTimer = 0;

    // 武器等級 (Lv.1 ~ Lv.5 MAX)
    this.weaponLevel = 1;
    this.maxWeaponLevel = 5;
    this.missileTimer = 0;
    this.missileInterval = 0.35;

    // 自動射擊計時
    this.shootTimer = 0;
    this.shootInterval = 0.085;
  }

  togglePhase() {
    this.phase = this.phase === "blue" ? "pink" : "blue";
    audio.playShift();
    return this.phase;
  }

  upgradeWeapon() {
    if (this.weaponLevel < this.maxWeaponLevel) {
      this.weaponLevel++;
      audio.playPowerUp();
      return true;
    }
    return false;
  }

  addLife() {
    if (this.lives < this.maxLives) {
      this.lives++;
      audio.playItemPickup();
      return true;
    }
    return false;
  }

  takeHit(particles) {
    if (this.invulnerableTimer > 0) return false;
    this.lives--;
    // 受傷稍微降低一級武器（保底 Lv.1）以增加挑戰張力
    if (this.weaponLevel > 1) {
      this.weaponLevel--;
    }
    this.invulnerableTimer = 2.0; // 2秒無敵
    audio.playHit();

    // 震盪粒子
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 200 + 50;
      particles.push(new Particle(
        this.x, this.y, "#f43f5e",
        Math.cos(a) * spd, Math.sin(a) * spd, 0.5, 3
      ));
    }
    return true;
  }

  addEnergy(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  canUseNova() {
    return this.energy >= this.maxEnergy;
  }

  useNova() {
    if (!this.canUseNova()) return false;
    this.energy = 0;
    audio.playNova();
    return true;
  }

  update(dt, keys, mousePos, isMouseMode, bullets, particles, enemies) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // 1. 移動控制 (滑鼠跟隨 或 WASD/方向鍵)
    if (isMouseMode && mousePos) {
      const dx = mousePos.x - this.x;
      const dy = mousePos.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const step = Math.min(dist, this.speed * 1.5 * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    } else {
      let mx = 0;
      let my = 0;
      if (keys["w"] || keys["arrowup"]) my -= 1;
      if (keys["s"] || keys["arrowdown"]) my += 1;
      if (keys["a"] || keys["arrowleft"]) mx -= 1;
      if (keys["d"] || keys["arrowright"]) mx += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        this.x += (mx / len) * this.speed * dt;
        this.y += (my / len) * this.speed * dt;
      }
    }

    // 邊界防出界約束
    this.x = Math.max(this.visualRadius, Math.min(this.cw - this.visualRadius, this.x));
    this.y = Math.max(this.visualRadius, Math.min(this.ch - this.visualRadius, this.y));

    // 2. 尾焰發光粒子
    if (Math.random() < 0.6) {
      const color = this.phase === "blue" ? "#00f0ff" : "#ff007f";
      particles.push(new Particle(
        this.x + (Math.random() - 0.5) * 6,
        this.y + 14,
        color,
        (Math.random() - 0.5) * 20,
        Math.random() * 80 + 100,
        0.25,
        2.5
      ));
    }

    // 3. 自動發射光子主砲 (隨武器等級爆發強化)
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.shootInterval;
      audio.playShoot();

      const color = this.phase === "blue" ? "#00f0ff" : "#ff007f";
      const dmg = 12 + this.weaponLevel * 3;

      if (this.weaponLevel === 1) {
        // Lv.1 雙聯光子砲
        bullets.push(new Bullet(this.x - 7, this.y - 12, 0, -850, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 7, this.y - 12, 0, -850, "player", this.phase, color, dmg));
      } else if (this.weaponLevel === 2) {
        // Lv.2 三向擴散砲
        bullets.push(new Bullet(this.x, this.y - 15, 0, -880, "player", this.phase, color, dmg + 2));
        bullets.push(new Bullet(this.x - 10, this.y - 10, -110, -860, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 10, this.y - 10, 110, -860, "player", this.phase, color, dmg));
      } else if (this.weaponLevel === 3) {
        // Lv.3 四聯暴風雷射
        bullets.push(new Bullet(this.x - 12, this.y - 10, -80, -880, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x - 4, this.y - 14, -20, -900, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 4, this.y - 14, 20, -900, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 12, this.y - 10, 80, -880, "player", this.phase, color, dmg));
      } else if (this.weaponLevel === 4) {
        // Lv.4 五向高能殲滅砲
        bullets.push(new Bullet(this.x, this.y - 16, 0, -920, "player", this.phase, color, dmg + 4));
        bullets.push(new Bullet(this.x - 8, this.y - 12, -70, -900, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 8, this.y - 12, 70, -900, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x - 16, this.y - 8, -150, -870, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 16, this.y - 8, 150, -870, "player", this.phase, color, dmg));
      } else {
        // Lv.5 (MAX HYPERION) 七向星辰風暴 + 貫穿核心主砲
        bullets.push(new Bullet(this.x, this.y - 18, 0, -980, "player", this.phase, "#ffffff", dmg + 10, 5));
        bullets.push(new Bullet(this.x - 6, this.y - 14, -40, -940, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 6, this.y - 14, 40, -940, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x - 14, this.y - 10, -120, -910, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 14, this.y - 10, 120, -910, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x - 22, this.y - 6, -200, -880, "player", this.phase, color, dmg));
        bullets.push(new Bullet(this.x + 22, this.y - 6, 200, -880, "player", this.phase, color, dmg));
      }
    }

    // 4. 等級 3 以上自動發射量子追蹤導彈 (Homing Missiles)
    if (this.weaponLevel >= 3) {
      this.missileTimer -= dt;
      if (this.missileTimer <= 0) {
        this.missileTimer = this.missileInterval;
        const color = this.phase === "blue" ? "#38bdf8" : "#fb7185";
        const missileCount = this.weaponLevel >= 5 ? 4 : 2;
        for (let i = 0; i < missileCount; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const vx = side * (160 + i * 40);
          bullets.push(new HomingMissile(
            this.x + side * 18, this.y,
            vx, -180, color, 30
          ));
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();

    const isBlinking = this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0;
    if (isBlinking) ctx.globalAlpha = 0.4;

    const mainColor = this.phase === "blue" ? "#00f0ff" : "#ff007f";
    const glowColor = this.phase === "blue" ? "rgba(0, 240, 255, 0.8)" : "rgba(255, 0, 127, 0.8)";

    // 1. 擦彈範圍柔光環 (Graze Ring)
    ctx.strokeStyle = this.phase === "blue" ? "rgba(0, 240, 255, 0.12)" : "rgba(255, 0, 127, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.grazeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 戰機外殼幾何繪製
    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 18); // 機鼻尖端
    ctx.lineTo(this.x + 14, this.y + 12); // 右機翼
    ctx.lineTo(this.x + 6, this.y + 8);
    ctx.lineTo(this.x, this.y + 14); // 機尾
    ctx.lineTo(this.x - 6, this.y + 8);
    ctx.lineTo(this.x - 14, this.y + 12); // 左機翼
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. 核心判定點 (紅/藍光點)
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 實體：彈幕子彈 (Bullet)
class Bullet {
  constructor(x, y, vx, vy, source, phase, color, damage = 10, radius = 4) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.source = source; // 'player' | 'enemy'
    this.phase = phase;   // 'blue' | 'pink'
    this.color = color;
    this.damage = damage;
    this.radius = radius;
    this.alive = true;
    this.grazed = false; // 每顆子彈只能擦彈一次
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;

    if (this.source === "player") {
      // 玩家子彈繪製為長條光束
      ctx.fillRect(this.x - 2, this.y - 8, 4, 16);
    } else {
      // 敵方彈幕繪製為光暈圓球
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // 核心高光亮點
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 實體：敵人 (Invaders & Boss)
class Enemy {
  constructor(type, x, y, canvasWidth) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.cw = canvasWidth;
    this.alive = true;
    this.time = 0;
    this.fireTimer = Math.random() * 0.5 + 0.3;

    this.initStats();
  }

  initStats() {
    switch (this.type) {
      case "drone":
        this.hp = 30;
        this.maxHp = 30;
        this.radius = 12;
        this.scoreVal = 100;
        this.color = "#38bdf8";
        this.vy = 120;
        this.vx = 0;
        break;
      case "cruiser":
        this.hp = 120;
        this.maxHp = 120;
        this.radius = 20;
        this.scoreVal = 350;
        this.color = "#a855f7";
        this.vy = 65;
        this.vx = (Math.random() - 0.5) * 80;
        break;
      case "spinner":
        this.hp = 80;
        this.maxHp = 80;
        this.radius = 16;
        this.scoreVal = 250;
        this.color = "#fbbf24";
        this.vy = 80;
        this.vx = Math.sin(this.y * 0.05) * 100;
        break;
      case "boss":
        this.hp = 1800;
        this.maxHp = 1800;
        this.radius = 42;
        this.scoreVal = 5000;
        this.color = "#f43f5e";
        this.vy = 40;
        this.vx = 80;
        this.spiralAngle = 0;
        break;
    }
  }

  takeDamage(amount, particles) {
    this.hp -= amount;
    if (this.hp <= 0 && this.alive) {
      this.alive = false;
      this.explode(particles);
    }
  }

  explode(particles) {
    audio.playExplosion();
    const count = this.type === "boss" ? 80 : 25;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 200 + 40;
      particles.push(new Particle(
        this.x, this.y, this.color,
        Math.cos(a) * spd, Math.sin(a) * spd,
        0.5, Math.random() * 3 + 2
      ));
    }
  }

  update(dt, player, bullets) {
    this.time += dt;

    // 移動行為
    if (this.type === "drone") {
      this.y += this.vy * dt;
    } else if (this.type === "cruiser") {
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.x < 30 || this.x > this.cw - 30) this.vx *= -1;
    } else if (this.type === "spinner") {
      this.y += this.vy * dt;
      this.x += Math.sin(this.time * 3) * 120 * dt;
    } else if (this.type === "boss") {
      // Boss 進場定位到頂部 120px 左右擺動
      if (this.y < 130) {
        this.y += this.vy * dt;
      } else {
        this.x += this.vx * dt;
        if (this.x < 80 || this.x > this.cw - 80) this.vx *= -1;
      }
    }

    // 彈幕發射行為
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fire(player, bullets);
    }
  }

  fire(player, bullets) {
    if (this.type === "drone") {
      this.fireTimer = 1.2;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      const phase = Math.random() < 0.5 ? "blue" : "pink";
      const color = phase === "blue" ? "#00f0ff" : "#ff007f";
      bullets.push(new Bullet(
        this.x, this.y + 10,
        Math.cos(angle) * 200, Math.sin(angle) * 200,
        "enemy", phase, color, 1, 4.5
      ));
    } else if (this.type === "cruiser") {
      this.fireTimer = 1.4;
      // 三連扇形散射
      [-0.25, 0, 0.25].forEach(offset => {
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x) + offset;
        const phase = Math.random() < 0.5 ? "blue" : "pink";
        const color = phase === "blue" ? "#00f0ff" : "#ff007f";
        bullets.push(new Bullet(
          this.x, this.y + 12,
          Math.cos(baseAngle) * 220, Math.sin(baseAngle) * 220,
          "enemy", phase, color, 1, 4.5
        ));
      });
    } else if (this.type === "spinner") {
      this.fireTimer = 0.8;
      // 8 方向環狀旋轉彈幕
      for (let i = 0; i < 6; i++) {
        const angle = this.time * 2 + (i / 6) * Math.PI * 2;
        const phase = i % 2 === 0 ? "blue" : "pink";
        const color = phase === "blue" ? "#00f0ff" : "#ff007f";
        bullets.push(new Bullet(
          this.x, this.y,
          Math.cos(angle) * 160, Math.sin(angle) * 160,
          "enemy", phase, color, 1, 4
        ));
      }
    } else if (this.type === "boss") {
      this.fireTimer = 0.22;
      this.spiralAngle += 0.35;

      // 旋轉狂暴螺旋彈幕
      for (let i = 0; i < 3; i++) {
        const a = this.spiralAngle + (i / 3) * Math.PI * 2;
        const phase = i % 2 === 0 ? "blue" : "pink";
        const color = phase === "blue" ? "#00f0ff" : "#ff007f";
        bullets.push(new Bullet(
          this.x, this.y + 15,
          Math.cos(a) * 220, Math.sin(a) * 220,
          "enemy", phase, color, 1, 5
        ));
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;

    if (this.type === "boss") {
      // 旗艦 Boss 八角護甲
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Boss 核心外環
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Boss 血量條
      const bw = 240;
      const bh = 8;
      const bx = this.x - bw / 2;
      const by = this.y - this.radius - 16;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#f43f5e";
      ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), bh);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 實體：量子導引追蹤導彈 (Homing Missile)
class HomingMissile {
  constructor(x, y, vx, vy, color, damage = 35) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.damage = damage;
    this.source = "player";
    this.radius = 4;
    this.alive = true;
    this.life = 2.4;
    this.speed = 540;
  }

  update(dt, enemies, particles) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    // 尋找最近活著的敵軍鎖定
    let closest = null;
    let minDist = 450;
    if (enemies) {
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      }
    }

    if (closest) {
      const targetAngle = Math.atan2(closest.y - this.y, closest.x - this.x);
      const curAngle = Math.atan2(this.vy, this.vx);
      let diff = targetAngle - curAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const turnSpeed = 9.5 * dt;
      const newAngle = curAngle + Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed);

      this.vx = Math.cos(newAngle) * this.speed;
      this.vy = Math.sin(newAngle) * this.speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 尾部推進粒子
    if (particles && Math.random() < 0.5) {
      particles.push(new Particle(
        this.x, this.y, this.color,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        0.2, 2
      ));
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 導彈高亮核心
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 實體：掉落寶物道具 (Drop Item)
class DropItem {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'power' (武器升級) | 'shield' (護甲回血) | 'energy' (大絕充能) | 'score' (星塵高分)
    this.radius = 13;
    this.vy = 75;
    this.vx = (Math.random() - 0.5) * 50;
    this.alive = true;
    this.time = 0;
    this.magnetized = false;
  }

  update(dt, player) {
    this.time += dt;

    // 戰機磁吸距離 140px 或全場大絕磁吸
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 140 || this.magnetized) {
      const spd = 480;
      this.x += (dx / dist) * spd * dt;
      this.y += (dy / dist) * spd * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.98;
    }

    // 左右微幅漂浮擺動
    this.x += Math.sin(this.time * 4) * 0.4;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();

    let icon = "P";
    let color = "#fbbf24";
    let glow = "rgba(251, 191, 36, 0.8)";

    if (this.type === "power") {
      icon = "⚡P";
      color = "#fbbf24"; // 金色武器升級
      glow = "rgba(251, 191, 36, 0.8)";
    } else if (this.type === "shield") {
      icon = "🛡️";
      color = "#34d399"; // 綠色護盾護甲
      glow = "rgba(52, 211, 153, 0.8)";
    } else if (this.type === "energy") {
      icon = "💎";
      color = "#a855f7"; // 紫色大絕充能
      glow = "rgba(168, 85, 247, 0.8)";
    } else if (this.type === "score") {
      icon = "⭐";
      color = "#38bdf8"; // 藍色星塵
      glow = "rgba(56, 189, 248, 0.8)";
    }

    // 旋轉發光外環
    ctx.shadowBlur = 12;
    ctx.shadowColor = glow;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 道具文字標籤
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, this.x, this.y);

    ctx.restore();
  }
}

