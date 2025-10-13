// ===== レイアウトのテンプレート =====
const { html } = require('hono/html');

// ----- 共通のレイアウトを定義する関数layoutを作る -----
//タイトルと本文を受け取り、HTML としてレンダーしたものを返す
//public/stylesheets/style.css をスタイルシートとして読み込み。layoutを使って作成したすべてのページにstyle.css のスタイルが適用される
function layout(c, title, body) {
  return html`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <link rel="stylesheet" href="/stylesheets/style.css" />
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}

// ----- アプリのエクスポート -----
module.exports = layout; //他ファイルで require('./layout') と書くとこのappが読み込める
