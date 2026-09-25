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
    tags: ["雙相維度", "同色吸收", "極限擦彈", "量子消彈", "Canvas 60FPS"],
    features: [
      "Ikaruga 風格雙相維度切換與彈幕吸收",
      "微秒級極限擦彈 (Graze) 評分系統",
      "能量滿載引爆全螢幕量子坍縮大絕",
      "多波次敵軍與終極維度領主 Boss 戰"
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
    badge: "🧩 籌備中",
    status: "coming_soon",
    path: "#",
    icon: "🪐",
    thumbnailGradient: "linear-gradient(135deg, #022c22 0%, #064e3b 50%, #10b981 100%)",
    description: "基於物理模擬的重力解謎遊戲。發射微型探針並操縱星球引力場，穿透時空裂隙引導信號返回母星。",
    tags: ["物理益智", "引力模擬", "極簡美學", "休閒放鬆"],
    features: [
      "真實多體天體引力模擬",
      "50+ 漸進式思維謎題",
      "環境環境音效放鬆體驗"
    ],
    version: "規劃中",
    author: "clive520"
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = GAMES_DATA;
}
