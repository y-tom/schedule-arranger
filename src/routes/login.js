// ===== ログインページの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const { html } = require('hono/html');
const { setCookie } = require('hono/cookie');
const layout = require('../layout');

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- ログイン処理 -----
app.get('/', (c) => {
  const from = c.req.query('from'); //ログインページ表示時にどこからログインしようとしたかを10分間Cookieに保存
  if (from) {
    setCookie(c, 'loginFrom', from, { maxAge: 1000 * 60 * 10 });
  }
  return c.html( //ログインページを表示
    layout( //layout.jsで作成したlayout関数にtitle（'Login'）とbody（html`~`）を渡してHTMLを描画。少ない記述量で HTML を書ける。
      c,
      'Login',
      html`
        <a href="/auth/github" class="btn btn-primary my-3">
          GitHub でログイン
        </a>
      `,
    ),
  );
});

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
