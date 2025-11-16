// ===== サーバを起動（これまではapp.jsに直接記述していたが今回は別ファイルに記述） =====
// ----- モジュールの読み込み -----
const { serve } = require('@hono/node-server');
const app = require('./app'); //app.js ファイルでアプリを読み込む。ロード状態

// ----- サーバー設定 -----
const port = Number(process.env.PORT) || 3000; //サーバーが待ち受けるポート番号。Renderか、http://localhost:3000/ にアクセスするとアプリが応答。
console.log(`Server running at http://localhost:${port}/`);

// ----- サーバー起動 -----
//serve()=Node.js上でHonoアプリをHTTPサーバーとして起動する関数。@hono/node-serverパッケージから提供されている。
serve({
  fetch: app.fetch, // リクエストを処理する。app.fetchはHonoが持つリクエスト処理関数。ブラウザのfetchAPIと同様にリクエストを受け取りレスポンスを返す
  port,
});
