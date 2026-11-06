# HighBar Judge

單槓影片人工輔助評分 App，依 FIG Men's Artistic Gymnastics Code of Points 2025–2028 的核心架構設計。

## 功能

- 匯入並在瀏覽器本機播放比賽影片
- 以 MoveNet Thunder 在影片上疊加 OpenPose-style 17 點骨架
- 以雙輪取樣、骨架特徵與動作時序產生 FIG 動作候選，顯示中英文名稱、代碼、簡化規則圖、難度與建議分
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

本工具是裁判與教練的人工判讀工作台。自動分析只會產生候選結果，不會正式認定動作。單一畫面的 2D 骨架無法完整判定旋轉圈數、握法、飛行路徑與落地品質；拍攝角度、畫質、幀率與遮擋也會影響結果，仍須由合格裁判逐項確認。

規則圖是依 FIG 動作代碼自行重繪的教學用簡化姿態，不是 FIG 原圖；若文字與圖示不同，以 FIG 規則文字為準。

規則來源：[FIG Rules](https://www.gymnastics.sport/site/rules/)（MAG Code of Points 2025–2028）。
