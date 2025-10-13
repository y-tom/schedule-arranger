// ===== Jestを使ったテストコード =====
//Jest=JavaScript 用のテスティングフレームワークの1つ。実装方法がシンプル、テストの実行結果をわかりやすく表示してくれるなどの便利な機能。Node.js,Babel,TypeScript,Reactなどで利用できる
//今回実装しているのは、ユニットテスト（モジュール単体）、結合テスト（複数モジュール）、システムテスト（全体）のうち、ユニットテスト
'use strict';

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

describe('/login', () => {

  // ----- 認証時のテスト -----
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    const ironSession = require('iron-session'); // jest.spyOn関数は、特定のオブジェクトのメソッドを監視する関数　今回はgetIronSession関数を監視
    jest.spyOn(ironSession, 'getIronSession').mockReturnValue({ //mockFn.mockReturnValue関数でgetIronSession関数をモック化（テストを動かすための最低限の関数に変換）して、user/save/destroyを持つオブジェクトを返すようにしている
      user: { login: 'testuser' }, //ログインはtestuserというユーザー名で行う
      save: jest.fn(), //セッション情報を保存
      destroy: jest.fn(), //セッション情報を破棄
    });
  });
  afterAll(() => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
  });

  // ----- リクエストのテスト -----
  test('ログインのためのリンクが含まれる', async () => {
    const app = require('./app');
    const res = await app.request('/login'); // /loginにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8'); //レスポンスヘッダの 'Content-Type' が text/html; charset=utf-8 であることのテスト
    expect(await res.text()).toMatch(/<a href="\/auth\/github"/); //<a href="/auth/github" が HTML に含まれることのテスト
    expect(res.status).toBe(200); //ステータスコードが200 OKで返ることのテスト
  });

  // ----- ログイン時の表示のテスト -----
  test('ログイン時はユーザ名が表示される', async () => {
    const app = require('./app');
    const res = await app.request('/login'); // /loginにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(await res.text()).toMatch(/testuser/); //HTMLのbody内のテキストを取得し、testuserという文字列が含まれることをテスト
    expect(res.status).toBe(200); //ステータスコードが200 OKで返ることのテスト
  });

  // ----- ログアウト時の表示のテスト -----
  test('ログアウト時はリダイレクトされる', async () => {
    const app = require('./app');
    const res = await app.request('/logout'); // /looutにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(res.headers.get('Location')).toBe('/'); // /へリダイレクトされることをテスト
    expect(res.status).toBe(302); //ステータスコードが302 Found（一時的なリダイレクト）で返ることのテスト
  });
});

