# HighBar Judge

單槓影片人工輔助評分 App，依 FIG Men's Artistic Gymnastics Code of Points 2025–2028 的核心架構設計。

## 功能

- 匯入並在瀏覽器本機播放比賽影片
- 依時間碼標記動作、動作組別、難度、連結價值與 E 分扣分
- 即時計算 D 分、E 分與預估總分
- 教練角度勾選問題與改善方向
- 匯出 PDF／列印版報告，下載影片後透過 LINE 附檔分享
- 草稿保存在目前瀏覽器的 `localStorage`

## 開發

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## 評分與資料限制

本工具是裁判與教練的人工判讀工作台，不會自動辨識或正式認定動作。拍攝角度、畫質、幀率與遮擋均會影響影片判讀；結果不取代 FIG 認證裁判的正式評分。

規則來源：[FIG Rules](https://www.gymnastics.sport/site/rules/)（MAG Code of Points 2025–2028）。
