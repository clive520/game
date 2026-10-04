/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 2D 動態光影與幾何射線投射引擎 (2D Raycasting & Visibility Polygon)
 * 實現：牆體真實遮光、手電筒錐形光束、360度近身微光、守衛視野射線與可見性判斷
 */

class RaycastLighting {
  // 線段相交檢測：射線 (r_px, r_py) -> (r_dx, r_dy) 與 線段 (s_ax, s_ay) -> (s_bx, s_by)
  static getRaySegmentIntersection(r_px, r_py, r_dx, r_dy, s_ax, s_ay, s_bx, s_by) {
    const s_dx = s_bx - s_ax;
    const s_dy = s_by - s_ay;

    const r_mag = Math.hypot(r_dx, r_dy);
    const s_mag = Math.hypot(s_dx, s_dy);
    if (r_mag === 0 || s_mag === 0) return null;

    // 平行線判定
    const denom = r_dx * s_dy - r_dy * s_dx;
    if (Math.abs(denom) < 0.000001) return null;

    const t2 = (r_dx * (s_ay - r_py) + r_dy * (r_px - s_ax)) / denom;
    const t1 = (s_dx * (r_py - s_ay) + s_dy * (s_ax - r_px)) / -denom;

    // t1 為射線參數 (>= 0)，t2 為線段參數 (0 <= t2 <= 1)
    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
      return {
        x: r_px + r_dx * t1,
        y: r_py + r_dy * t1,
        dist: t1
      };
    }
    return null;
  }

  // 檢查兩點之間是否有牆壁阻隔 (Line of Sight 視線檢測)
  static hasLineOfSight(x1, y1, x2, y2, segments) {
    const r_dx = x2 - x1;
    const r_dy = y2 - y1;
    const totalDist = Math.hypot(r_dx, r_dy);
    if (totalDist < 1) return true;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const hit = this.getRaySegmentIntersection(x1, y1, r_dx, r_dy, seg.x1, seg.y1, seg.x2, seg.y2);
      // 若在終點之前就撞到牆壁 (且稍微排除起點/終點邊界浮點數誤差)
      if (hit && hit.dist < 0.995 && hit.dist > 0.005) {
        return false;
      }
    }
    return true;
  }

  // 計算錐形光源的可見多邊形 (Visibility Polygon for Cone Light)
  static computeConeVisibilityPolygon(originX, originY, centerAngle, fovRadians, maxRange, segments) {
    const halfFov = fovRadians / 2;
    const minAngle = centerAngle - halfFov;
    const maxAngle = centerAngle + halfFov;

    const angles = new Set();
    // 錐體邊界主射線
    angles.add(minAngle);
    angles.add(maxAngle);

    // 採樣錐體扇區內的細緻均勻射線 (平滑弧面)
    const arcSamples = 20;
    for (let i = 1; i < arcSamples; i++) {
      angles.add(minAngle + (fovRadians * i) / arcSamples);
    }

    // 收集扇區附近的牆體端點
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pts = [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];

      for (let p of pts) {
        const dx = p.x - originX;
        const dy = p.y - originY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRange * 1.25) continue;

        let a = Math.atan2(dy, dx);
        // 將角度規格化至 [centerAngle - PI, centerAngle + PI]
        while (a < centerAngle - Math.PI) a += Math.PI * 2;
        while (a > centerAngle + Math.PI) a -= Math.PI * 2;

        if (a >= minAngle - 0.05 && a <= maxAngle + 0.05) {
          angles.add(a - 0.0002);
          angles.add(a);
          angles.add(a + 0.0002);
        }
      }
    }

    // 將角度轉為有序陣列
    const sortedAngles = Array.from(angles).filter(a => a >= minAngle && a <= maxAngle).sort((a, b) => a - b);

    // 依序投射射線求交點
    const polygon = [{ x: originX, y: originY }];

    for (let a of sortedAngles) {
      const dirX = Math.cos(a);
      const dirY = Math.sin(a);
      let closestDist = maxRange;
      let hitX = originX + dirX * maxRange;
      let hitY = originY + dirY * maxRange;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const hit = this.getRaySegmentIntersection(originX, originY, dirX, dirY, seg.x1, seg.y1, seg.x2, seg.y2);
        if (hit && hit.dist < closestDist) {
          closestDist = hit.dist;
          hitX = hit.x;
          hitY = hit.y;
        }
      }

      polygon.push({ x: hitX, y: hitY });
    }

    return polygon;
  }

  // 計算 360 度環形微光多邊形 (Ambient Aura Polygon)
  static computeRadialVisibilityPolygon(originX, originY, maxRange, segments) {
    const angles = new Set();
    const samples = 24;
    for (let i = 0; i < samples; i++) {
      angles.add((Math.PI * 2 * i) / samples);
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pts = [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];
      for (let p of pts) {
        const dx = p.x - originX;
        const dy = p.y - originY;
        if (Math.hypot(dx, dy) <= maxRange * 1.3) {
          const a = Math.atan2(dy, dx);
          angles.add(a - 0.0003);
          angles.add(a);
          angles.add(a + 0.0003);
        }
      }
    }

    const sortedAngles = Array.from(angles).sort((a, b) => a - b);
    const polygon = [];

    for (let a of sortedAngles) {
      const dirX = Math.cos(a);
      const dirY = Math.sin(a);
      let closestDist = maxRange;
      let hitX = originX + dirX * maxRange;
      let hitY = originY + dirY * maxRange;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const hit = this.getRaySegmentIntersection(originX, originY, dirX, dirY, seg.x1, seg.y1, seg.x2, seg.y2);
        if (hit && hit.dist < closestDist) {
          closestDist = hit.dist;
          hitX = hit.x;
          hitY = hit.y;
        }
      }

      polygon.push({ x: hitX, y: hitY });
    }

    return polygon;
  }

  // 判定某目標是否被主角的手電筒照射到
  static isTargetLitByFlashlight(player, targetX, targetY, segments) {
    if (!player.flashlightOn || player.battery <= 0) {
      // 若手電筒關閉，僅能依據極小微弱身邊半徑判定
      const dist = Math.hypot(targetX - player.x, targetY - player.y);
      if (dist <= 45) {
        return this.hasLineOfSight(player.x, player.y, targetX, targetY, segments);
      }
      return false;
    }

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy);

    // 1. 在身邊極近微光半徑內 (約 50px)
    if (dist <= 52) {
      return this.hasLineOfSight(player.x, player.y, targetX, targetY, segments);
    }

    // 2. 超出手電筒最遠射程
    if (dist > player.flashlightRange) return false;

    // 3. 角度在錐體夾角內
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - player.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) <= player.flashlightFov / 2) {
      // 4. 無遮擋視線判定
      return this.hasLineOfSight(player.x, player.y, targetX, targetY, segments);
    }

    return false;
  }

  // 判定主角是否踏入守衛的視野範圍內
  static isPlayerInGuardVision(guard, player, segments) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const dist = Math.hypot(dx, dy);

    // 距離超出守衛視距
    if (dist > guard.visionRange) return false;

    // 夾角判定
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - guard.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) <= guard.visionFov / 2) {
      // 無牆壁阻擋
      return this.hasLineOfSight(guard.x, guard.y, player.x, player.y, segments);
    }

    return false;
  }
}

window.RaycastLighting = RaycastLighting;
