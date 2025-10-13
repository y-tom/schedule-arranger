// ===== Honoアプリ全体の設定ファイル。ミドルウェア登録（ログ、静的ファイル、セキュリティヘッダーなど）、ルート登録、エラー処理など =====
'use strict';

// ----- モジュールの読み込み -----
const { Hono } = require('hono'); //Hono 本体 ミドルウェア＝拡張機能
const { logger } = require('hono/logger'); //サイトにアクセスされた際のログを自動で出力ミドルウェア
const { html } = require('hono/html'); //HonoでHTMLを返すためのヘルパー。タグ付きテンプレートリテラル
const { HTTPException } = require('hono/http-exception'); //Hono で HTTP の例外を扱うためのモジュール
const { secureHeaders } = require('hono/secure-headers'); //Hono のセキュリティを強化するのに役立つミドルウェア
const { env } = require('hono/adapter'); //	さまざまなランタイムで Hono を使うときに役立つヘルパー
const { serveStatic } = require('@hono/node-server/serve-static'); //	Hono の Node.js 用サーバ
const { trimTrailingSlash } = require('hono/trailing-slash'); //URI の末尾にスラッシュがあるとき無視するミドルウェア
const { githubAuth } = require('@hono/oauth-providers/github'); //Hono の認証用のミドルウェア OAuth Providers から GitHub 認証用のモジュールを読み込み
const { getIronSession } = require('iron-session'); //セッション管理用のモジュール iron-session を読み込み。getIronSession はユーザから送信された Cookie からセッション情報を取り出すための関数
const layout = require('./layout');

// ----- ルートの読み込み -----
const indexRouter = require('./routes/index'); //　/にアクセスされたときの処理にroutes/index.jsのHonoインスタンスを設定
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');

// ----- Honoアプリの作成 -----
const app = new Hono();

// ----- ミドルウェア登録 -----
app.use(logger()); //ログ出力設定 //Honoのuse関数はミドルウェアを登録する関数
app.use(serveStatic({ root: './public' })); //public 内の静的ファイルの配信設定
app.use(secureHeaders()); //セキュリティの設定のためのヘッダを追加
app.use(trimTrailingSlash()); //URI末尾の/を無視する設定

// セッション管理用のミドルウェア
app.use(async (c, next) => {
  const { SESSION_PASSWORD } = env(c); //環境変数からセッション管理用のパスワードを読み出し、ユーザとサーバ間でセッションをやりとりできるようにする。
  const session = await getIronSession(c.req.raw, c.res, { // ユーザから送信されたセッション情報はユーザのCookieに格納されている。Request（Honoではc.req.rawに格納）とResponse（Honoではc.req.resに格納）をgetIronSession（ユーザから送信された Cookie からセッション情報を取り出すための関数)に渡す必要がある。
    password: SESSION_PASSWORD,
    cookieName: 'session',
  });
  c.set('session', session); //'session'変数にiron-sessionのセッションを代入。このミドルウェア内の Context だけではなく、別の Context からも c.get('session') というように参照できる。
  await next(); //次のミドルウェアを実行する命令。 Hono のミドルウェアでは必ず 1 回だけ next 関数を呼び出す必要がある。
});

// GitHub 認証 /auth/github へのアクセスがあった場合、GitHub に対して OAuth 認証を行う
app.use('/auth/github', async (c, next) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env(c); //OAuth認証のために、環境変数にある GITHUB_CLIENT_ID と GITHUB_CLIENT_SECRET が必要
  const authHandler = githubAuth({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    scope: ['user:email'], //scopeはGitHubの機能にどの程度アクセスするかを決めるための識別子。今回は認証に使うだけなので、ユーザのメールアドレスにだけアクセスのできる user:email を指定。例：repo=ユーザの持つすべてのリポジトリへのアクセス権
    oauthApp: true,
  });
  return await authHandler(c, next);
});

// GitHub 認証の後の処理　認証に成功するとGitHubからデータが送られてくる。データはOAuth Middlewareによって変数 'user-github' に格納されている
app.get('/auth/github', async (c) => {
  const session = c.get('session');
  session.user = c.get('user-github'); //user-github' に格納されている認証用のユーザ情報をc.getで取り出し、セッションオブジェクトに登録する
  await session.save(); //ユーザ情報を保存する
  return c.redirect('/'); //認証の処理が完了するのでトップページにリダイレクトする
});

// ----- ルーティング（ルート登録） -----
app.route('/', indexRouter);
app.route('/login', loginRouter);
app.route('/logout', logoutRouter);

// ----- エラー処理 -----
// 404 Not Found 　c=Contextオブジェクト。クライアントからのリクエストやクライアントに返すレスポンスなどを処理する関数などが含まれている
app.notFound((c) => {
  return c.html(
    layout(
      c,
      'Not Found',
      html`
        <h1>Not Found</h1>
        <p>${c.req.url} の内容が見つかりませんでした。</p>
      `,
    ),
    404,
  );
});

// エラーハンドリング
app.onError((error, c) => {
  console.error(error);
  const statusCode = error instanceof HTTPException ? error.status : 500;
  const { NODE_ENV } = env(c);
  return c.html(
    layout(
      c,
      'Error',
      html`
        <h1>Error</h1>
        <h2>${error.name} (${statusCode})</h2>
        <p>${error.message}</p>
        ${NODE_ENV === 'development' ? html`<pre>${error.stack}</pre>` : ''}
      `,
    ),
    statusCode,
  );
});

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
