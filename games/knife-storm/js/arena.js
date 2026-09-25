/**
 * 《飛刀大作戰：月牙刃風暴》競技場與毒圈縮圈系統 (Arena & Safe Zone)
 * 負責地圖邊界、武道館地磚網格、散落飛刀氣泡維護、大逃殺安全區 (縮圈) 運算
 */

class Arena {
  constructor(size = 2400) {
    this.size = size;
    this.bounds = { minX: 0, maxX: size, minY: 0, maxY: size };

    // 散落飛刀氣泡陣列
    this.looseBubbles = [];
    this.maxLooseBubbles = 70;

    // 安全區 (縮圈 Battle Royale)
    this.safeZone = {
      x: size / 2,
      y: size / 2,
      radius: size * 0.52,
      minRadius: 280,
      shrinkSpeed: 7.5 // 每秒縮小像素半徑
    };

    this.roundTime = 0;
    this.initBubbles();
  }

  initBubbles() {
    this.looseBubbles = [];
    const skins = Object.keys(window.BLADE_SKINS || { gold: 1 });

    for (let i = 0; i < this.maxLooseBubbles; i++) {
      const x = Math.random() * (this.size - 200) + 100;
      const y = Math.random() * (this.size - 200) + 100;
      const skin = skins[Math.floor(Math.random() * skins.length)];
      this.looseBubbles.push(new LooseKnifeBubble(x, y, skin));
    }
  }

  // 當某位俠客陣亡時，向四周大爆散落飛刀
  spawnDeathBurst(x, y, count = 10, skinKey = "gold") {
    const burstCount = Math.min(24, Math.max(5, count));
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = Math.random() * 90 + 50;
      const bx = Math.max(60, Math.min(this.size - 60, x + Math.cos(angle) * dist));
      const by = Math.max(60, Math.min(this.size - 60, y + Math.sin(angle) * dist));
      this.looseBubbles.push(new LooseKnifeBubble(bx, by, skinKey));
    }
  }

  update(dt, characters) {
    this.roundTime += dt;

    // 1. 安全區隨時間逐漸收縮 (Shrinking Ring)
    if (this.safeZone.radius > this.safeZone.minRadius) {
      this.safeZone.radius = Math.max(this.safeZone.minRadius, this.safeZone.radius - this.safeZone.shrinkSpeed * dt);
    }

    // 2. 更新地面飛刀氣泡
    for (const b of this.looseBubbles) b.update(dt);
    this.looseBubbles = this.looseBubbles.filter(b => b.alive);

    // 定期補足地面的散落飛刀
    if (this.looseBubbles.length < this.maxLooseBubbles) {
      const skins = Object.keys(window.BLADE_SKINS || { gold: 1 });
      // 優先生成在安全區內
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (this.safeZone.radius * 0.85);
      const x = this.safeZone.x + Math.cos(angle) * r;
      const y = this.safeZone.y + Math.sin(angle) * r;
      const skin = skins[Math.floor(Math.random() * skins.length)];
      this.looseBubbles.push(new LooseKnifeBubble(x, y, skin));
    }

    // 3. 檢查圈外毒圈扣血/掉刀 (Safe Zone Damage)
    for (const c of characters) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - this.safeZone.x, c.y - this.safeZone.y);
      if (d > this.safeZone.radius) {
        c.outsideZoneTimer = (c.outsideZoneTimer || 0) + dt;
        if (c.outsideZoneTimer > 1.2) {
          c.outsideZoneTimer = 0;
          if (c.knifeCount > 1) {
            c.removeKnife();
          } else {
            c.alive = false; // 毒圈淘汰
          }
        }
      } else {
        c.outsideZoneTimer = 0;
      }
    }
  }

  draw(ctx, camera, viewWidth, viewHeight) {
    ctx.save();

    // 1. 繪製競技場擂台地磚 (Martial Arts Arena Tiled Floor - 與截圖相同古樸武俠地磚)
    const tileSize = 80;
    const startX = Math.max(0, Math.floor(camera.x / tileSize) * tileSize);
    const startY = Math.max(0, Math.floor(camera.y / tileSize) * tileSize);
    const endX = Math.min(this.size, startX + viewWidth + tileSize * 2);
    const endY = Math.min(this.size, startY + viewHeight + tileSize * 2);

    for (let x = startX; x < endX; x += tileSize) {
      for (let y = startY; y < endY; y += tileSize) {
        const isAlt = ((x / tileSize + y / tileSize) % 2 === 0);
        ctx.fillStyle = isAlt ? "#2d2424" : "#241d1d";
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // 2. 競技場外圍邊界高牆
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, this.size, this.size);

    // 3. 繪製散落飛刀氣泡
    for (const b of this.looseBubbles) {
      // 視角剔除優化 (Frustum Culling)
      if (b.x >= camera.x - 40 && b.x <= camera.x + viewWidth + 40 &&
          b.y >= camera.y - 40 && b.y <= camera.y + viewHeight + 40) {
        b.draw(ctx);
      }
    }

    // 4. 繪製大逃殺收縮毒圈光環 (Hazardous Electric Ring)
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(this.safeZone.x, this.safeZone.y, this.safeZone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // 毒圈外部半透明紫色警示陰影 (Outside Safe Zone Fog)
    ctx.fillStyle = "rgba(88, 28, 135, 0.18)";
    ctx.beginPath();
    ctx.rect(0, 0, this.size, this.size);
    ctx.arc(this.safeZone.x, this.safeZone.y, this.safeZone.radius, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.restore();
  }
}

window.Arena = Arena;
