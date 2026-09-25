/**
 * 遊戲平台清單資料庫 (Games Database)
 * 未來新增遊戲只需在此陣列新增設定物件即可自動在首頁呈現與分類
 */
const GAMES_DATA = [
  {
    id: "cyber-defense",
    title: "星際守望者：迷宮防線",
    subtitle: "Cyber Defense: Mazing Protocol",
    category: "strategy", // strategy | action | puzzle | arcade
    categoryName: "策略塔防",
    badge: "🔥 首發旗艦",
    status: "playable", // playable | coming_soon
    path: "./games/cyber-defense/index.html",
    icon: "🛡️",
    thumbnailGradient: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #06b6d4 100%)",
    description: "開放式迷宮建造塔防！自訂防禦塔路障引導機械軍團，操作星際指揮官機甲親臨戰場，搭配 A* 動態尋路演算法的極限攻防。",
    tags: ["科幻太空", "開放迷宮", "A*尋路", "英雄操控", "Canvas 60FPS"],
    features: [
      "自由建造迷宮，引導敵人動態變更路徑",
      "全鍵盤/滑鼠即時操控指揮官機甲",
      "4 種高科技防禦塔與多元機械侵略者",
      "全屏打擊與 EMP 脈衝戰術技能"
    ],
    version: "v1.0-Alpha",
    author: "clive520"
  },
  {
    id: "quantum-barrage",
    title: "量子彈幕：維度穿梭",
    subtitle: "Quantum Barrage",
    category: "action",
    categoryName: "動作射擊",
    badge: "🔥 全新上線",
    status: "playable",
    path: "./games/quantum-barrage/index.html",
    icon: "🚀",
    thumbnailGradient: "linear-gradient(135deg, #18181b 0%, #3b0764 50%, #f43f5e 100%)",
    description: "快節奏雙相彈幕射擊！在藍/紅維度間穿梭吸收同色彈幕轉化能量，極限擦彈累積量子充能，引爆全螢幕消彈衝擊波。",
    tags: ["雙相維度", "同色吸收", "寶物掉落", "武器升級", "追蹤飛彈", "Canvas 60FPS"],
    features: [
      "Ikaruga 風格雙相維度切換與同色吸收",
      "敵人戰利品掉落與 5 階武裝進階升級系統",
      "高爆自動導向追蹤飛彈群與星辰穿透砲",
      "極限擦彈 (Graze) 與全螢幕量子坍縮消彈引爆"
    ],
    version: "v1.0-Release",
    author: "clive520"
  },
  {
    id: "gravity-pulse",
    title: "引力回圈：重力幾何",
    subtitle: "Gravity Pulse",
    category: "puzzle",
    categoryName: "休閒益智",
    badge: "🔥 全新上線",
    status: "playable",
    path: "./games/gravity-pulse/index.html",
    icon: "🪐",
    thumbnailGradient: "linear-gradient(135deg, #022c22 0%, #064e3b 50%, #10b981 100%)",
    description: "節奏流暢的軌道幾何彈射！在多元引力天體間接力躍遷，避開幾何雷射與奇點黑洞，收集星鑽穿透超空間蟲洞。",
    tags: ["幾何引力", "軌道彈射", "時機跳躍", "無盡深空", "Canvas 60FPS"],
    features: [
      "五大特色幾何天體（脈衝加速、維度反轉、衰變超新星等）",
      "即時切線發射預測軌跡演算系統",
      "15 個精心編排幾何星系關卡 ＋ 無盡深空程序化生成",
      "純 Web Audio 幾何空靈共振音效與星鑽琶音"
    ],
    version: "v1.0-Release",
    author: "clive520"
  },
  {
    id: "bubble-shooter",
    title: "萌龍蜂巢消消樂：六角泡泡",
    subtitle: "Honeycomb Bubble Dragon: Moe Pop",
    category: "arcade",
    categoryName: "經典街機",
    badge: "🔥 萌度爆表",
    status: "playable",
    path: "./games/bubble-shooter/index.html",
    icon: "🐲",
    thumbnailGradient: "linear-gradient(135deg, #ff6b8b 0%, #7048e8 50%, #38d9a9 100%)",
    description: "超萌星際小恐龍發射蜂巢六角形果凍泡泡！精準折射瞄準、懸空大面積脫落暴爽消除，搭配大眼表情糖果六角球！",
    tags: ["蜂巢六角", "萌系泡泡龍", "三消爆破", "小恐龍砲台", "Canvas 60FPS"],
    features: [
      "超萌蜂巢六角形大眼果凍怪與萌龍砲台",
      "精準鏡面反彈折射瞄準虛線",
      "三消連鎖爆破與懸空蜂巢重力脫落判定",
      "高爆炸彈、貫穿雷射、七彩彩虹等萌系特殊球"
    ],
    version: "v1.1-MoeHex",
    author: "clive520"
  },
  {
    id: "knife-storm",
    title: "飛刀大作戰：月牙刃風暴",
    subtitle: "Knife Storm: Crescent Clash",
    category: "action",
    categoryName: "動作競技",
    badge: "🔥 全新上線",
    status: "playable",
    path: "./games/knife-storm/index.html",
    icon: "🗡️",
    thumbnailGradient: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)",
    description: "風靡全球的飛刀大亂鬥！操控俠客環繞月牙刀陣，吃刀擴張旋風風暴，開啟金鐘罩反彈對手，直擊肉身爆刀終結！",
    tags: ["飛刀大作戰", "月牙刃", "IO大亂鬥", "金鐘罩", "大逃殺吃雞", "Canvas 60FPS"],
    features: [
      "月牙飛刀環繞旋風與散落氣泡拾取擴張",
      "三大戰術姿態：大範圍進攻、金鐘罩防禦彈刀、疾風突進",
      "激烈刀刃對撞火花與直擊肉身大爆飛刀",
      "10 人同場智慧 AI 競技 ＋ 大逃殺縮圈決戰"
    ],
    version: "v1.0-Release",
    author: "clive520"
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = GAMES_DATA;
}
