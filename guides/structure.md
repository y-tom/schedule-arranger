# プロジェクト構造と主なファイルの役割

このドキュメントは、Hono + Prisma + Node.js を使用したアプリケーションの **主なファイルの役割** と **処理の流れ** をまとめたものです。

app.js：アプリの中心、ルーティング・ミドルウェア・DB操作
server.js：HTTPサーバとして起動するためのエントリーポイント
routes/*.js：各ページ専用ルーター
prisma/schema.prisma：DB構造とPrisma Client用のモデル
layout.js：共通HTMLレイアウト
public/：静的ファイル（CSSなど）

---

## 1. src/app.js ― Honoアプリ全体の設定

### 役割
- アプリの中核
- ミドルウェア登録（ログ出力、静的ファイル、セキュリティヘッダー）
- GitHub OAuth認証処理
- ルート登録（index, login, logout）
- エラー処理（404, その他の例外）
- Prisma Clientを使ったDB接続

### 主な処理
```javascript
// Honoの初期化
const app = new Hono();
const prisma = new PrismaClient({ log: [ 'query' ] });

// ミドルウェア登録
app.use(logger());                // アクセスログ出力
app.use(serveStatic({ root: './public' })); // 静的ファイル配信
app.use(secureHeaders());         // セキュリティヘッダー
app.use(trimTrailingSlash());     // URI末尾のスラッシュ無視

// セッション管理
app.use(async (c, next) => {
  const session = await getIronSession(c.req.raw, c.res, { ... });
  c.set('session', session);
  await next();
});

// GitHub OAuth認証
app.use('/auth/github', async (c, next) => {
  return await githubAuth({ client_id, client_secret, scope: ['user:email'], oauthApp: true })(c, next);
});

// GitHub認証後の処理
app.get('/auth/github', async (c) => {
  const session = c.get('session');
  const githubUser = c.get('user-github');
  session.user = { id: githubUser.id, login: githubUser.login };
  await session.save();

  // DBに保存
  await prisma.user.upsert({
    where: { userId: session.user.id },
    update: { userId: session.user.id, username: session.user.login },
    create: { userId: session.user.id, username: session.user.login },
  });

  return c.redirect('/');
});

// ルート登録
app.route('/', indexRouter);
app.route('/login', loginRouter);
app.route('/logout', logoutRouter);

// エラー処理
app.notFound((c) => { ... });
app.onError((error, c) => { ... });

module.exports = app;
```
--

## 2. src/server.js ― アプリを起動するサーバ

### 役割
- app.js をHTTPサーバとして起動
- ポート番号3000で待ち受け
- Node.js上でHonoアプリを提供

### 主な処理
```javascript
const { serve } = require('@hono/node-server');
const app = require('./app');

const port = 3000;
console.log(`Server running at http://localhost:${port}/`);

serve({
  fetch: app.fetch,
  port,
});
```
--

## 3. src/routes/index.js ― トップページ

### 役割
- / にアクセスされたときの表示
- ユーザがログインしているかどうかで表示内容を切り替える

### 主な処理
```javascript
app.get('/', (c) => {
  const { user } = c.get('session') ?? {};
  return c.html(
    layout(
      c,
      'Home',
      html`
        <h1>Hello, Hono!</h1>
        ${user
          ? html`<div><a href="/logout">${user.login} をログアウト</a></div>`
          : html`<div><a href="/login">ログイン</a></div>`}
      `
    )
  );
});
```
--

## 4. src/routes/login.js ― ログインページ

### 役割
- /login にアクセスされたときの表示
- GitHub OAuth認証へのリンクを提供

### 主な処理
```javascript
app.get('/', (c) => {
  const { user } = c.get('session') ?? {};
  return c.html(
    layout(
      c,
      'Login',
      html`
        <h1>Login</h1>
        <a href="/auth/github">GitHub でログイン</a>
        ${user ? html`<p>現在 ${user.login} でログイン中</p>` : ''}
      `
    )
  );
});
```

--

## 5. prisma/schema.prisma ― DB構造とPrisma Client

### 役割
- データベースのテーブル定義
- Prisma Client生成用のモデル定義
- リレーション・インデックス・制約の管理

### 主なモデル
- User：ユーザ情報（users テーブル）
- Schedule：スケジュール（作成者、候補者、コメントとのリレーション）
- Candidate：スケジュール候補
- Availability：候補者ごとのユーザの出欠情報
- Comment：スケジュールに対するコメント

