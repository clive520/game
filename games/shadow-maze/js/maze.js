/**
 * 《暗夜迷蹤：手電筒生還者》(Shadow Maze: Flashlight Protocol)
 * 程序化迷宮生成器與尋路系統 (Procedural Maze & Pathfinding)
 */

class MazeGenerator {
  constructor(cols = 21, rows = 21, tileSize = 52) {
    // 確保迷宮維度為奇數
    this.cols = (cols % 2 === 0) ? cols + 1 : cols;
    this.rows = (rows % 2 === 0) ? rows + 1 : rows;
    this.tileSize = tileSize;
    this.grid = []; // 1 為牆壁，0 為通道
    this.segments = []; // 用於光影射線投射的合併線段集

    this.spawnPoint = { x: 0, y: 0 };
    this.exitPoint = { x: 0, y: 0 };
    this.keycardPoint = { x: 0, y: 0 };
    this.batteryPoints = [];
    this.guardPatrols = [];

    this.generate();
  }

  generate() {
    // 1. 初始化全牆壁網格
    this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(1));

    // 2. 深度優先搜尋 (DFS Recursive Backtracking) 產生主骨架
    const stack = [];
    const startX = 1;
    const startY = 1;
    this.grid[startY][startX] = 0;
    stack.push({ x: startX, y: startY });

