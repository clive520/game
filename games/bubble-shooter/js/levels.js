/**
 * 《星際泡泡龍：光子消消樂》關卡庫與無盡生成器 (Levels & Generator)
 * 包含 20 個經典星圖幾何關卡，以及無盡下壓模式的動態行生成演算法
 */

const R = "red";
const B = "blue";
const G = "green";
const Y = "yellow";
const P = "purple";
const O = "orange";
const BOMB = "bomb";
const LASER = "laser";
const RAINBOW = "rainbow";
const _ = null;

const BUBBLE_LEVELS = [
  // 關卡 1: 基礎教學 - 三色入門
  {
    id: 1,
    title: "光子原點",
    subtitle: "Photon Genesis",
    tip: "使用滑鼠或手指瞄準！將相同顏色的泡泡湊成 3 顆以上即可連鎖消除！",
    layout: [
      [R, R, B, B, G, G, R, R, B, B],
      [R, R, B, B, G, R, R, B, B],
      [G, G, R, R, B, B, G, G, R, R]
    ]
  },

  // 關卡 2: 雙色條紋
  {
    id: 2,
    title: "雙色條紋",
    subtitle: "Stripe Pattern",
    tip: "善用左右兩側牆壁進行鏡面折射反彈，精準擊中縫隙深處的泡泡！",
    layout: [
      [B, B, Y, Y, B, B, Y, Y, B, B],
      [Y, Y, B, B, Y, B, B, Y, Y],
      [B, B, Y, Y, B, B, Y, Y, B, B],
      [Y, Y, B, B, Y, B, B, Y, Y]
    ]
  },

  // 關卡 3: 三角幾何星圖
  {
    id: 3,
    title: "三角星圖",
    subtitle: "Tri-Constellation",
    tip: "只要打斷上層的支撐點，下方所有懸空的泡泡將一口氣全部掉落！",
    layout: [
      [R, R, R, G, G, G, G, B, B, B],
      [_, R, R, G, G, G, B, B, _],
      [_, _, R, G, G, B, _, _, _],
      [_, _, _, G, G, _, _, _, _]
    ]
  },

  // 關卡 4: 高爆炸彈登場 (Bomb)
  {
    id: 4,
    title: "反物質高爆彈",
    subtitle: "Matter Bomb",
    tip: "擊中帶有 💣 標誌的炸彈球，將瞬間引爆周圍 3×3 範圍內所有泡泡！",
    layout: [
      [P, P, P, Y, Y, Y, Y, P, P, P],
      [P, P, _, Y, BOMB, Y, _, P, P],
      [O, O, O, Y, Y, Y, Y, O, O, O],
      [O, O, _, _, _, _, _, O, O]
    ]
  },

  // 關卡 5: 彩虹拱橋
  {
    id: 5,
    title: "彩虹拱橋",
    subtitle: "Rainbow Arch",
    tip: "按鍵盤【C】或點擊砲台左側可隨時切換下一發備用球，靈活應變！",
    layout: [
      [R, R, O, O, Y, Y, G, G, B, B],
      [R, O, O, Y, Y, G, G, B, B],
      [R, R, _, _, _, _, _, _, B, B],
      [_, _, _, P, P, P, P, _, _, _]
    ]
  },

  // 關卡 6: 鑽石星雲
  {
    id: 6,
    title: "鑽石星雲",
    subtitle: "Diamond Core",
    tip: "集中火力打擊鑽石頂點，享受大片崩塌脫落的巨額連擊積分！",
    layout: [
      [_, _, G, G, G, G, G, G, _, _],
      [_, G, B, B, B, B, B, G, _],
      [G, B, P, P, P, P, B, G, G],
      [_, G, B, B, B, B, B, G, _],
      [_, _, G, G, G, G, G, G, _, _]
    ]
  },

  // 關卡 7: 貫穿光子雷射登場 (Laser)
  {
    id: 7,
    title: "貫穿光子雷射",
    subtitle: "Laser Pulse",
    tip: "擊中帶有 ⚡ 閃電標誌的雷射球，整橫排泡泡將被徹底掃蕩消滅！",
    layout: [
      [R, R, B, B, Y, Y, G, G, P, P],
      [LASER, R, B, Y, G, P, B, LASER, R],
      [R, R, B, B, Y, Y, G, G, P, P],
      [B, B, Y, Y, G, G, P, P, R, R]
    ]
  },

  // 關卡 8: 旋渦星系
  {
    id: 8,
    title: "旋渦星系",
    subtitle: "Spiral Galaxy",
    tip: "色彩交錯螺旋！觀察牆壁反彈角度，穿透外圍防線直攻內核。",
    layout: [
      [O, O, B, B, O, O, B, B, O, O],
      [B, P, P, Y, Y, P, P, B, B],
      [O, P, G, G, G, G, P, B, O],
      [B, P, G, R, R, G, P, B, B],
      [O, P, G, G, G, G, P, B, O]
    ]
  },

  // 關卡 9: 七彩量子萬能球 (Rainbow Wild)
  {
    id: 9,
    title: "七彩量子萬能球",
    subtitle: "Quantum Rainbow",
    tip: "🌈 七彩萬能球可視為任何顏色，能與鄰近任何顏色的泡泡直接觸發消除！",
    layout: [
      [P, P, R, R, RAINBOW, RAINBOW, G, G, B, B],
      [P, R, R, Y, Y, Y, G, B, B],
      [P, P, _, Y, Y, Y, Y, _, B, B],
      [_, _, _, _, O, O, _, _, _, _]
    ]
  },

  // 關卡 10: 蜂巢壁壘
  {
    id: 10,
    title: "蜂巢壁壘",
    subtitle: "Hex Citadel",
    tip: "緊密排列的堅固蜂巢陣列，考驗你對反彈角度的掌控！",
    layout: [
      [Y, Y, Y, Y, Y, Y, Y, Y, Y, Y],
      [O, O, O, O, O, O, O, O, O],
      [BOMB, G, G, G, G, G, G, G, G, BOMB],
      [B, B, B, B, B, B, B, B, B],
      [P, P, P, P, P, P, P, P, P, P]
    ]
  },

  // 關卡 11: 星際之心
  {
    id: 11,
    title: "星際之心",
    subtitle: "Cosmic Heart",
    tip: "優雅浪漫的心形星圖排列，尋找左右心尖的脆弱連接點！",
    layout: [
      [_, R, R, _, _, _, _, R, R, _],
      [R, R, R, R, _, R, R, R, R],
      [R, R, R, R, R, R, R, R, R, R],
      [_, R, R, R, R, R, R, R, _],
      [_, _, R, R, R, R, R, _, _, _],
      [_, _, _, R, R, R, _, _, _]
    ]
  },

  // 關卡 12: 引力雙星爆
  {
    id: 12,
    title: "引力雙星爆",
    subtitle: "Binary Blast",
    tip: "左右兩顆對稱高爆炸彈！引爆一顆即可連鎖引發全屏大崩塌。",
    layout: [
      [G, G, G, P, P, P, P, G, G, G],
      [G, BOMB, G, P, P, P, G, BOMB, G],
      [G, G, G, B, B, B, B, G, G, G],
      [_, _, _, B, B, B, B, _, _, _],
      [_, _, _, _, Y, Y, _, _, _, _]
    ]
  },

  // 關卡 13: 幾何十字星
  {
    id: 13,
    title: "雷射星芒十字",
    subtitle: "Laser Cross",
    tip: "利用中間的貫穿雷射切斷垂直軸心，讓兩側陣列瞬間墜落！",
    layout: [
      [_, _, _, _, B, B, _, _, _, _],
      [_, _, _, B, B, B, _, _, _],
      [R, R, R, LASER, B, B, LASER, R, R, R],
      [_, _, _, B, B, B, _, _, _],
      [_, _, _, _, B, B, _, _, _, _]
    ]
  },

  // 關卡 14: 懸空群島
  {
    id: 14,
    title: "懸空群島",
    subtitle: "Floating Isles",
    tip: "小心！若是連續失誤未產生消除，頂部天花板將會逐漸下壓！",
    layout: [
      [R, R, _, _, G, G, _, _, B, B],
      [R, _, _, G, G, G, _, _, B],
      [_, _, P, P, _, _, Y, Y, _, _],
      [_, P, P, P, _, Y, Y, Y, _],
      [_, _, P, _, _, _, Y, _, _, _]
    ]
  },

  // 關卡 15: 五芒星圖
  {
    id: 15,
    title: "五芒星輝",
    subtitle: "Pentagram Ray",
    tip: "五彩繽紛的星芒輪廓，中央藏有珍貴的彩虹萬能球！",
    layout: [
      [Y, Y, Y, Y, Y, Y, Y, Y, Y, Y],
      [_, Y, B, B, B, B, B, Y, _],
      [_, _, Y, RAINBOW, RAINBOW, Y, _, _, _],
      [_, Y, R, R, R, R, R, Y, _],
      [Y, Y, Y, Y, Y, Y, Y, Y, Y, Y]
    ]
  },

  // 關卡 16: 原子軌道
  {
    id: 16,
    title: "原子軌道",
    subtitle: "Atomic Orbital",
    tip: "同心圓環層層包裹，耐心逐層瓦解！",
    layout: [
      [P, P, P, P, P, P, P, P, P, P],
      [P, G, G, G, G, G, G, G, P],
      [P, G, B, B, B, B, B, G, P, P],
      [P, G, B, Y, Y, Y, B, G, P],
      [P, G, B, B, B, B, B, G, P, P],
      [P, G, G, G, G, G, G, G, P]
    ]
  },

  // 關卡 17: 超新星連鎖
  {
    id: 17,
    title: "超新星連鎖",
    subtitle: "Supernova Chain",
    tip: "雙炸彈 ＋ 雙雷射！觸發一次極限大爆破的夢幻連鎖！",
    layout: [
      [R, BOMB, R, B, B, B, B, G, BOMB, G],
      [R, R, R, B, B, B, G, G, G],
      [LASER, Y, Y, Y, Y, Y, Y, Y, Y, LASER],
      [P, P, P, P, P, P, P, P, P],
      [O, O, O, O, O, O, O, O, O, O]
    ]
  },

  // 關卡 18: 幾何時空晶格
  {
    id: 18,
    title: "時空晶格",
    subtitle: "Spacetime Lattice",
    tip: "棋盤交錯式排列，每個折射路徑都需要深思熟慮！",
    layout: [
      [R, B, R, B, R, B, R, B, R, B],
      [B, R, B, R, B, R, B, R, B],
      [G, Y, G, Y, G, Y, G, Y, G, Y],
      [Y, G, Y, G, Y, G, Y, G, Y],
      [P, O, P, O, P, O, P, O, P, O]
    ]
  },

  // 關卡 19: 混沌星雲
  {
    id: 19,
    title: "混沌星雲",
    subtitle: "Chaos Nebula",
    tip: "全六色高度混合！善用備彈交換與萬能球化解危機。",
    layout: [
      [R, G, B, Y, P, O, R, G, B, Y],
      [P, O, R, G, B, Y, P, O, R],
      [RAINBOW, B, Y, P, O, R, G, B, Y, RAINBOW],
      [G, B, Y, BOMB, BOMB, Y, B, G, P],
      [R, G, B, Y, P, O, R, G, B, Y]
    ]
  },

  // 關卡 20: 星際龍之冠 (終極神陣)
  {
    id: 20,
    title: "終極星際龍之冠",
    subtitle: "Dragon's Crown",
    tip: "第 20 關大圓滿終極星圖！展現你超凡的神級彈射消除技巧吧！",
    layout: [
      [P, P, BOMB, P, RAINBOW, RAINBOW, P, BOMB, P, P],
      [P, LASER, P, P, P, P, P, LASER, P],
      [R, R, G, G, B, B, Y, Y, O, O],
      [R, G, G, B, B, Y, Y, O, O],
      [O, O, Y, Y, B, B, G, G, R, R],
      [O, Y, Y, B, B, G, G, R, R],
      [_, _, BOMB, _, _, _, _, BOMB, _, _]
    ]
  }
];

// 無盡模式隨機新行生成器
class EndlessBubbleGenerator {
  static generateRow(cols = 10, isOdd = false) {
    const numCols = isOdd ? cols - 1 : cols;
    const colors = window.STANDARD_COLORS;
    const row = [];

    for (let c = 0; c < numCols; c++) {
      // 3% 機率生成特殊球 (炸彈/雷射/彩虹)
      const r = Math.random();
      if (r < 0.015) {
        row.push(BOMB);
      } else if (r < 0.025) {
        row.push(LASER);
      } else if (r < 0.035) {
        row.push(RAINBOW);
      } else {
        row.push(colors[Math.floor(Math.random() * colors.length)]);
      }
    }
    return row;
  }
}

window.BUBBLE_LEVELS = BUBBLE_LEVELS;
window.EndlessBubbleGenerator = EndlessBubbleGenerator;
