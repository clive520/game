/**
 * A* 尋路演算法與迷宮驗證模組 (A* Pathfinding & Mazing Protocol)
 * 支援開放式迷宮建造、動態動態重算路徑與防止堵死（Anti-Blocking）
 */
class PathfindingSystem {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = []; // 0: 空地可通行, 1: 防禦塔障礙物
    this.start = { col: 0, row: Math.floor(rows / 2) };
    this.exit = { col: cols - 1, row: Math.floor(rows / 2) };
    this.resetGrid();
  }

  resetGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }
  }

  isObstacle(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
    return this.grid[row][col] === 1;
  }

  setObstacle(col, row, blocked) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row][col] = blocked ? 1 : 0;
    }
  }

  // 取得四方向鄰近節點（上下左右，曼哈頓移動）
  getNeighbors(node, matrix = this.grid) {
    const { col, row } = node;
    const neighbors = [];
    const dirs = [
      { col: 0, row: -1 }, // 上
      { col: 0, row: 1 },  // 下
      { col: -1, row: 0 }, // 左
      { col: 1, row: 0 }   // 右
    ];

    for (const d of dirs) {
      const nc = col + d.col;
      const nr = row + d.row;
      if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
        if (matrix[nr][nc] === 0) {
          neighbors.push({ col: nc, row: nr });
        }
      }
    }
    return neighbors;
  }

  // 曼哈頓距離啟發函數
  heuristic(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  /**
   * 核心 A* 演算法
   * @param {Object} startNode - { col, row }
   * @param {Object} endNode - { col, row }
   * @param {Array} [overrideMatrix] - 模擬放置時的自訂地圖
   * @returns {Array|null} 路徑陣列 [{col, row}, ...] 或 null (無路可走)
   */
  findPath(startNode, endNode = this.exit, overrideMatrix = this.grid) {
    // 若起點就是終點
    if (startNode.col === endNode.col && startNode.row === endNode.row) {
      return [{ col: startNode.col, row: startNode.row }];
    }

    const startKey = `${startNode.col},${startNode.row}`;
    const endKey = `${endNode.col},${endNode.row}`;

    // 開放與關閉集合
    const openSet = [{ ...startNode, g: 0, f: this.heuristic(startNode, endNode) }];
    const cameFrom = new Map();
    const gScore = new Map();
    gScore.set(startKey, 0);

    const inOpenSet = new Set([startKey]);

    while (openSet.length > 0) {
      // 找出 f 值最小的節點
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openSet.splice(lowestIndex, 1)[0];
      const currentKey = `${current.col},${current.row}`;
      inOpenSet.delete(currentKey);

      // 到達終點，回溯重建路徑
      if (current.col === endNode.col && current.row === endNode.row) {
        const path = [];
        let curr = current;
        while (curr) {
          path.unshift({ col: curr.col, row: curr.row });
          curr = cameFrom.get(`${curr.col},${curr.row}`);
        }
        return path;
      }

      const neighbors = this.getNeighbors(current, overrideMatrix);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.col},${neighbor.row}`;
        const tentativeG = gScore.get(currentKey) + 1;

        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(neighbor, endNode);

          if (!inOpenSet.has(neighborKey)) {
            openSet.push({ ...neighbor, g: tentativeG, f });
            inOpenSet.add(neighborKey);
          }
        }
      }
    }

    // 無路可走
    return null;
  }

  /**
   * 驗證防禦塔放置是否合法（防堵死 Anti-blocking）
   * 規則：
   * 1. 不可放置於起點或終點
   * 2. 放置後起點必須仍有路徑通往終點
   * 3. 放置後場上所有現存的敵人，也必須各自能抵達終點
   */
  canBuildAt(col, row, aliveEnemies = []) {
    // 檢查範圍
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return { ok: false, reason: "超出防區邊界" };
    }

    // 檢查起點與終點保護
    if ((col === this.start.col && row === this.start.row) ||
        (col === this.exit.col && row === this.exit.row)) {
      return { ok: false, reason: "不可在傳送門或能量核心位置造塔" };
    }

    // 檢查是否已有建築
    if (this.grid[row][col] === 1) {
      return { ok: false, reason: "此位置已存在防禦工事" };
    }

    // 暫時標記障礙以模擬路徑
    this.grid[row][col] = 1;

    // 1. 驗證大門到核心的主路徑
    const mainPath = this.findPath(this.start, this.exit);
    if (!mainPath) {
      this.grid[row][col] = 0; // 還原
      return { ok: false, reason: "造塔將完全封死進軍路線！必須保留通道" };
    }

    // 2. 驗證場上已出生的敵人是否會被圍困堵死
    for (const enemy of aliveEnemies) {
      const enemyGridPos = { col: enemy.gridCol, row: enemy.gridRow };
      const enemyPath = this.findPath(enemyGridPos, this.exit);
      if (!enemyPath) {
        this.grid[row][col] = 0; // 還原
        return { ok: false, reason: "造塔將困死戰場中的敵軍！請給予撤退或行進通道" };
      }
    }

    // 還原地圖
    this.grid[row][col] = 0;
    return { ok: true };
  }
}
