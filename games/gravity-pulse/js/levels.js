/**
 * 《引力回圈：重力幾何》關卡設計與無限生成器 (Levels & Generator)
 * 包含 15 個精心編排的遞進式幾何星系關卡，以及無限深空模式的程序化生成演算法
 */

const GRAVITY_LEVELS = [
  // 關卡 1: 基礎教學 - 點擊釋放與切線彈射
  {
    id: 1,
    title: "軌道初鳴",
    subtitle: "First Orbit",
    tip: "當探測器旋轉至目標方向時，【點擊滑鼠】或按【空白鍵】釋放，利用切線慣性飛入蟲洞！",
    startNodeIndex: 0,
    nodes: [
      { x: 180, y: 320, type: "standard", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.2, dir: 1 },
      { x: 420, y: 320, type: "standard", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.2, dir: 1 }
    ],
    shards: [
      { x: 300, y: 265 },
      { x: 300, y: 375 },
      { x: 500, y: 260 }
    ],
    obstacles: [],
    wormhole: { x: 620, y: 320 }
  },

  // 關卡 2: 雙星接力
  {
    id: 2,
    title: "雙星共鳴",
    subtitle: "Binary Resonance",
    tip: "在天體間順暢接力跳躍！注意探測器進入下一個引力圈時會自動被捕獲入軌。",
    startNodeIndex: 0,
    nodes: [
      { x: 160, y: 400, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 380, y: 240, type: "standard", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.2, dir: -1 },
      { x: 600, y: 380, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 }
    ],
    shards: [
      { x: 270, y: 320 },
      { x: 380, y: 140 },
      { x: 490, y: 310 }
    ],
    obstacles: [],
    wormhole: { x: 750, y: 260 }
  },

  // 關卡 3: 三角幾何網絡
  {
    id: 3,
    title: "三角躍遷",
    subtitle: "Triangulation",
    tip: "順時針與逆時針公轉的方向不同，預測切線箭頭的引導將是你的得力助手！",
    startNodeIndex: 0,
    nodes: [
      { x: 180, y: 440, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.3, dir: 1 },
      { x: 350, y: 200, type: "standard", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, dir: -1 },
      { x: 520, y: 440, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.3, dir: 1 }
    ],
    shards: [
      { x: 265, y: 320 },
      { x: 350, y: 340 },
      { x: 435, y: 320 }
    ],
    obstacles: [],
    wormhole: { x: 680, y: 240 }
  },

  // 關卡 4: 脈衝加速星登場 (Pulsar)
  {
    id: 4,
    title: "脈衝超新星",
    subtitle: "Pulsar Accelerator",
    tip: "金色天體為【脈衝加速星】！在其中繞行會持續蓄能，釋放時可爆發超高速彈射！",
    startNodeIndex: 0,
    nodes: [
      { x: 150, y: 300, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.2, dir: 1 },
      { x: 380, y: 300, type: "pulsar", orbitRadius: 60, captureRadius: 95, baseSpeed: 2.8, dir: 1 },
      { x: 680, y: 300, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: -1 }
    ],
    shards: [
      { x: 265, y: 300 },
      { x: 530, y: 230 },
      { x: 530, y: 370 }
    ],
    obstacles: [],
    wormhole: { x: 820, y: 300 }
  },

  // 關卡 5: 維度反轉星 (Inverter)
  {
    id: 5,
    title: "幾何反轉",
    subtitle: "Phase Inverter",
    tip: "玫紅色天體為【維度反轉星】！每次進圈都會立即反轉你的公轉方向！",
    startNodeIndex: 0,
    nodes: [
      { x: 160, y: 240, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 380, y: 360, type: "inverter", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, dir: 1 },
      { x: 600, y: 240, type: "inverter", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, dir: -1 }
    ],
    shards: [
      { x: 270, y: 300 },
      { x: 380, y: 220 },
      { x: 490, y: 300 }
    ],
    obstacles: [],
    wormhole: { x: 760, y: 360 }
  },

  // 關卡 6: 幾何雷射閘道
  {
    id: 6,
    title: "雷射防線",
    subtitle: "Laser Gateway",
    tip: "小心旋轉中的幾何雷射！精準計算切線脫離的時機以穿透雷射間隙。",
    startNodeIndex: 0,
    nodes: [
      { x: 160, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 440, y: 320, type: "standard", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.4, dir: -1 },
      { x: 720, y: 320, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: 1 }
    ],
    shards: [
      { x: 300, y: 220 },
      { x: 300, y: 420 },
      { x: 580, y: 320 }
    ],
    obstacles: [
      { type: "laser", x: 300, y: 320, length: 150, rotSpeed: 1.2, angle: 0 },
      { type: "laser", x: 580, y: 320, length: 130, rotSpeed: -1.0, angle: Math.PI / 2 }
    ],
    wormhole: { x: 870, y: 320 }
  },

  // 關卡 7: 不穩定衰變星 (Decaying Core)
  {
    id: 7,
    title: "超新星倒數",
    subtitle: "Decaying Core",
    tip: "赤紅色天體為【衰變星】！進入後軌道倒數開始，必須在能量耗盡爆炸前脫離！",
    startNodeIndex: 0,
    nodes: [
      { x: 150, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.3, dir: 1 },
      { x: 360, y: 320, type: "decaying", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, decayTime: 2.8, dir: 1 },
      { x: 570, y: 320, type: "decaying", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, decayTime: 2.8, dir: -1 },
      { x: 760, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 }
    ],
    shards: [
      { x: 255, y: 320 },
      { x: 465, y: 250 },
      { x: 665, y: 390 }
    ],
    obstacles: [],
    wormhole: { x: 890, y: 320 }
  },

  // 關卡 8: 巡航軌道星 (Mobile Planet)
  {
    id: 8,
    title: "巡航軌道",
    subtitle: "Mobile Planet",
    tip: "紫色天體正沿著幾何軌跡巡弋位移！抓住動態靠近的引力窗口躍遷。",
    startNodeIndex: 0,
    nodes: [
      { x: 160, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 380, y: 320, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, waypoints: { dx: 0, dy: 100, speed: 1.5 }, dir: -1 },
      { x: 620, y: 320, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, waypoints: { dx: 0, dy: -100, speed: 1.5 }, dir: 1 },
      { x: 820, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 }
    ],
    shards: [
      { x: 270, y: 320 },
      { x: 500, y: 320 },
      { x: 720, y: 320 }
    ],
    obstacles: [],
    wormhole: { x: 940, y: 320 }
  },

  // 關卡 9: 幾何引力迴廊
  {
    id: 9,
    title: "引力迴廊",
    subtitle: "Gravitational Corridor",
    tip: "在上下狹窄雷射防線中穿梭，依靠反轉與標準星的精準接力保持水平通道中線。",
    startNodeIndex: 0,
    nodes: [
      { x: 150, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.5, dir: 1 },
      { x: 360, y: 230, type: "inverter", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.6, dir: -1 },
      { x: 570, y: 410, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: 1 },
      { x: 780, y: 250, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: -1 }
    ],
    shards: [
      { x: 255, y: 275 },
      { x: 465, y: 320 },
      { x: 675, y: 330 }
    ],
    obstacles: [
      { type: "laser", x: 360, y: 420, length: 160, rotSpeed: 0, angle: 0 },
      { type: "laser", x: 570, y: 210, length: 160, rotSpeed: 0, angle: 0 }
    ],
    wormhole: { x: 920, y: 320 }
  },

  // 關卡 10: 奇點黑洞
  {
    id: 10,
    title: "奇點視界",
    subtitle: "Singularity Horizon",
    tip: "警告：場中的黑色漩渦為【奇點黑洞】！千萬別讓探測器被強大吸積盤吞噬！",
    startNodeIndex: 0,
    nodes: [
      { x: 160, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 420, y: 190, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: 1 },
      { x: 420, y: 450, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: -1 },
      { x: 700, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 }
    ],
    shards: [
      { x: 420, y: 90 },
      { x: 420, y: 550 },
      { x: 560, y: 320 }
    ],
    obstacles: [
      { type: "blackhole", x: 420, y: 320, radius: 28, angle: 0, rotSpeed: 1.5 }
    ],
    wormhole: { x: 860, y: 320 }
  },

  // 關卡 11: 雙重脈衝彈射
  {
    id: 11,
    title: "光速彈弓",
    subtitle: "Hyper Slingshot",
    tip: "利用兩顆脈衝星連續疊加彈射動力，以極速穿越廣闊的深空虛無。",
    startNodeIndex: 0,
    nodes: [
      { x: 150, y: 320, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 3.0, dir: 1 },
      { x: 460, y: 220, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 3.2, dir: -1 },
      { x: 760, y: 400, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 }
    ],
    shards: [
      { x: 300, y: 270 },
      { x: 610, y: 310 },
      { x: 760, y: 260 }
    ],
    obstacles: [
      { type: "laser", x: 300, y: 400, length: 130, rotSpeed: 0.8, angle: 0 },
      { type: "laser", x: 610, y: 180, length: 130, rotSpeed: -0.8, angle: 0 }
    ],
    wormhole: { x: 920, y: 320 }
  },

  // 關卡 12: 雷射星雲
  {
    id: 12,
    title: "雷射星雲",
    subtitle: "Laser Constellation",
    tip: "定時閃爍的雷射將在短暫熄滅後再次亮起，耐心觀察節奏與循環週期。",
    startNodeIndex: 0,
    nodes: [
      { x: 150, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 360, y: 200, type: "inverter", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.5, dir: -1 },
      { x: 570, y: 440, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.5, waypoints: { dx: 60, dy: 0, speed: 1.6 }, dir: 1 },
      { x: 780, y: 220, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: -1 }
    ],
    shards: [
      { x: 255, y: 260 },
      { x: 465, y: 320 },
      { x: 675, y: 330 }
    ],
    obstacles: [
      { type: "laser", x: 360, y: 330, length: 140, rotSpeed: 0, angle: 0, blinking: true, blinkPeriod: 2.4 },
      { type: "laser", x: 570, y: 230, length: 140, rotSpeed: 0, angle: 0, blinking: true, blinkPeriod: 2.4, initialTimer: 1.2 }
    ],
    wormhole: { x: 930, y: 320 }
  },

  // 關卡 13: 動態多星系
  {
    id: 13,
    title: "星系交錯",
    subtitle: "Cosmic Dance",
    tip: "巡航天體與衰變星交織，時機與動態預測的極致考驗！",
    startNodeIndex: 0,
    nodes: [
      { x: 140, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 350, y: 200, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.6, waypoints: { dx: 0, dy: 80, speed: 1.4 }, dir: -1 },
      { x: 560, y: 440, type: "decaying", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, decayTime: 2.6, dir: 1 },
      { x: 770, y: 220, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.6, waypoints: { dx: 0, dy: -80, speed: 1.4 }, dir: -1 }
    ],
    shards: [
      { x: 245, y: 260 },
      { x: 455, y: 320 },
      { x: 665, y: 330 }
    ],
    obstacles: [
      { type: "blackhole", x: 455, y: 440, radius: 24, rotSpeed: 1.5 },
      { type: "laser", x: 665, y: 200, length: 110, rotSpeed: 1.2, angle: 0 }
    ],
    wormhole: { x: 930, y: 320 }
  },

  // 關卡 14: 超新星奔逃
  {
    id: 14,
    title: "超新星奔逃",
    subtitle: "Supernova Rush",
    tip: "連續四顆衰變天體！在每顆恆星熄滅爆炸的短短 2.2 秒內，果斷切線跳躍！",
    startNodeIndex: 0,
    nodes: [
      { x: 130, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 320, y: 320, type: "decaying", orbitRadius: 50, captureRadius: 85, baseSpeed: 3.0, decayTime: 2.2, dir: 1 },
      { x: 500, y: 230, type: "decaying", orbitRadius: 50, captureRadius: 85, baseSpeed: 3.0, decayTime: 2.2, dir: -1 },
      { x: 680, y: 410, type: "decaying", orbitRadius: 50, captureRadius: 85, baseSpeed: 3.0, decayTime: 2.2, dir: 1 },
      { x: 840, y: 250, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 3.2, dir: -1 }
    ],
    shards: [
      { x: 225, y: 320 },
      { x: 500, y: 350 },
      { x: 760, y: 330 }
    ],
    obstacles: [],
    wormhole: { x: 980, y: 320 }
  },

  // 關卡 15: 幾何終曲：萬有引力
  {
    id: 15,
    title: "幾何終曲：引力共振",
    subtitle: "Grand Finale: Resonance",
    tip: "集結所有天體與障礙的終極挑戰！展現你精妙絕倫的幾何軌道跳躍藝術吧！",
    startNodeIndex: 0,
    nodes: [
      { x: 130, y: 320, type: "standard", orbitRadius: 50, captureRadius: 85, baseSpeed: 2.4, dir: 1 },
      { x: 320, y: 190, type: "inverter", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.6, dir: -1 },
      { x: 320, y: 450, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.8, dir: 1 },
      { x: 550, y: 320, type: "mobile", orbitRadius: 55, captureRadius: 90, baseSpeed: 2.6, waypoints: { dx: 0, dy: 70, speed: 1.5 }, dir: -1 },
      { x: 760, y: 190, type: "decaying", orbitRadius: 55, captureRadius: 90, baseSpeed: 3.0, decayTime: 2.4, dir: 1 },
      { x: 760, y: 450, type: "pulsar", orbitRadius: 55, captureRadius: 90, baseSpeed: 3.2, dir: -1 }
    ],
    shards: [
      { x: 320, y: 320 },
      { x: 650, y: 220 },
      { x: 650, y: 420 }
    ],
    obstacles: [
      { type: "blackhole", x: 440, y: 320, radius: 26, rotSpeed: 1.5 },
      { type: "laser", x: 650, y: 320, length: 130, rotSpeed: 1.0, angle: 0 }
    ],
    wormhole: { x: 960, y: 320 }
  }
];

