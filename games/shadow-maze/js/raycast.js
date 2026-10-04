/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 2D 動態光影與幾何射線投射引擎 (2D Raycasting & Visibility Polygon)
 * 實現：牆體真實遮光、手電筒錐形光束、360度近身微光、守衛視野射線與可見性判斷
 */

class RaycastLighting {
  /**
   * 射線與線段相交精確幾何檢測
   * 射線：(r_px, r_py) + t * (r_dx, r_dy), t >= 0
   * 線段：(s_ax, s_ay) + u * (dx, dy), 0 <= u <= 1
   */
  static getRaySegmentIntersection(r_px, r_py, r_dx, r_dy, s_ax, s_ay, s_bx, s_by) {
    const dx = s_bx - s_ax;
    const dy = s_by - s_ay;
    const denom = r_dx * dy - r_dy * dx;

    // 平行或重合線段
    if (Math.abs(denom) < 1e-7) return null;

    const t = ((s_ax - r_px) * dy - (s_ay - r_py) * dx) / denom;
    const u = (r_dx * (r_py - s_ay) - r_dy * (r_px - s_ax)) / denom;

    // t 為射線距離 (>= 0)，u 為線段插值比例 (0 <= u <= 1)
    if (t >= 0 && u >= 0 && u <= 1) {
      return {
        x: r_px + r_dx * t,
        y: r_py + r_dy * t,
        dist: t
      };
    }
    return null;
  }

  /**
   * 檢查兩點之間是否有任何牆壁阻隔 (Line of Sight 視線檢測)
   */
  static hasLineOfSight(x1, y1, x2, y2, segments) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const sx = seg.x2 - seg.x1;
      const sy = seg.y2 - seg.y1;
      const denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-7) continue;

      const t = ((seg.x1 - x1) * sy - (seg.y1 - y1) * sx) / denom;
      const u = (dx * (y1 - seg.y1) - dy * (x1 - seg.x1)) / denom;

      // 若在起點與終點之間撞擊線段 (排除端點誤差)
      if (t > 0.002 && t < 0.998 && u >= 0 && u <= 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * 計算錐形手電筒/探照燈的可見多邊形 (Visibility Polygon for Cone Light)
   */
  static computeConeVisibilityPolygon(originX, originY, centerAngle, fovRadians, maxRange, segments) {
    const halfFov = fovRadians / 2;
    const minAngle = centerAngle - halfFov;
    const maxAngle = centerAngle + halfFov;

    const angles = new Set();
    // 錐體兩側邊界射線
    angles.add(minAngle);
    angles.add(maxAngle);

    // 錐體扇區圓弧均勻採樣射線 (每 1.5 度採樣一次，確保弧面圓潤)
    const arcSamples = 36;
    for (let i = 1; i < arcSamples; i++) {
      angles.add(minAngle + (fovRadians * i) / arcSamples);
    }

    // 收集扇區照射範圍內的所有牆面頂點
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pts = [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];

      for (let p of pts) {
        const dx = p.x - originX;
        const dy = p.y - originY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRange * 1.35) continue;

        const a = Math.atan2(dy, dx);
        // 將角度規格化至以 centerAngle 為中心的連續區間
        let diff = a - centerAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const normAngle = centerAngle + diff;

        if (normAngle >= minAngle - 0.05 && normAngle <= maxAngle + 0.05) {
          angles.add(normAngle - 0.0001);
          angles.add(normAngle);
          angles.add(normAngle + 0.0001);
        }
      }
    }

    // 限制角度在扇區內並由小到大排序
    const sortedAngles = Array.from(angles)
      .map(a => Math.max(minAngle, Math.min(maxAngle, a)))
      .sort((a, b) => a - b);

    // 起點為光源中心
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

      polygon.push({ x: hitX, y: hitY, dist: closestDist });
    }

    return polygon;
  }

  /**
   * 計算 360 度環形微光多邊形 (Ambient Aura Polygon)
   */
  static computeRadialVisibilityPolygon(originX, originY, maxRange, segments) {
    const angles = new Set();
    const samples = 36;
    for (let i = 0; i < samples; i++) {
      angles.add((Math.PI * 2 * i) / samples - Math.PI);
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pts = [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];
      for (let p of pts) {
        const dx = p.x - originX;
        const dy = p.y - originY;
        if (Math.hypot(dx, dy) <= maxRange * 1.35) {
          const a = Math.atan2(dy, dx);
          angles.add(a - 0.0002);
          angles.add(a);
          angles.add(a + 0.0002);
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

  /**
   * 判定某目標是否被主角的手電筒照射到
   */
  static isTargetLitByFlashlight(player, targetX, targetY, segments) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy);

    // 1. 在身邊極近微光半徑內 (50px)
    if (dist <= 52) {
      return this.hasLineOfSight(player.x, player.y, targetX, targetY, segments);
    }

    // 若手電筒關閉或沒電，遠處皆無法照亮
    if (!player.flashlightOn || player.battery <= 0 || player.isFlickering) {
      return false;
    }

    // 2. 超出手電筒最遠射程
    if (dist > player.flashlightRange) return false;

    // 3. 角度在錐體扇區內
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - player.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) <= player.flashlightFov / 2) {
      // 4. 無牆壁阻擋
      return this.hasLineOfSight(player.x, player.y, targetX, targetY, segments);
    }

    return false;
  }

  /**
   * 判定主角是否踏入守衛的視野範圍內
   */
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
