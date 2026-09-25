/**
 * 《星際泡泡龍：光子消消樂》萌系六角蜂巢視覺實體 (Cute Hexagon Entities)
 * 包含：超萌蜂巢六角形果凍怪 (Honeycomb Jelly Hexagons)、萌萌小神龍發射台 (Chibi Dragon Cannon)、
 * 自由落體脫落泡泡 (FallingBubble)、爆裂碎屑與飄字 (BubbleParticle)
 */

class BubbleDrawer {
  // 繪製蜂巢狀六角形糖果果凍怪 (具備 6 角幾何晶體與萌系大眼腮紅表情)
  static drawBubble(ctx, x, y, radius, colorKey, scale = 1, alpha = 1, expression = "normal") {
    const config = window.BUBBLE_COLORS[colorKey] || window.BUBBLE_COLORS.red;

    ctx.save();
    ctx.translate(x, y);
    if (scale !== 1) ctx.scale(scale, scale);
    if (alpha !== 1) ctx.globalAlpha = alpha;

    const r = radius;
    // 蜂巢六角形外接半徑 (讓相鄰六角格邊對邊自然密合)
    const hexRadius = r * 1.1;

    // 1. 繪製六角蜂巢外框路徑 (點角頂在 30°, 90°, 150°, 210°, 270°, 330°)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI / 3) + Math.PI / 6;
      const hx = Math.cos(angle) * hexRadius;
      const hy = Math.sin(angle) * hexRadius;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    // 柔和果凍外發光
    ctx.shadowColor = config.glow;
    ctx.shadowBlur = 10;

    // 2. 蜂巢果凍糖果漸層填充 (Cute Candy Gradient)
    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, hexRadius);
    grad.addColorStop(0, config.light || "#ffffff");
    grad.addColorStop(0.45, config.hex);
    grad.addColorStop(1, config.dark);

    ctx.fillStyle = grad;
    ctx.fill();

    // 3. 晶亮蜂巢糖果稜線與邊框 (Bevel Stroke)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 頂部月牙高光 (Glossy Highlight)
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.45, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. 超萌卡通表情繪製 (Kawaii Anime Faces)
    this.drawCuteFace(ctx, r, config, expression);

