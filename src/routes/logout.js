// ===== ログアウトページの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');

// ----- Honoアプリの作成 -----
const app = new Hono();

// ----- ログアウト処理 -----
app.get('/', (c) => {
  const session = c.get('session'); //iron-session のセッションオブジェクトを受け取る
  session?.destroy(); //セッションを破棄する
  return c.redirect('/'); //トップページにリダイレクトする
});

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
