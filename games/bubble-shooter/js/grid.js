/**
 * 《星際泡泡龍：光子消消樂》六角蜂巢網格邏輯 (Bubble Hex Grid)
 * 負責六角格座標轉換、相鄰鄰居搜尋、三消 Flood-Fill 判定、懸空泡泡脫落演算法
 */

const BUBBLE_COLORS = {
  red: { name: "赤焰紅", hex: "#f43f5e", dark: "#881337", glow: "rgba(244, 63, 94, 0.6)", symbol: "▲" },
  blue: { name: "星海藍", hex: "#00f0ff", dark: "#0e7490", glow: "rgba(0, 240, 255, 0.6)", symbol: "●" },
  green: { name: "翡翠綠", hex: "#10b981", dark: "#064e3b", glow: "rgba(16, 185, 129, 0.6)", symbol: "◆" },
  yellow: { name: "琥珀黃", hex: "#fbbf24", dark: "#78350f", glow: "rgba(251, 191, 36, 0.6)", symbol: "★" },
  purple: { name: "星雲紫", hex: "#a855f7", dark: "#581c87", glow: "rgba(168, 85, 247, 0.6)", symbol: "⬡" },
  orange: { name: "烈陽橙", hex: "#fb923c", dark: "#7c2d12", glow: "rgba(251, 146, 60, 0.6)", symbol: "✦" },

  // 特殊球
  bomb: { name: "反物質高爆彈", hex: "#e11d48", dark: "#4c0519", glow: "rgba(225, 29, 72, 0.8)", symbol: "💣" },
  laser: { name: "貫穿光子雷射", hex: "#38bdf8", dark: "#0369a1", glow: "rgba(56, 189, 248, 0.8)", symbol: "⚡" },
  rainbow: { name: "七彩量子萬能球", hex: "#ffffff", dark: "#312e81", glow: "rgba(255, 255, 255, 0.9)", symbol: "🌈" }
};

const STANDARD_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];

class BubbleGrid {
  constructor(cols = 10, rows = 16, radius = 22) {
    this.cols = cols;
    this.rows = rows;
    this.radius = radius;
    this.rowHeight = radius * Math.sqrt(3); // 約 1.732 * R
    this.cells = []; // 2D 陣列: cells[r][c] = Bubble | null
    this.initEmpty();
  }