    const directions = [
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 }
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = [];

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && this.grid[ny][nx] === 1) {
          neighbors.push({ x: nx, y: ny, wallX: current.x + dir.dx / 2, wallY: current.y + dir.dy / 2 });
        }
      }

      if (neighbors.length > 0) {
        // 隨機選擇相鄰格子打通
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.grid[next.wallY][next.wallX] = 0;
        this.grid[next.y][next.x] = 0;
        stack.push({ x: next.x, y: next.y });
      } else {
        stack.pop();
      }
    }

    // 3. 額外打通部分隔牆以創造環狀通道 (增加潛行迂迴繞路空間)
    const extraLoops = Math.floor((this.cols * this.rows) * 0.035);
    for (let i = 0; i < extraLoops; i++) {
      const rx = 1 + Math.floor(Math.random() * (this.cols - 2));
      const ry = 1 + Math.floor(Math.random() * (this.rows - 2));
      if (this.grid[ry][rx] === 1) {
        // 若左右或上下皆為通道，則拆除此牆
        const horiz = (this.grid[ry][rx - 1] === 0 && this.grid[ry][rx + 1] === 0);
        const vert = (this.grid[ry - 1][rx] === 0 && this.grid[ry + 1][rx] === 0);
        if (horiz || vert) {
          this.grid[ry][rx] = 0;
        }
      }
    }

    // 4. 定位關鍵地標點
    // 主角出生點 (左上方安全通道)
    this.spawnPoint = {
      x: (startX + 0.5) * this.tileSize,
      y: (startY + 0.5) * this.tileSize,
      gridX: startX,
      gridY: startY
    };

    // 出口閘門 (出生點旁但隔開的小房間)
    this.exitPoint = {
      x: (startX + 0.5) * this.tileSize,
      y: (startY + 1.5) * this.tileSize,
      gridX: startX,
      gridY: startY + 1
    };
    // 確保出口格可通行
    this.grid[startY + 1][startX] = 0;

    // 尋找距離出生點最遠的可通行格子放置「逃生門禁卡 (Keycard)」
    const distances = this.computeDistanceMap(startX, startY);
    let maxDist = -1;
    let furthestCell = { x: startX, y: startY };

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (distances[r][c] > maxDist) {
          maxDist = distances[r][c];
          furthestCell = { x: c, y: r };
        }
      }
    }

    this.keycardPoint = {
      x: (furthestCell.x + 0.5) * this.tileSize,
      y: (furthestCell.y + 0.5) * this.tileSize,
      gridX: furthestCell.x,
      gridY: furthestCell.y
    };

    // 散落備用電池 (在遠端通道角落)
    this.batteryPoints = [];
    const deadEnds = this.findDeadEnds();
    for (const de of deadEnds) {
      if ((de.x !== furthestCell.x || de.y !== furthestCell.y) &&
          (de.x !== startX || de.y !== startY) &&
          distances[de.y][de.x] > 8) {
        this.batteryPoints.push({
          x: (de.x + 0.5) * this.tileSize,
          y: (de.y + 0.5) * this.tileSize,
          gridX: de.x,
          gridY: de.y,
          collected: false
        });
        if (this.batteryPoints.length >= 3) break;
      }
    }

    // 5. 生成守衛巡邏路徑 (遠離出生點的各大通道)
    this.generateGuardPatrols(distances);

    // 6. 提取合併牆面線段 (供動態光影使用)
    this.extractSegments();
  }

  // BFS 計算距離場
  computeDistanceMap(fromX, fromY) {
    const dist = Array(this.rows).fill(-1).map(() => Array(this.cols).fill(-1));
    const queue = [{ x: fromX, y: fromY, d: 0 }];
    dist[fromY][fromX] = 0;

    while (queue.length > 0) {
      const cur = queue.shift();
      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      for (const dir of dirs) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
          if (this.grid[ny][nx] === 0 && dist[ny][nx] === -1) {
            dist[ny][nx] = cur.d + 1;
            queue.push({ x: nx, y: ny, d: cur.d + 1 });
          }
        }
      }
    }
    return dist;
  }

  // 尋找死胡同 (只有一條路可通的格子)
  findDeadEnds() {
    const list = [];
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (this.grid[r][c] === 0) {
          let openCount = 0;
          if (this.grid[r - 1][c] === 0) openCount++;
          if (this.grid[r + 1][c] === 0) openCount++;
          if (this.grid[r][c - 1] === 0) openCount++;
          if (this.grid[r][c + 1] === 0) openCount++;
          if (openCount === 1) {
            list.push({ x: c, y: r });
          }
        }
      }
    }
    return list;
  }

  // 產生多組守衛巡邏點
  generateGuardPatrols(distances) {
    this.guardPatrols = [];
    const validCells = [];

    // 挑選距離出生點至少 7 格以上、具有巡邏價值的通道
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (this.grid[r][c] === 0 && distances[r][c] >= 7) {
          validCells.push({ x: c, y: r });
        }
      }
    }

    // 隨機選取 3~5 個巡邏區域錨點
    validCells.sort(() => Math.random() - 0.5);

    const patrolCount = Math.min(6, Math.floor(this.cols / 4));
    for (let i = 0; i < patrolCount && i < validCells.length; i++) {
      const p1 = validCells[i];
      // 尋找附近 3~5 格內的另一個相通點作為往返巡邏端點
      const wpList = [
        { x: (p1.x + 0.5) * this.tileSize, y: (p1.y + 0.5) * this.tileSize }
      ];

      // 沿連通通道延伸尋找 p2
      const candidate = validCells.find(c =>
        c !== p1 && Math.hypot(c.x - p1.x, c.y - p1.y) >= 3 && Math.hypot(c.x - p1.x, c.y - p1.y) <= 6
      );

      if (candidate) {
        wpList.push({ x: (candidate.x + 0.5) * this.tileSize, y: (candidate.y + 0.5) * this.tileSize });
      }

      this.guardPatrols.push({
        spawn: wpList[0],
        waypoints: wpList
      });
    }
  }

  // 提取牆面幾何線段，精確分離四個受光朝向，防止對角線虛假橋接
  extractSegments() {
    this.segments = [];
    const S = this.tileSize;

    // 1. 水平邊緣檢測
    for (let r = 0; r < this.rows; r++) {
      // 牆格頂邊 (上方為空氣或地圖外)
      let startC = -1;
      for (let c = 0; c < this.cols; c++) {
        const isWall = (this.grid[r][c] === 1);
        const exposedTop = isWall && (r === 0 || this.grid[r - 1][c] === 0);
        if (exposedTop) {
          if (startC === -1) startC = c;
        } else {
          if (startC !== -1) {
            this.segments.push({ x1: startC * S, y1: r * S, x2: c * S, y2: r * S });
            startC = -1;
          }
        }
      }
      if (startC !== -1) {
        this.segments.push({ x1: startC * S, y1: r * S, x2: this.cols * S, y2: r * S });
      }

      // 牆格底邊 (下方為空氣或地圖外)
      startC = -1;
      for (let c = 0; c < this.cols; c++) {
        const isWall = (this.grid[r][c] === 1);
        const exposedBottom = isWall && (r === this.rows - 1 || this.grid[r + 1][c] === 0);
        if (exposedBottom) {
          if (startC === -1) startC = c;
        } else {
          if (startC !== -1) {
            this.segments.push({ x1: startC * S, y1: (r + 1) * S, x2: c * S, y2: (r + 1) * S });
            startC = -1;
          }
        }
      }
      if (startC !== -1) {
        this.segments.push({ x1: startC * S, y1: (r + 1) * S, x2: this.cols * S, y2: (r + 1) * S });
      }
    }

    // 2. 垂直邊緣檢測
    for (let c = 0; c < this.cols; c++) {
      // 牆格左邊 (左方為空氣或地圖外)
      let startR = -1;
      for (let r = 0; r < this.rows; r++) {
        const isWall = (this.grid[r][c] === 1);
        const exposedLeft = isWall && (c === 0 || this.grid[r][c - 1] === 0);
        if (exposedLeft) {
          if (startR === -1) startR = r;
        } else {
          if (startR !== -1) {
            this.segments.push({ x1: c * S, y1: startR * S, x2: c * S, y2: r * S });
            startR = -1;
          }
        }
      }
      if (startR !== -1) {
        this.segments.push({ x1: c * S, y1: startR * S, x2: c * S, y2: this.rows * S });
      }

      // 牆格右邊 (右方為空氣或地圖外)
      startR = -1;
      for (let r = 0; r < this.rows; r++) {
        const isWall = (this.grid[r][c] === 1);
        const exposedRight = isWall && (c === this.cols - 1 || this.grid[r][c + 1] === 0);
        if (exposedRight) {
          if (startR === -1) startR = r;
        } else {
          if (startR !== -1) {
            this.segments.push({ x1: (c + 1) * S, y1: startR * S, x2: (c + 1) * S, y2: r * S });
            startR = -1;
          }
        }
      }
      if (startR !== -1) {
        this.segments.push({ x1: (c + 1) * S, y1: startR * S, x2: (c + 1) * S, y2: this.rows * S });
      }
    }
  }

  // 碰撞檢查：檢查圓形實體 (x, y, radius) 是否撞擊牆壁
  checkCircleCollision(x, y, radius) {
    const minGridX = Math.floor((x - radius) / this.tileSize);
    const maxGridX = Math.floor((x + radius) / this.tileSize);
    const minGridY = Math.floor((y - radius) / this.tileSize);
    const maxGridY = Math.floor((y + radius) / this.tileSize);

    let correctedX = x;
    let correctedY = y;
    let hasCollided = false;

    for (let gy = minGridY; gy <= maxGridY; gy++) {
      for (let gx = minGridX; gx <= maxGridX; gx++) {
        if (gy < 0 || gy >= this.rows || gx < 0 || gx >= this.cols || this.grid[gy][gx] === 1) {
          // 矩形邊界
          const left = gx * this.tileSize;
          const right = left + this.tileSize;
          const top = gy * this.tileSize;
          const bottom = top + this.tileSize;

          // 尋找矩形最近點
          const closestX = Math.max(left, Math.min(correctedX, right));
          const closestY = Math.max(top, Math.min(correctedY, bottom));

          const distX = correctedX - closestX;
          const distY = correctedY - closestY;
          const distSq = distX * distX + distY * distY;

          if (distSq < radius * radius) {
            hasCollided = true;
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const overlap = radius - dist;
              correctedX += (distX / dist) * overlap;
              correctedY += (distY / dist) * overlap;
            } else {
              correctedX += radius;
            }
          }
        }
      }
    }

    return { x: correctedX, y: correctedY, collided: hasCollided };
  }

  // A* 網格尋路 (用於守衛追蹤主角)
  findPath(startGridX, startGridY, targetGridX, targetGridY) {
    if (startGridX === targetGridX && startGridY === targetGridY) return [];

    const openSet = [{ x: startGridX, y: startGridY, g: 0, f: Math.hypot(targetGridX - startGridX, targetGridY - startGridY) }];
    const cameFrom = new Map();
    const gScore = new Map();

    const key = (x, y) => `${x},${y}`;
    gScore.set(key(startGridX, startGridY), 0);

    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    let iterations = 0;
    while (openSet.length > 0 && iterations < 300) {
      iterations++;
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (current.x === targetGridX && current.y === targetGridY) {
        // 重構路徑
        const path = [];
        let currKey = key(current.x, current.y);
        while (cameFrom.has(currKey)) {
          const pt = cameFrom.get(currKey);
          path.unshift({
            x: (pt.x + 0.5) * this.tileSize,
            y: (pt.y + 0.5) * this.tileSize
          });
          currKey = key(pt.x, pt.y);
        }
        return path;
      }

      for (const d of dirs) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;

        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 0) {
          const nKey = key(nx, ny);
          const tentativeG = current.g + 1;

          if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
            cameFrom.set(nKey, current);
            gScore.set(nKey, tentativeG);
            const f = tentativeG + Math.hypot(targetGridX - nx, targetGridY - ny);
            openSet.push({ x: nx, y: ny, g: tentativeG, f: f });
          }
        }
      }
    }

    return [];
  }
}

window.MazeGenerator = MazeGenerator;
