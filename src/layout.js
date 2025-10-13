//Hono の html ヘルパーを使ってレイアウトを定義
const { html } = require('hono/html');

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

module.exports = layout;