  initEmpty() {
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      const rowCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      this.cells[r] = new Array(rowCols).fill(null);
    }
  }

  // 取得該格在畫布上的像素中心座標 (x, y)
  getCellPos(r, c) {
    const isOdd = (r % 2 === 1);
    const x = isOdd ? (this.radius * 2 + c * this.radius * 2) : (this.radius + c * this.radius * 2);
    const y = this.radius + r * this.rowHeight;
    return { x, y };
  }

  // 取得六角格鄰居 (Up to 6 neighbors)
  getNeighbors(r, c) {
    const neighbors = [];
    const isOdd = (r % 2 === 1);

    // 水平鄰居
    const offsets = [
      { dr: 0, dc: -1 }, // 左
      { dr: 0, dc: 1 }   // 右
    ];

    if (isOdd) {
      // 奇數行
      offsets.push(
        { dr: -1, dc: 0 }, { dr: -1, dc: 1 }, // 上左, 上右
        { dr: 1, dc: 0 }, { dr: 1, dc: 1 }    // 下左, 下右
      );
    } else {
      // 偶數行
      offsets.push(
        { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, // 上左, 上右
        { dr: 1, dc: -1 }, { dr: 1, dc: 0 }    // 下左, 下右
      );
    }

    for (const { dr, dc } of offsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.isValidCoord(nr, nc)) {
        neighbors.push({ r: nr, c: nc });
      }
    }
    return neighbors;
  }

  isValidCoord(r, c) {
    if (r < 0 || r >= this.rows) return false;
    const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
    return c >= 0 && c < maxCols;
  }

  // 將自由移動的泡泡碰撞吸附到最貼近且相鄰的空六角網格中
  snapToNearestCell(px, py) {
    let bestDist = Infinity;
    let bestCoord = null;

    // 先搜尋天花板 (第 0 行) 與現有泡泡鄰近的所有空位
    for (let r = 0; r < this.rows; r++) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        if (this.cells[r][c] !== null) continue; // 已被佔據

        // 必須是天花板 (r === 0) 或旁邊至少有 1 顆相鄰泡泡
        const neighbors = this.getNeighbors(r, c);
        const hasAdjacent = r === 0 || neighbors.some(n => this.cells[n.r][n.c] !== null);
        if (!hasAdjacent) continue;

        const pos = this.getCellPos(r, c);
        const dist = Math.hypot(px - pos.x, py - pos.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestCoord = { r, c, x: pos.x, y: pos.y };
        }
      }
    }

    return bestCoord;
  }

  // 三消 Flood-Fill 搜尋演算法
  findMatches(startR, startC) {
    const startBubble = this.cells[startR][startC];
    if (!startBubble) return [];

    // 若擊中特殊彩球
    if (startBubble.color === "bomb") {
      // 炸彈直接爆破周圍半徑內的所有泡泡
      const matched = [{ r: startR, c: startC }];
      const visited = new Set([`${startR},${startC}`]);
      const n1 = this.getNeighbors(startR, startC);
      for (const n of n1) {
        if (this.cells[n.r][n.c] && !visited.has(`${n.r},${n.c}`)) {
          visited.add(`${n.r},${n.c}`);
          matched.push(n);
          // 擴散第二圈
          const n2 = this.getNeighbors(n.r, n.c);
          for (const sub of n2) {
            if (this.cells[sub.r][sub.c] && !visited.has(`${sub.r},${sub.c}`)) {
              visited.add(`${sub.r},${sub.c}`);
              matched.push(sub);
            }
          }
        }
      }
      return matched;
    }

    if (startBubble.color === "laser") {
      // 雷射直接清除整排
      const matched = [];
      const maxCols = (startR % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        if (this.cells[startR][c]) matched.push({ r: startR, c });
      }
      return matched;
    }

    // 標準三消顏色匹配 (支援七彩彩虹萬能球)
    const targetColor = startBubble.color;
    const matched = [];
    const queue = [{ r: startR, c: startC }];
    const visited = new Set([`${startR},${startC}`]);

    while (queue.length > 0) {
      const curr = queue.shift();
      matched.push(curr);

      const neighbors = this.getNeighbors(curr.r, curr.c);
      for (const n of neighbors) {
        const neighborBubble = this.cells[n.r][n.c];
        if (!neighborBubble) continue;

        const key = `${n.r},${n.c}`;
        if (visited.has(key)) continue;

        // 相同顏色，或當前/鄰居為萬能彩虹球
        const isColorMatch = (neighborBubble.color === targetColor || targetColor === "rainbow" || neighborBubble.color === "rainbow");

        if (isColorMatch) {
          visited.add(key);
          queue.push(n);
        }
      }
    }

    // 需滿足 3 顆以上才算匹配成功
    return matched.length >= 3 ? matched : [];
  }

  // 懸空孤立泡泡搜尋 (Orphan Detection)
  // 從第 0 行天花板開始 BFS 漫水灌溉，任何未被連通的天體泡泡皆為孤立懸空！
  findOrphans() {
    const visited = new Set();
    const queue = [];

    // 1. 將所有頂部第 0 行有泡泡的格子推入隊列
    for (let c = 0; c < this.cols; c++) {
      if (this.cells[0][c] !== null) {
        queue.push({ r: 0, c });
        visited.add(`0,${c}`);
      }
    }

    // 2. 廣度優先搜尋所有能錨定到天花板的泡泡
    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = this.getNeighbors(curr.r, curr.c);
      for (const n of neighbors) {
        if (this.cells[n.r][n.c] !== null) {
          const key = `${n.r},${n.c}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }

    // 3. 找出所有未連通至天花板的懸空泡泡
    const orphans = [];
    for (let r = 0; r < this.rows; r++) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        if (this.cells[r][c] !== null && !visited.has(`${r},${c}`)) {
          orphans.push({ r, c, bubble: this.cells[r][c] });
        }
      }
    }

    return orphans;
  }

  // 取得目前盤面上所有現存的標準顏色清單 (避免發射已經不存在的廢球)
  getExistingColors() {
    const colorSet = new Set();
    for (let r = 0; r < this.rows; r++) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        const b = this.cells[r][c];
        if (b && STANDARD_COLORS.includes(b.color)) {
          colorSet.add(b.color);
        }
      }
    }
    return colorSet.size > 0 ? Array.from(colorSet) : STANDARD_COLORS;
  }

  // 檢查是否有泡泡越過警戒線 (r >= limitRow)
  hasReachedDangerLine(limitRow = 12) {
    for (let r = limitRow; r < this.rows; r++) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        if (this.cells[r][c] !== null) return true;
      }
    }
    return false;
  }

  // 檢查是否已全清盤面
  isEmpty() {
    for (let r = 0; r < this.rows; r++) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        if (this.cells[r][c] !== null) return false;
      }
    }
    return true;
  }

  // 下壓一行 (天花板下壓新行)
  pushDownRow(newRowColors = []) {
    // 將所有泡泡下移一行
    for (let r = this.rows - 1; r > 0; r--) {
      const maxCols = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxCols; c++) {
        // 從上一行對應位置推移
        const prevCols = ((r - 1) % 2 === 1) ? this.cols - 1 : this.cols;
        if (c < prevCols) {
          this.cells[r][c] = this.cells[r - 1][c];
        } else {
          this.cells[r][c] = null;
        }
      }
    }

    // 填補頂部第 0 行
    for (let c = 0; c < this.cols; c++) {
      const color = newRowColors[c] || STANDARD_COLORS[Math.floor(Math.random() * STANDARD_COLORS.length)];
      this.cells[0][c] = color ? { color } : null;
    }
  }
}

window.BUBBLE_COLORS = BUBBLE_COLORS;
window.STANDARD_COLORS = STANDARD_COLORS;
window.BubbleGrid = BubbleGrid;
