# 選挙投票予定プラットフォーム - Frontend

React + TypeScript + Vite で構築されたフロントエンドアプリケーションです。

## 🚀 クイックスタート

### 必要な環境
- Node.js 18+ 
- npm または yarn

### 環境変数の設定

開発を始める前に、以下の環境変数ファイルを作成してください：

#### `.env` (ローカル開発用)
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=senkyo-yotei.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=senkyo-yotei
VITE_FIREBASE_STORAGE_BUCKET=senkyo-yotei.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# エミュレータ設定（ローカル開発時はtrueに設定）
VITE_USE_FIRESTORE_EMULATOR=true
VITE_USE_AUTH_EMULATOR=true
```

#### `.env.production` (本番デプロイ用)
```bash
# Firebase Configuration（本番環境の値）
VITE_FIREBASE_API_KEY=your-production-api-key
VITE_FIREBASE_AUTH_DOMAIN=senkyo-yotei.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=senkyo-yotei
VITE_FIREBASE_STORAGE_BUCKET=senkyo-yotei.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-production-messaging-sender-id
VITE_FIREBASE_APP_ID=your-production-app-id

# 本番環境ではエミュレータを使用しない
VITE_USE_FIRESTORE_EMULATOR=false
VITE_USE_AUTH_EMULATOR=false
```

**重要**: `.env` ファイルは `.gitignore` に含まれています。本物のFirebaseの設定値を記入してください。

### 開発手順

1. **依存関係をインストール**
   ```bash
   npm install
   ```

2. **Firebaseエミュレータを起動** (別ターミナルで)
   ```bash
   # プロジェクトルートから
   npm run emulators
   # または
   firebase emulators:start
   ```

3. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

   開発サーバーは http://localhost:5173 で起動します。

## 📁 プロジェクト構造

```
src/
├── components/          # 再利用可能なコンポーネント
│   ├── ErrorBoundary.tsx
│   └── Layout.tsx
├── contexts/            # React Context
│   └── AuthContext.tsx
├── firebase/            # Firebase設定とサービス
│   ├── config.ts        # Firebase初期化・エミュレータ接続
│   └── services.ts      # Firestore操作のヘルパー関数
├── pages/              # ページコンポーネント
│   ├── Home.tsx
│   ├── Elections.tsx
│   ├── ElectionDetail.tsx
│   └── CreateElection.tsx
├── types/              # TypeScript型定義
│   └── index.ts
└── App.tsx             # ルートコンポーネント
```

## 🛠 技術スタック

- **フレームワーク**: React 19.1 + TypeScript
- **ビルドツール**: Vite 7.1
- **スタイリング**: Tailwind CSS 4.1
- **ルーティング**: React Router DOM 7.8
- **認証・DB**: Firebase Auth + Firestore
- **バリデーション**: Zod 4.0
- **HTTP クライアント**: Axios 1.11

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 型チェック + ビルド
npm run build

# プレビュー（ビルド結果の確認）
npm run preview

# リンター実行
npm run lint
```

## 🔥 Firebase エミュレータとの連携

### エミュレータ接続の仕組み

- **開発時**: `.env` で `VITE_USE_FIRESTORE_EMULATOR=true` に設定
- **本番時**: `.env.production` で `VITE_USE_FIRESTORE_EMULATOR=false` に設定
- Viteの `import.meta.env.DEV` も併用して二重チェック

### エミュレータのポート

- **Firestore**: `localhost:8080`
- **Auth**: `localhost:9099`  
- **Hosting**: `localhost:5000`

### トラブルシューティング

**「127.0.0.1:8080に接続できない」エラーが出る場合**:
1. Firebaseエミュレータが起動しているか確認
2. `.env` で `VITE_USE_FIRESTORE_EMULATOR=true` になっているか確認
3. 本番デプロイ時は `.env.production` で `false` になっているか確認

## 🚢 デプロイ

本番環境へのデプロイは、プロジェクトルートから以下のコマンドで行います：

```bash
# フロントエンドのビルド
npm run build

# Firebase Hostingにデプロイ
firebase deploy --only hosting
```

## 📊 主要機能

- **認証**: Google OAuth (Firebase Auth)
- **選挙管理**: 作成・一覧表示・詳細表示
- **投票機能**: リアルタイム集計・1人1票制御
- **不支持機能**: 候補者への不支持表明
- **レスポンシブ対応**: モバイル・デスクトップ両対応

## 🔐 セキュリティ

- Firestoreセキュリティルールによる認可制御
- フロントエンドでの入力値バリデーション（Zod）
- XSS対策（React標準 + エスケープ処理）

---

**注意**: より詳細な技術仕様・データモデル・セキュリティ設計については、プロジェクトルートの `architecture.md` を参照してください。
