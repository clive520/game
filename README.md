# 🎮 NEXUS ARCADE (星際遊戲矩陣平台)

一個專為 **GitHub Pages** 打造的極速、現代化 HTML5 純靜態網頁遊戲平台。

* 🌐 **線上遊玩大廳**：[https://clive520.github.io/game/](https://clive520.github.io/game/)
* 🛡️ **《星際守望者：迷宮防線》直達**：[https://clive520.github.io/game/games/cyber-defense/](https://clive520.github.io/game/games/cyber-defense/)
* 🚀 **《量子彈幕：維度穿梭》直達**：[https://clive520.github.io/game/games/quantum-barrage/](https://clive520.github.io/game/games/quantum-barrage/)

---

## 🌟 平台特色
- **100% 純靜態運行**：無後端與重量依賴，秒開載入，原生相容 GitHub Pages。
- **資料驅動多遊戲架構**：透過 `js/games-data.js` 管理遊戲陣容，支援即時關鍵字搜尋、分類過濾與動態卡片渲染。
- **未來科幻視覺風格**：深色電競霓虹美學、自適應響應式佈局 (RWD)。
- **內建完整操作指引**：大廳與各遊戲內部均附帶「📖 遊玩指南」說明彈窗。

---

## 🛡️ 第一款遊戲：《星際守望者：迷宮防線》 (Cyber Defense)
結合「開放式迷宮建造（Mazing）」與「機甲指揮官即時協同」的未來科幻塔防：
- **迷宮建造**：建造防禦塔作為路障，敵人依 A* 演算法即時尋路繞行，延長受擊時間。
- **機甲指揮官**：WASD 或滑鼠右鍵操控，自帶高頻等離子槍，按 [Q] EMP 脈衝癱瘓全場 3.5s，按 [E] 召喚軌道精準轟炸。
- **4 種武裝防禦塔**：光子脈衝塔、重力磁軌砲、電磁緩速塔、巡弋導彈塔，支援 3 階段升級與折價出售。

---

## 🚀 第二款遊戲：《量子彈幕：維度穿梭》 (Quantum Barrage)
快節奏、高技巧性的雙相彈幕射擊（Ikaruga / Shmup 風格）：
- **雙相維度切換 (Shift / Space / 右鍵)**：
  - **Alpha (藍色相)**：吸收藍色彈幕轉化為能量；被紅色彈幕命中失去生命。
  - **Beta (紅色相)**：吸收紅色彈幕轉化為能量；被藍色彈幕命中失去生命。
- **極限擦彈 (Graze)**：貼近敵方子彈擦過微判定圈，賺取大量連擊分數並快速累積量子能量。
- **量子坍縮大絕 [E]**：能量滿載 100% 引爆，全螢幕消彈轉化為分數，並對全體敵人造成毀滅打擊。
- **關卡推進**：包含小型量子無人機、重裝巡洋艦、旋轉浮游砲與終極維度領主 Boss。

---

## 🚀 本地執行方式
本專案為純靜態網站，無需安裝 npm 或任何構建步驟：
1. 直接使用瀏覽器開啟專案根目錄的 `index.html`。
2. 或在專案目錄下啟動任意本地靜態伺服器（例如 `python -m http.server 8000` 或 VS Code Live Server）。

---

## 📦 目錄架構
```text
Game/
├── index.html                  # 遊戲大廳首頁（含分類、搜尋與遊玩指南）
├── css/
│   └── portal.css              # 大廳科技風樣式
├── js/
│   ├── games-data.js           # 遊戲清單數據庫（支援兩款已上線遊戲動態展示）
│   └── portal.js               # 搜尋、分類與動態渲染
└── games/
    ├── cyber-defense/          # 策略塔防：《星際守望者：迷宮防線》
    │   ├── index.html
    │   ├── css/game.css
    │   └── js/ (audio.js, pathfinding.js, entities.js, game.js)
    └── quantum-barrage/        # 動作射擊：《量子彈幕：維度穿梭》
        ├── index.html
        ├── css/game.css
        └── js/ (audio.js, entities.js, game.js)
```
