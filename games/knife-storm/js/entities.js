/**
 * 《飛刀大作戰：月牙刃風暴》實體系統 (Entities)
 * 包含：月牙飛刀 (CrescentBlade)、地面飛刀氣泡 (LooseKnifeBubble)、角色與AI俠客 (Character)、火花粒子 (SparkParticle)
 */

const BLADE_SKINS = {
  gold: { name: "金陽月牙刃", outer: "#fbbf24", inner: "#f59e0b", glow: "rgba(251, 191, 36, 0.8)", trail: "#fef08a" },
  emerald: { name: "碧玉龍牙刃", outer: "#10b981", inner: "#059669", glow: "rgba(16, 185, 129, 0.8)", trail: "#a7f3d0" },
  crimson: { name: "修羅血月刃", outer: "#ef4444", inner: "#b91c1c", glow: "rgba(239, 68, 68, 0.8)", trail: "#fecaca" },
  violet: { name: "幽冥紫晶刃", outer: "#c084fc", inner: "#9333ea", glow: "rgba(192, 132, 252, 0.8)", trail: "#f3e8ff" },
  cyan: { name: "星海凌霜刃", outer: "#00f0ff", inner: "#0284c7", glow: "rgba(0, 240, 255, 0.8)", trail: "#e0f2fe" }
};

// 旋轉月牙飛刀 (Crescent Blade)
class CrescentBlade {
  constructor(owner, skinKey = "gold") {
    this.owner = owner;
    this.skinKey = skinKey;
    this.angle = 0;
    this.x = 0;
    this.y = 0;
    this.radius = 14; // 刀刃碰撞半徑
    this.bladeLength = 34; // 月牙弧長
  }

  update(baseAngle, orbitRadius) {
    this.x = this.owner.x + Math.cos(baseAngle) * orbitRadius;
    this.y = this.owner.y + Math.sin(baseAngle) * orbitRadius;
    this.angle = baseAngle;
  }

  draw(ctx, skinConfig, isDefense = false) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // 刀尖順著切線旋轉方向
    ctx.rotate(this.angle + Math.PI / 2);

    const skin = skinConfig || BLADE_SKINS.gold;

    // 刀芒外發光
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = isDefense ? 16 : 8;

    // 繪製彎彎月牙刀身 (Crescent Moon Shape)
    ctx.beginPath();
    const len = this.bladeLength;
    const curve = len * 0.45;

    // 外弧
    ctx.moveTo(0, -len * 0.5);
    ctx.quadraticCurveTo(curve * 1.5, 0, 0, len * 0.5);
    // 內弧回折
    ctx.quadraticCurveTo(curve * 0.35, 0, 0, -len * 0.5);
    ctx.closePath();

    // 漸層填充 (金屬漸層 + 刀背反光)
    const grad = ctx.createLinearGradient(0, -len * 0.5, curve, len * 0.5);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, skin.outer);
    grad.addColorStop(0.85, skin.inner);
    grad.addColorStop(1, "#18181b");

    ctx.fillStyle = grad;
    ctx.fill();

    // 刀刃鋒利外線
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = isDefense ? 2.2 : 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

// 散落於競技場地面的飛刀氣泡 (Loose Knife Bubble)
class LooseKnifeBubble {
  constructor(x, y, skinKey = "emerald") {
    this.x = x;
    this.y = y;
    this.skinKey = skinKey;
    this.radius = 18; // 氣泡拾取半徑
    this.floatTimer = Math.random() * Math.PI * 2;
    this.alive = true;
  }

  update(dt) {
    this.floatTimer += 2.5 * dt;
  }

  draw(ctx) {
    const offsetY = Math.sin(this.floatTimer) * 4;
    const skin = BLADE_SKINS[this.skinKey] || BLADE_SKINS.emerald;

    ctx.save();
    ctx.translate(this.x, this.y + offsetY);

    // 1. 晶瑩剔透外圍能量氣泡 (Translucent Glass Bubble)
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 12;

    const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, this.radius);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    grad.addColorStop(0.4, skin.glow);
    grad.addColorStop(0.9, "rgba(15, 23, 42, 0.4)");
    grad.addColorStop(1, skin.outer);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. 氣泡內部旋轉懸浮的微型月牙飛刀
    ctx.rotate(this.floatTimer * 0.8);
    ctx.beginPath();
    const len = 18;
    const curve = 8;
    ctx.moveTo(0, -len * 0.5);
    ctx.quadraticCurveTo(curve, 0, 0, len * 0.5);
    ctx.quadraticCurveTo(curve * 0.2, 0, 0, -len * 0.5);
    ctx.closePath();

