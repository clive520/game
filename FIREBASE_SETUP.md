# Firebase 設定

三國棋使用 Firebase 專案 `ot-exam-review`。此專案也供其他程式使用，因此遊戲專用資源已加上 `threeKingdoms` 前綴，部署設定只指向專用的具名 Realtime Database。

- Realtime Database：`three-kingdoms-ot-exam-review`，根路徑 `/threeKingdoms/`
- Firestore 棋譜：`threeKingdomsMatches`，每局包含完整 `events` 子集合，只保留最新 300 局
- Cloud Functions：所有 callable、觸發器與排程函式名稱皆以 `threeKingdoms` 開頭
- Authentication：使用 custom token 與 `threeKingdomsClient` claim；不啟用全專案匿名登入
- App Check：reCAPTCHA Enterprise 已註冊至本遊戲 Web App，允許 `clive520.github.io`；所有 callable 均強制 App Check

## 部署

```powershell
firebase deploy --only database:three-kingdoms,firestore:rules,firestore:indexes,functions --project ot-exam-review
```

Firebase Web API key 與 reCAPTCHA site key 是前端使用的公開值。服務帳戶私密金鑰、reCAPTCHA secret 與其他伺服器憑證不得放進 GitHub。
