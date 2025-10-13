const { Hono } = require('hono'); //Honoのモジュールを読み込む
const { html } = require('hono/html'); //HTMLへルパーを読み込む
const layout = require('../layout');

const app = new Hono(); //Honoインスタンスを作成。Honoの機能が使えるようになる。

app.get('/', (c) => {
  return c.html(
    layout(
      c,
      'Home',
      html`
        <h1>Hello, Hono!</h1>
      `,
    ),
  );
});

module.exports = app;
