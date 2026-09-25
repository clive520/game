/**
 * 《法式滾球：普羅旺斯大師》物理運算核心 (Petanque Physics Engine)
 * 包含：2.5D 高拋與地滾物理、紅土碎石摩擦力、牛頓完全非對稱/彈性碰撞與經典 Carreau (卡羅替換)
 */

class BallPhysics {
  // 更新單一球體的飛行與滾動狀態
  static updateBall(ball, dt, arenaBounds) {
    if (ball.isStopped) return;

    // 1. 空中飛行物理 (Z 軸仰角高拋)
    if (ball.z > 0 || ball.vz > 0) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.z += ball.vz * dt;
      ball.vz -= 980 * dt; // 重力加速度

      // 著地判定
      if (ball.z <= 0) {
        ball.z = 0;
        // 碎石地的反彈係數較低 (吸收大部分垂直動能)
        if (Math.abs(ball.vz) > 90) {
          ball.vz = -ball.vz * 0.28;
          // 著地水平動能衰減
          ball.vx *= 0.65;
          ball.vy *= 0.65;
          window.petanqueAudio.playLanding();
        } else {
          ball.vz = 0;
          window.petanqueAudio.playLanding();
        }
      }
    } else {
      // 2. 地面碎石滾動物理 (Rolling Friction on Gravel)
      const speed = Math.hypot(ball.vx, ball.vy);

      if (speed > 4) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // 碎石地面阻力摩擦力 (微幅隨機微震動模擬不規則碎石路面)
        const friction = (ball.isJack ? 280 : 340) * dt;
        const newSpeed = Math.max(0, speed - friction);

        const ratio = newSpeed / speed;
        ball.vx = ball.vx * ratio + (Math.random() - 0.5) * 1.2 * dt;
        ball.vy = ball.vy * ratio + (Math.random() - 0.5) * 1.2 * dt;
      } else {
        ball.vx = 0;
        ball.vy = 0;
        ball.isStopped = true;
      }
    }

    // 3. 球場邊界檢查
    if (arenaBounds) {
      if (ball.x - ball.radius < arenaBounds.minX) {
        ball.x = arenaBounds.minX + ball.radius;
        ball.vx = -ball.vx * 0.35;
      } else if (ball.x + ball.radius > arenaBounds.maxX) {
        ball.x = arenaBounds.maxX - ball.radius;
        ball.vx = -ball.vx * 0.35;
      }

      if (ball.y - ball.radius < arenaBounds.minY) {
        ball.y = arenaBounds.minY + ball.radius;
        ball.vy = -ball.vy * 0.35;
      } else if (ball.y + ball.radius > arenaBounds.maxY) {
        ball.y = arenaBounds.maxY - ball.radius;
        ball.vy = -ball.vy * 0.35;
      }
    }
  }

  // 球體間的牛頓彈性碰撞檢測 (Ball-on-Ball Collision)
  static resolveCollisions(balls, onImpact) {
    for (let i = 0; i < balls.length; i++) {
      const b1 = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b2 = balls[j];

        // 只有接近地面時才發生碰撞 (Z 軸高度差小於 14px)
        if (Math.abs(b1.z - b2.z) > 16) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0.001) {
          // 法線向量
          const nx = dx / dist;
          const ny = dy / dist;

          // 1. 穿透分離位置修正 (Positional Correction)
          const overlap = minDist - dist;
          const totalMass = b1.mass + b2.mass;
          b1.x -= nx * overlap * (b2.mass / totalMass);
          b1.y -= ny * overlap * (b2.mass / totalMass);
          b2.x += nx * overlap * (b1.mass / totalMass);
          b2.y += ny * overlap * (b1.mass / totalMass);

          // 2. 相對速度
          const rvx = b2.vx - b1.vx;
          const rvy = b2.vy - b1.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          // 分離中則不處理
          if (velAlongNormal > 0) continue;

          // 碰撞恢復係數 (鐵球間高彈性 ~0.86，木球 ~0.75)
          const isSteelOnSteel = (!b1.isJack && !b2.isJack);
          const restitution = isSteelOnSteel ? 0.86 : 0.76;

          // 衝量計算 (Impulse)
          const impulse = -(1 + restitution) * velAlongNormal / (1 / b1.mass + 1 / b2.mass);

          b1.vx -= (impulse / b1.mass) * nx;
          b1.vy -= (impulse / b1.mass) * ny;
          b2.vx += (impulse / b2.mass) * nx;
          b2.vy += (impulse / b2.mass) * ny;

          // 被撞擊的球喚醒
          b1.isStopped = false;
          b2.isStopped = false;

          // 觸發撞擊音效與火花回調
          const impactSpeed = Math.abs(velAlongNormal);
          if (onImpact) {
            onImpact(b1, b2, (b1.x + b2.x) / 2, (b1.y + b2.y) / 2, impactSpeed, isSteelOnSteel);
          }
        }
      }
    }
  }
}

window.BallPhysics = BallPhysics;