// 無限深空模式生成器 (Endless Mode Procedural Generator)
class EndlessGenerator {
  constructor() {
    this.currentX = 200;
    this.currentY = 320;
    this.leapIndex = 0;
  }

  reset() {
    this.currentX = 200;
    this.currentY = 320;
    this.leapIndex = 0;
  }

  // 生成下一個天體與周圍要素
  generateNextNode() {
    this.leapIndex++;
    const dist = Math.random() * 90 + 200; // 距離 200~290px
    const angleDelta = (Math.random() - 0.5) * 0.9; // 上下偏擺角度
    const targetX = this.currentX + Math.cos(angleDelta) * dist;
    const targetY = Math.min(500, Math.max(140, this.currentY + Math.sin(angleDelta) * dist));

    this.currentX = targetX;
    this.currentY = targetY;

    // 隨跳躍數提高難度，隨機抽取天體類型
    const types = ["standard", "standard", "pulsar", "inverter"];
    if (this.leapIndex > 3) types.push("decaying");
    if (this.leapIndex > 5) types.push("mobile");

    const chosenType = types[Math.floor(Math.random() * types.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 2.2 + Math.min(1.2, this.leapIndex * 0.05);

    const nodeConfig = {
      x: targetX,
      y: targetY,
      type: chosenType,
      orbitRadius: 50 + Math.random() * 10,
      captureRadius: 85 + Math.random() * 10,
      baseSpeed: speed,
      dir: dir
    };

    if (chosenType === "decaying") {
      nodeConfig.decayTime = Math.max(1.8, 3.2 - this.leapIndex * 0.08);
    } else if (chosenType === "mobile") {
      nodeConfig.waypoints = { dx: 0, dy: (Math.random() < 0.5 ? 60 : -60), speed: 1.5 };
    }

    // 隨機在天體間擺放星鑽
    let shard = null;
    if (Math.random() < 0.7) {
      shard = {
        x: targetX - dist * 0.5 + (Math.random() - 0.5) * 40,
        y: (this.currentY + targetY) / 2 + (Math.random() - 0.5) * 60
      };
    }

    // 隨機在跳躍數 > 4 後加入雷射或黑洞障礙
    let obstacle = null;
    if (this.leapIndex > 4 && Math.random() < 0.45) {
      const isBlackhole = Math.random() < 0.35;
      if (isBlackhole) {
        obstacle = {
          type: "blackhole",
          x: targetX - dist * 0.5,
          y: (this.currentY + targetY) / 2 + (Math.random() - 0.5) * 50,
          radius: 22,
          rotSpeed: 1.5
        };
      } else {
        obstacle = {
          type: "laser",
          x: targetX - dist * 0.5,
          y: (this.currentY + targetY) / 2,
          length: 120,
          rotSpeed: (Math.random() - 0.5) * 1.6,
          angle: Math.random() * Math.PI
        };
      }
    }

    return {
      node: new GravityNode(nodeConfig),
      shard: shard ? new Shard(shard.x, shard.y, this.leapIndex % 3) : null,
      obstacle: obstacle ? new Obstacle(obstacle) : null
    };
  }
}

window.GRAVITY_LEVELS = GRAVITY_LEVELS;
window.EndlessGenerator = EndlessGenerator;
