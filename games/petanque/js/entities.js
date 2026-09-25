/**
 * 《法式滾球：普羅旺斯大師》視覺實體與皮尺系統 (Entities & Tape Measure)
 * 包含：金屬鋼球 (Boule)、目標小木球 (Cochonnet)、沙塵與火花粒子 (Particle)、距離測量皮尺
 */

// 金屬鐵球 (Steel Boule) 與 目標小木球 (Cochonnet)
class Boule {
  constructor(config) {
    this.id = config.id || Math.random().toString();
    this.team = config.team || "blue"; // "blue" (玩家/藍隊) | "red" (AI/紅隊) | "jack" (目標球)
    this.isJack = (this.team === "jack");

    this.x = config.x || 0;
    this.y = config.y || 0;
    this.z = config.z || 0; // 高度 (Z 軸)
    this.vx = config.vx || 0;
    this.vy = config.vy || 0;
    this.vz = config.vz || 0;

    // 半徑與質量 (鐵球較重直徑約 74mm，小木球約 30mm)
    this.radius = this.isJack ? 9.5 : 17.5;
    this.mass = this.isJack ? 0.16 : 1.0;

    this.isStopped = false;
    this.grooveAngle = Math.random() * Math.PI * 2;
    this.stripes = config.stripes || (this.team === "blue" ? 2 : 3);
  }

  // 繪製球體本體與立體陰影 (2.5D 立體投影)
  draw(ctx) {
    const scale = 1 + (this.z * 0.0025);
    const drawRadius = this.radius * scale;
    const shadowY = this.y;
    const ballY = this.y - this.z;

    ctx.save();

    // 1. 地面立體陰影 (Shadow on Gravel)
    const shadowAlpha = Math.max(0.12, 0.45 - (this.z * 0.003));
    const shadowRadius = this.radius * (1 + this.z * 0.001);
    ctx.fillStyle = `rgba(30, 20, 15, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(this.x, shadowY + 2, shadowRadius, shadowRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 球體主體繪製
    ctx.translate(this.x, ballY);

    if (this.isJack) {
      // 目標小木球 (鮮亮黃橘木紋球)
      ctx.shadowColor = "rgba(251, 191, 36, 0.6)";
      ctx.shadowBlur = 8;

      const grad = ctx.createRadialGradient(-drawRadius * 0.35, -drawRadius * 0.35, 1, 0, 0, drawRadius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, "#f59e0b");
      grad.addColorStop(0.85, "#b45309");
      grad.addColorStop(1, "#78350f");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
      ctx.fill();

      // 小木球中心焦點
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-drawRadius * 0.3, -drawRadius * 0.3, drawRadius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 金屬鋼球 (Steel Boule - 藍隊 / 紅隊精緻雕紋鋼球)
      const isBlue = (this.team === "blue");
      ctx.shadowColor = isBlue ? "rgba(56, 189, 248, 0.4)" : "rgba(244, 63, 94, 0.4)";
      ctx.shadowBlur = 10;

      // 金屬反光球體漸層 (Metallic Chrome Gradient)
      const grad = ctx.createRadialGradient(-drawRadius * 0.35, -drawRadius * 0.35, 2, 0, 0, drawRadius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.25, "#e2e8f0");
      grad.addColorStop(0.65, isBlue ? "#475569" : "#64748b");
      grad.addColorStop(0.9, isBlue ? "#1e293b" : "#334155");
      grad.addColorStop(1, "#0f172a");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
      ctx.fill();

      // 鋼球經典環形雕紋 (Engraved Grooves)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isBlue ? "#38bdf8" : "#f43f5e";
      ctx.lineWidth = 1.6;

      ctx.save();
      ctx.rotate(this.grooveAngle);
      for (let s = 0; s < this.stripes; s++) {
        const offset = (s - (this.stripes - 1) / 2) * (drawRadius * 0.42);
        ctx.beginPath();
        ctx.ellipse(0, offset, drawRadius * 0.85, drawRadius * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 頂部金屬高光弧
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.ellipse(-drawRadius * 0.3, -drawRadius * 0.35, drawRadius * 0.35, drawRadius * 0.18, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // 外邊緣反光環
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius - 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 砂石沙塵與撞擊火花粒子 (Particle)
class PetanqueParticle {
  constructor(x, y, color, vx, vy, maxLife = 0.4, size = 3, text = null) {
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
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 皮尺即時測量儀 (Tape Measure Tool)
class TapeMeasure {
  static draw(ctx, jack, boules, bestBoule) {
    if (!jack) return;

    ctx.save();
    // 繪製小木球中心光圈
    ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(jack.x, jack.y, 22, 0, Math.PI * 2);
    ctx.stroke();

    // 依序測量每顆鐵球至目標小木球之距離
    for (const b of boules) {
      if (b === jack) continue;

      const distPx = Math.hypot(b.x - jack.x, b.y - jack.y);
      // 換算為公制米 (假設 100px ≈ 1.0 公尺)
      const distMeters = (distPx / 100).toFixed(2);

      const isBest = (b === bestBoule);
      const isBlue = (b.team === "blue");

      ctx.strokeStyle = isBest ? "#fbbf24" : isBlue ? "rgba(56, 189, 248, 0.45)" : "rgba(244, 63, 94, 0.45)";
      ctx.lineWidth = isBest ? 2.5 : 1.2;
      ctx.setLineDash(isBest ? [] : [6, 6]);

      // 連線
      ctx.beginPath();
      ctx.moveTo(jack.x, jack.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // 距離標籤文字 (置於線段中點)
      const midX = (jack.x + b.x) / 2;
      const midY = (jack.y + b.y) / 2;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(midX - 22, midY - 9, 44, 18);
      ctx.strokeStyle = ctx.strokeStyle;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(midX - 22, midY - 9, 44, 18);

      ctx.fillStyle = isBest ? "#fbbf24" : "#ffffff";
      ctx.font = `bold 10px 'JetBrains Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${distMeters}m`, midX, midY + 1);
    }

    ctx.restore();
  }
}

window.Boule = Boule;
window.PetanqueParticle = PetanqueParticle;
window.TapeMeasure = TapeMeasure;