    ctx.restore();
  }

  // 繪製萌系大眼睛、粉紅腮紅與多樣化笑容
  static drawCuteFace(ctx, r, config, expression = "normal") {
    const eyeDist = r * 0.34;
    const eyeY = -r * 0.05;
    const eyeRadius = Math.max(2.5, r * 0.18);

    // A. 萌萌粉紅橢圓腮紅 (Blushing Cheeks)
    ctx.fillStyle = config.blush || "#ffa8a8";
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.ellipse(-r * 0.52, r * 0.14, r * 0.2, r * 0.11, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.52, r * 0.14, r * 0.2, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 若為特殊球，優先繪製其專屬萌符號
    if (config.type === "bomb") {
      // 搗蛋小炸彈：俏皮惡魔眼 + 頂端可愛引信
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(r * 0.95)}px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💣", 0, 0);
      return;
    } else if (config.type === "laser") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(r * 0.95)}px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡", 0, 0);
      return;
    } else if (config.type === "rainbow") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(r * 0.95)}px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🌈", 0, 0);
      return;
    }

    // B. 大眼睛繪製
    ctx.fillStyle = config.eye || "#1e1b4b";

    if (expression === "falling" || expression === "shocked") {
      // 驚訝大圓眼 ( ° △ ° )
      ctx.beginPath();
      ctx.arc(-eyeDist, eyeY, eyeRadius * 1.2, 0, Math.PI * 2);
      ctx.arc(eyeDist, eyeY, eyeRadius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-eyeDist + 1, eyeY - 1, eyeRadius * 0.5, 0, Math.PI * 2);
      ctx.arc(eyeDist + 1, eyeY - 1, eyeRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // 小張嘴 O
      ctx.strokeStyle = config.eye || "#1e1b4b";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, r * 0.22, r * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    // 依顏色賦予不同的萌萌眼神
    if (config.type === "green") {
      // 奇異綠：微笑彎彎瞇瞇眼 ( ⌒ ‿ ⌒ )
      ctx.strokeStyle = config.eye || "#052e16";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(-eyeDist, eyeY + 1, eyeRadius * 1.1, Math.PI, 0);
      ctx.arc(eyeDist, eyeY + 1, eyeRadius * 1.1, Math.PI, 0);
      ctx.stroke();
    } else if (config.type === "yellow") {
      // 檸檬黃：眨單眼萌笑 ( > ‿ ◕ )
      // 左眼眨眼 >
      ctx.strokeStyle = config.eye || "#422006";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-eyeDist - eyeRadius, eyeY - eyeRadius * 0.6);
      ctx.lineTo(-eyeDist + eyeRadius * 0.5, eyeY);
      ctx.lineTo(-eyeDist - eyeRadius, eyeY + eyeRadius * 0.6);
      ctx.stroke();

      // 右眼水汪汪大眼
      ctx.beginPath();
      ctx.arc(eyeDist, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
      // 右眼光斑
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(eyeDist - 1.2, eyeY - 1.2, eyeRadius * 0.45, 0, Math.PI * 2);
      ctx.arc(eyeDist + 1.2, eyeY + 1.2, eyeRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 經典水汪汪大眼睛 ( ◕ ‿ ◕ )
      ctx.beginPath();
      ctx.arc(-eyeDist, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.arc(eyeDist, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // 雙光斑反射 (Anime Eyes Specular Highlight)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-eyeDist - 1.2, eyeY - 1.2, eyeRadius * 0.45, 0, Math.PI * 2);
      ctx.arc(eyeDist - 1.2, eyeY - 1.2, eyeRadius * 0.45, 0, Math.PI * 2);
      ctx.arc(-eyeDist + 1.2, eyeY + 1.2, eyeRadius * 0.25, 0, Math.PI * 2);
      ctx.arc(eyeDist + 1.2, eyeY + 1.2, eyeRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // C. 甜美小微笑 (Smile Mouth)
    ctx.strokeStyle = config.eye || "#1e1b4b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r * 0.16, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
}

// 自由落體脫落的蜂巢果凍怪 (Orphan Falling Jelly)
class FallingBubble {
  constructor(x, y, color, radius) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.vx = (Math.random() - 0.5) * 180;
    this.vy = -Math.random() * 120 - 40;
    this.gravity = 1100;
    this.rot = 0;
    this.rotSpeed = (Math.random() - 0.5) * 5;
    this.alive = true;
  }

  update(dt, canvasHeight) {
    this.x += this.vx * dt;
    this.vy += this.gravity * dt;
    this.y += this.vy * dt;
    this.rot += this.rotSpeed * dt;

    if (this.y > canvasHeight + 60) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    BubbleDrawer.drawBubble(ctx, 0, 0, this.radius, this.color, 1, 1, "falling");
    ctx.restore();
  }
}

// 爆破碎屑彩光粒子與文字浮現
class BubbleParticle {
  constructor(x, y, color, vx, vy, maxLife = 0.45, size = 4, text = null) {
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
      ctx.shadowBlur = 12;
      ctx.fillText(this.text, this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      // 小六角星芒碎屑
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 發射中的六角果凍球 (Flying Honeycomb Jelly)
class ShootingBubble {
  constructor(x, y, angle, color, radius, speed = 1100) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rot = 0;
    this.alive = true;
  }

  update(dt, canvasWidth) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += 12 * dt; // 飛行時旋轉

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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    BubbleDrawer.drawBubble(ctx, 0, 0, this.radius, this.color);
    ctx.restore();
  }
}

// 底部萌萌小恐龍發射砲台 (Chibi Baby Dragon Cannon)
class CannonTurret {
  constructor(x, y, radius = 22) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.angle = -Math.PI / 2; // 直衝上方
    this.targetAngle = -Math.PI / 2;

    this.currentBubble = null;
    this.nextBubble = null;
    this.isSwapping = false;
    this.swapAnim = 0;
    this.blinkTimer = 0;
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

    const minAngle = -Math.PI * 0.92;
    const maxAngle = -Math.PI * 0.08;
    this.angle = Math.max(minAngle, Math.min(maxAngle, rad));
  }

  update(dt) {
    this.blinkTimer += dt;
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

    // 1. 備用球基座 (左側甜甜圈星星底座)
    const nextPedestalX = this.x - 72;
    const nextPedestalY = this.y + 4;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 107, 139, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nextPedestalX, nextPedestalY, this.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ff6b8b";
    ctx.font = "bold 11px 'JetBrains Mono', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT [C]", nextPedestalX, nextPedestalY + this.radius + 18);

    if (this.nextBubble) {
      BubbleDrawer.drawBubble(ctx, nextPedestalX, nextPedestalY, this.radius * 0.82, this.nextBubble);
    }

    // 2. 萌萌泡泡小恐龍主體 (Chibi Dragon Body)
    ctx.save();
    ctx.translate(this.x, this.y + 12);

    // 小龍身體 (胖嘟嘟薄荷綠色身軀)
    ctx.fillStyle = "#38d9a9";
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.5, this.radius * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 小龍白黃色小肚肚
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.ellipse(0, 4, this.radius * 0.95, this.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // 背後可愛背鰭刺刺
    ctx.fillStyle = "#ff6b8b";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * 14, -this.radius * 1.1, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 3. 旋轉發射瞄準雙手與導向指針 (Dragon Paws & Aiming Pointer)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 魔法透明彩虹箭頭軌道
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.1, 0);
    ctx.lineTo(this.radius * 2.3, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 恐龍可愛小爪爪捧著泡泡
    ctx.fillStyle = "#20c997";
    ctx.beginPath();
    ctx.arc(this.radius * 0.8, -this.radius * 0.65, 6, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.8, this.radius * 0.65, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. 龍頭可愛大眼睛與微笑 (位於砲台中央下方，面對玩家微笑)
    ctx.save();
    ctx.translate(this.x, this.y + 10);

    // 可愛粉紅腮紅
    ctx.fillStyle = "rgba(255, 107, 139, 0.6)";
    ctx.beginPath();
    ctx.arc(-18, 2, 5, 0, Math.PI * 2);
    ctx.arc(18, 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // 大萌眼 (定期眨眼)
    const isBlinking = (Math.sin(this.blinkTimer * 3) > 0.97);
    if (isBlinking) {
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-8, -2);
      ctx.moveTo(8, -2);
      ctx.lineTo(16, -2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#052e16";
      ctx.beginPath();
      ctx.arc(-12, -2, 4.5, 0, Math.PI * 2);
      ctx.arc(12, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // 眼睛光斑
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-13.5, -3.5, 1.8, 0, Math.PI * 2);
      ctx.arc(10.5, -3.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 吐小舌頭/甜美微笑
    ctx.strokeStyle = "#052e16";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 4, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();

    // 5. 砲膛內當前裝填發射的六角果凍怪
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
