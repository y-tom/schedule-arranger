'use strict';

const { Hono } = require('hono'); //Hono 本体 ミドルウェア＝拡張機能
const { logger } = require('hono/logger'); //サイトにアクセスされた際のログを自動で出力ミドルウェア
const { html } = require('hono/html'); //HonoでHTMLを返すためのヘルパー。タグ付きテンプレートリテラル
const { HTTPException } = require('hono/http-exception'); //Hono で HTTP の例外を扱うためのモジュール
const { secureHeaders } = require('hono/secure-headers'); //Hono のセキュリティを強化するのに役立つミドルウェア
const { env } = require('hono/adapter'); //	さまざまなランタイムで Hono を使うときに役立つヘルパー
const { serveStatic } = require('@hono/node-server/serve-static'); //	Hono の Node.js 用サーバ
const { trimTrailingSlash } = require('hono/trailing-slash'); //URI の末尾にスラッシュがあるとき無視するミドルウェア
const layout = require('./layout');

const indexRouter = require('./routes/index'); //　/にアクセスされたときの処理にroutes/index.jsのHonoインスタンスを設定

const app = new Hono(); //Honoインスタンスを作成。Honoの機能が使えるようになる。

app.use(logger()); //ログ出力設定 //Honoのuse関数はミドルウェアを登録する関数
app.use(serveStatic({ root: './public' })); //public 内の静的ファイルの配信設定
app.use(secureHeaders()); //セキュリティの設定のためのヘッダを追加
app.use(trimTrailingSlash()); //URI末尾の/を無視する設定

// ルーティング
app.route('/', indexRouter);

// 404 Not Found //c=Contextオブジェクト。クライアントからのリクエストやクライアントに返すレスポンスなどを処理する関数などが含まれている
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

module.exports = app; //ここで作成したHonoインスタンスをモジュールに提供し外部に公開
