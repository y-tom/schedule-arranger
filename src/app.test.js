// ===== Jestを使ったテストコード =====
//Jest=JavaScript 用のテスティングフレームワークの1つ。実装方法がシンプル、テストの実行結果をわかりやすく表示してくれるなどの便利な機能。Node.js,Babel,TypeScript,Reactなどで利用できる
'use strict';

describe('/login', () => {
  test('ログインのためのリンクが含まれる', async () => {
    const app = require('./app');
    const res = await app.request('/login');
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8');
    expect(await res.text()).toMatch(/<a href="\/auth\/github"/);
    expect(res.status).toBe(200);
  });
});

/*
テストブロックを作る関数
describe('テストブロックの名前', () => {
  test('1 つ目のテストの名前', () => {
    // 1 つ目のテストの内容;
  });
  test('2 つ目のテストの名前', () => {
    // 2 つ目のテストの内容;
  });
　：
});
*/
