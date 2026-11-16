# 三國棋

三人同玩的六角棋盤策略遊戲。支援本機對弈、真人與電腦混合對弈，以及線上房間與公開棋譜。

## 遊玩

GitHub Pages：<https://clive520.github.io/game/>

## Firebase

本遊戲與其他應用共用 Firebase 專案 `ot-exam-review`，遊戲資源各自使用專用前綴：

- Realtime Database：`three-kingdoms-ot-exam-review`，遊戲資料位於 `/threeKingdoms/`
- Firestore：`threeKingdomsMatches` 棋譜集合
- Cloud Functions：所有名稱均以 `threeKingdoms` 開頭
- Authentication：使用帶有 `threeKingdomsClient` claim 的自訂權杖，不會啟用全專案匿名登入
- App Check：reCAPTCHA Enterprise 僅允許 `clive520.github.io`

前端 Firebase Web 設定與 reCAPTCHA site key 是公開識別資訊。請勿將服務帳戶私密金鑰、reCAPTCHA secret 或其他伺服器憑證提交至此 repo。

## 部署 Firebase 後端

需要已登入 Firebase CLI，並具備 `ot-exam-review` 專案部署權限：

```powershell
firebase deploy --only database:three-kingdoms,firestore:rules,firestore:indexes,functions --project ot-exam-review
```

GitHub Pages 由 `.github/workflows/pages.yml` 在推送 `main` 分支後自動發布。