    ctx.fillStyle = skin.outer;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

// 激烈火花與擊殺飄字粒子 (Spark Particle)
class SparkParticle {
  constructor(x, y, color, vx, vy, maxLife = 0.35, size = 3, text = null) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.size = size;
    this.text = text;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.text) {
      ctx.fillStyle = this.color;
      ctx.font = `bold ${this.size}px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fillText(this.text, this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 俠客角色與 AI 對手 (Character)
class Character {
  constructor(config) {
    this.id = config.id || Math.random().toString();
    this.name = config.name || "無名俠客";
    this.isPlayer = config.isPlayer || false;
    this.x = config.x || 600;
    this.y = config.y || 600;
    this.vx = 0;
    this.vy = 0;
    this.targetX = this.x;
    this.targetY = this.y;
    this.radius = 24; // 角色實體受擊半徑
    this.alive = true;

    // 飛刀陣
    this.skinKey = config.skinKey || "gold";
    this.skinConfig = BLADE_SKINS[this.skinKey] || BLADE_SKINS.gold;
    this.blades = [];
    this.initBlades(config.initialKnives || 3);

    // 姿態："normal" (進攻/移動) | "defense" (金鐘罩縮身) | "boost" (衝刺)
    this.stance = "normal";
    this.rotationAngle = 0;
    this.baseSpeed = 220; // 基礎移動速度 (px/s)
    this.kills = 0;

    // 衝刺能量
    this.boostEnergy = 100;
    this.maxBoostEnergy = 100;

    // AI 行為定時器
    this.aiTimer = Math.random() * 2;
    this.aiState = "collect"; // "collect" | "hunt" | "flee" | "defend"
    this.aiTarget = null;
  }

  initBlades(count) {
    this.blades = [];
    for (let i = 0; i < count; i++) {
      this.blades.push(new CrescentBlade(this, this.skinKey));
    }
  }

  addKnife() {
    this.blades.push(new CrescentBlade(this, this.skinKey));
  }

  removeKnife() {
    if (this.blades.length > 0) {
      return this.blades.pop();
    }
    return null;
  }

  get knifeCount() {
    return this.blades.length;
  }

  // 取得目前飛刀公轉軌道半徑
  getOrbitRadius() {
    const n = this.blades.length;
    if (this.stance === "defense") {
      // 防禦態向內縮緊，極速護體
      return Math.min(65, 30 + n * 0.7);
    }
    // 進攻態向外舒展
    return Math.min(180, 52 + n * 2.2);
  }

  // 取得公轉角速度 (rad/s)
  getSpinSpeed() {
    if (this.stance === "defense") {
      return 11.5; // 金鐘罩極速旋轉 (約每秒 1.8 圈)
    }
    return 3.8 + Math.min(2.5, this.blades.length * 0.08);
  }

  update(dt, arenaBounds) {
    if (!this.alive) return;

    // 1. 姿態與角速度推進
    const spinSpeed = this.getSpinSpeed();
    this.rotationAngle += spinSpeed * dt;

    // 2. 移動邏輯與速度加成
    let speed = this.baseSpeed;
    if (this.stance === "boost" && this.boostEnergy > 0) {
      speed *= 1.6;
      this.boostEnergy = Math.max(0, this.boostEnergy - 35 * dt);
      if (this.boostEnergy <= 0) this.stance = "normal";
    } else {
      this.boostEnergy = Math.min(this.maxBoostEnergy, this.boostEnergy + 18 * dt);
    }

    if (this.stance === "defense") {
      speed *= 0.35; // 防禦時步伐放緩沉穩
    }

    this.x += this.vx * speed * dt;
    this.y += this.vy * speed * dt;

    // 邊界限制
    if (arenaBounds) {
      this.x = Math.max(arenaBounds.minX + this.radius, Math.min(arenaBounds.maxX - this.radius, this.x));
      this.y = Math.max(arenaBounds.minY + this.radius, Math.min(arenaBounds.maxY - this.radius, this.y));
    }

    // 3. 更新所有環繞飛刀的即時座標
    const orbitRadius = this.getOrbitRadius();
    const count = this.blades.length;
    for (let i = 0; i < count; i++) {
      const bladeAngle = this.rotationAngle + (i / count) * Math.PI * 2;
      this.blades[i].update(bladeAngle, orbitRadius);
    }
  }

  // AI 自動決策邏輯
  updateAI(dt, allCharacters, looseBubbles, safeZone) {
    if (this.isPlayer || !this.alive) return;

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.5 + Math.random() * 0.8;

      // 1. 優先檢查是否在毒圈外，若在圈外立即返回毒圈中心！
      if (safeZone) {
        const distToCenter = Math.hypot(this.x - safeZone.x, this.y - safeZone.y);
        if (distToCenter > safeZone.radius * 0.75) {
          const angle = Math.atan2(safeZone.y - this.y, safeZone.x - this.x);
          this.vx = Math.cos(angle);
          this.vy = Math.sin(angle);
          this.stance = "normal";
          return;
        }
      }

      // 2. 搜尋周圍最近的對手
      let nearestEnemy = null;
      let minEnemyDist = Infinity;
      for (const other of allCharacters) {
        if (other === this || !other.alive) continue;
        const d = Math.hypot(this.x - other.x, this.y - other.y);
        if (d < minEnemyDist) {
          minEnemyDist = d;
          nearestEnemy = other;
        }
      }

      // 3. 根據刀數差制定戰術
      if (nearestEnemy && minEnemyDist < 360) {
        const diff = this.knifeCount - nearestEnemy.knifeCount;

        if (diff >= 3) {
          // 我方優勢：追擊獵殺！
          this.aiState = "hunt";
          const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
          this.vx = Math.cos(angle);
          this.vy = Math.sin(angle);
          this.stance = (this.boostEnergy > 40 && minEnemyDist < 250) ? "boost" : "normal";
          return;
        } else if (diff <= -2) {
          // 敵方強勢：逃離避險或開金鐘罩自保！
          if (minEnemyDist < 160) {
            this.aiState = "defend";
            this.stance = "defense"; // 緊貼防禦彈刀！
            const angle = Math.atan2(this.y - nearestEnemy.y, this.x - nearestEnemy.x);
            this.vx = Math.cos(angle);
            this.vy = Math.sin(angle);
          } else {
            this.aiState = "flee";
            this.stance = (this.boostEnergy > 30) ? "boost" : "normal";
            const angle = Math.atan2(this.y - nearestEnemy.y, this.x - nearestEnemy.x);
            this.vx = Math.cos(angle);
            this.vy = Math.sin(angle);
          }
          return;
        }
      }

      // 4. 平常狀態：搜尋最近的飛刀氣泡吃刀升級
      let nearestBubble = null;
      let minBubbleDist = Infinity;
      for (const b of looseBubbles) {
        if (!b.alive) continue;
        const d = Math.hypot(this.x - b.x, this.y - b.y);
        if (d < minBubbleDist) {
          minBubbleDist = d;
          nearestBubble = b;
        }
      }

      if (nearestBubble) {
        this.aiState = "collect";
        this.stance = "normal";
        const angle = Math.atan2(nearestBubble.y - this.y, nearestBubble.x - this.x);
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
      } else {
        // 隨機遊走
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
        this.stance = "normal";
      }
    }
  }

  draw(ctx, isLeader = false) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const isDef = (this.stance === "defense");

    // 1. 金鐘罩防禦氣罩光環 (Defensive Golden Aura)
    if (isDef) {
      ctx.shadowColor = this.skinConfig.glow;
      ctx.shadowBlur = 24;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.getOrbitRadius() + 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fill();
    }

    // 2. 俠客本體繪製 (武俠俠客造型)
    // 陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.85, this.radius * 0.9, this.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 俠客長袍
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.isPlayer ? "#1e293b" : "#334155";
    ctx.strokeStyle = this.skinConfig.outer;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 武俠腰帶飾帶
    ctx.fillStyle = this.skinConfig.outer;
    ctx.fillRect(-this.radius * 0.7, -2, this.radius * 1.4, 5);

    // 俠客頭巾 / 發簪
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(this.radius * 0.85)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.isPlayer ? "🥷" : "🥋", 0, -2);

    // 3. 霸主金皇冠標誌 (Leader Crown)
    if (isLeader) {
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 10;
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("👑", 0, -this.radius - 18);
    }

    // 4. 角色名與飛刀等級標籤 (Name Tag & Knife Count)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(-45, -this.radius - 14, 90, 16);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-45, -this.radius - 14, 90, 16);

    ctx.fillStyle = this.isPlayer ? "#38bdf8" : "#f8fafc";
    ctx.font = "bold 10px 'JetBrains Mono', sans-serif";
    ctx.fillText(`${this.name} (${this.knifeCount}刃)`, 0, -this.radius - 6);

    ctx.restore();

    // 5. 繪製環繞飛刀陣 (Orbiting Blades)
    for (const b of this.blades) {
      b.draw(ctx, this.skinConfig, isDef);
    }
  }
}

window.BLADE_SKINS = BLADE_SKINS;
window.CrescentBlade = CrescentBlade;
window.LooseKnifeBubble = LooseKnifeBubble;
window.SparkParticle = SparkParticle;
window.Character = Character;
