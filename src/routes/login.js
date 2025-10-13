// ===== ログインページの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');

// ----- Honoアプリの作成 -----
const app = new Hono();

// ----- ログイン処理 -----
app.get('/', (c) => {
  const { user } = c.get('session') ?? {};
  return c.html(
    layout( //layout.jsで作成したlayout関数にtitle（'Login'）とbody（html`~`）を渡してHTMLを描画。少ない記述量で HTML を書ける。
      c,
      'Login',
      html`
        <h1>Login</h1>
        <a href="/auth/github">GitHub でログイン</a>
        ${user
          ? html`<p>現在 ${user.login} でログイン中</p>`
          : ''}
      `,
    ),
  );
});

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
