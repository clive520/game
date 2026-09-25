/**
 * 《星際泡泡龍：光子消消樂》視覺實體 (Entities)
 * 包含：立體玻璃光澤泡泡繪製、發射砲台 (Cannon)、飛行拋射球 (ShootingBubble)、自由落體脫落泡泡 (FallingBubble)、爆裂粒子 (Particle)
 */

class BubbleDrawer {
  // 繪製具備 3D 球體立體感、高光反射與幾何圖騰的玻璃泡泡
  static drawBubble(ctx, x, y, radius, colorKey, scale = 1, alpha = 1) {
    const config = window.BUBBLE_COLORS[colorKey] || window.BUBBLE_COLORS.red;

    ctx.save();
    ctx.translate(x, y);
    if (scale !== 1) ctx.scale(scale, scale);
    if (alpha !== 1) ctx.globalAlpha = alpha;

    const r = radius;

    // 1. 外圍發光光暈 (Outer Glow)
    ctx.shadowColor = config.glow;
    ctx.shadowBlur = 10;

    // 2. 泡泡球體主體漸層 (Spherical 3D Radial Gradient)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, config.hex);
    grad.addColorStop(0.85, config.dark);
    grad.addColorStop(1, "rgba(0, 0, 0, 0.6)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 3. 內嵌晶瑩幾何圖騰 (色盲輔助與科技感)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = `bold ${Math.round(r * 0.9)}px 'JetBrains Mono', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.symbol, 0, 1);

    // 4. 球體頂端高光圓弧 (Curved Specular Highlight)
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.35, r * 0.35, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // 5. 邊緣微光外環
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

// 自由落體脫落的懸空泡泡 (Orphan Cascade Falling Bubble)
class FallingBubble {
  constructor(x, y, color, radius) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.vx = (Math.random() - 0.5) * 160;
    this.vy = -Math.random() * 120 - 40; // 微幅向上拋跳後墜落
    this.gravity = 1100;
    this.rot = 0;
    this.rotSpeed = (Math.random() - 0.5) * 6;
    this.alive = true;
  }

  update(dt, canvasHeight) {
    this.x += this.vx * dt;
    this.vy += this.gravity * dt;
    this.y += this.vy * dt;
    this.rot += this.rotSpeed * dt;

    if (this.y > canvasHeight + 50) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    BubbleDrawer.drawBubble(ctx, 0, 0, this.radius, this.color);
    ctx.restore();
  }
}

// 爆破碎屑粒子與文字浮現 (Particle & Float Text)
class BubbleParticle {
  constructor(x, y, color, vx, vy, maxLife = 0.4, size = 4, text = null) {
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

// 發射中的光子泡泡 (Flying Projectile)
class ShootingBubble {
  constructor(x, y, angle, color, radius, speed = 1050) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alive = true;
  }

  update(dt, canvasWidth) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 左右側壁鏡面折射反彈
    if (this.x - this.radius <= 0) {
      this.x = this.radius;
      this.vx = -this.vx;
      window.bubbleAudio.playBounce();
    } else if (this.x + this.radius >= canvasWidth) {
      this.x = canvasWidth - this.radius;
      this.vx = -this.vx;
      window.bubbleAudio.playBounce();
    }
  }

  draw(ctx) {
    BubbleDrawer.drawBubble(ctx, this.x, this.y, this.radius, this.color);
  }
}

// 底部旋轉發射砲台 (Cannon Turret)
class CannonTurret {
  constructor(x, y, radius = 22) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.angle = -Math.PI / 2; // 預設直衝上方 90°
    this.targetAngle = -Math.PI / 2;

    this.currentBubble = null;
    this.nextBubble = null;
    this.isSwapping = false;
    this.swapAnim = 0; // 0 ~ 1
  }

  setColors(current, next) {
    this.currentBubble = current;
    this.nextBubble = next;
  }

  swapBubbles() {
    if (!this.currentBubble || !this.nextBubble) return;
    const temp = this.currentBubble;
    this.currentBubble = this.nextBubble;
    this.nextBubble = temp;
    window.bubbleAudio.playSwap();
    this.isSwapping = true;
    this.swapAnim = 1.0;
  }

  aimAt(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    let rad = Math.atan2(dy, dx);

    // 限制俯仰角度（避免水平往下朝自己打）
    // 允許範圍：-165° 到 -15° (即向上扇形範圍)
    const minAngle = -Math.PI * 0.92;
    const maxAngle = -Math.PI * 0.08;
    this.angle = Math.max(minAngle, Math.min(maxAngle, rad));
  }

  update(dt) {
    if (this.isSwapping) {
      this.swapAnim -= 6 * dt;
      if (this.swapAnim <= 0) {
        this.swapAnim = 0;
        this.isSwapping = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();

    // 1. 備用球基座 (Next Bubble Pedestal - 位於砲台左側)
    const nextPedestalX = this.x - 70;
    const nextPedestalY = this.y + 6;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(nextPedestalX, nextPedestalY, this.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 備用球標籤提示
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px 'JetBrains Mono', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT [C]", nextPedestalX, nextPedestalY + this.radius + 16);

    // 繪製備用球
    if (this.nextBubble) {
      BubbleDrawer.drawBubble(ctx, nextPedestalX, nextPedestalY, this.radius * 0.85, this.nextBubble);
    }

    // 2. 砲台主機甲底座 (Base Ring)
    ctx.shadowColor = "rgba(0, 240, 255, 0.5)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. 旋轉發射砲管 (Rotating Barrel)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 幾何砲管軌道護板
    ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";

    const barrelLength = 45;
    ctx.beginPath();
    ctx.rect(0, -this.radius * 0.65, barrelLength, this.radius * 1.3);
    ctx.fill();
    ctx.stroke();

    // 砲管前端能量環
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrelLength, -this.radius * 0.65);
    ctx.lineTo(barrelLength, this.radius * 0.65);
    ctx.stroke();

    ctx.restore();

    // 4. 砲膛內當前裝填球 (Current Loaded Bubble)
    if (this.currentBubble) {
      BubbleDrawer.drawBubble(ctx, this.x, this.y, this.radius, this.currentBubble);
    }

    ctx.restore();
  }
}

window.BubbleDrawer = BubbleDrawer;
window.FallingBubble = FallingBubble;
window.BubbleParticle = BubbleParticle;
window.ShootingBubble = ShootingBubble;
window.CannonTurret = CannonTurret;
