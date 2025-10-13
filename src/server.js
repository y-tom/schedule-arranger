//サーバを起動するためのファイル。これまでは、src/app.js に直接記述してい今回はたが、今回は別ファイルに記述
const { serve } = require('@hono/node-server');
const app = require('./app');

const port = 3000; //サーバーが待ち受けるポート番号。http://localhost:3000/ にアクセスするとアプリが応答。
console.log(`Server running at http://localhost:${port}/`);

//serve()でNode.js上でHonoアプリ（サーバー）を立ち上げる。@hono/node-serverパッケージから提供される関数。
serve({
  fetch: app.fetch, // app.fetchはHonoが持つリクエスト処理関数。これはブラウザのfetchAPIと同様にリクエストを受け取りレスポンスを返す
  port,
});
