// ===== Jestを使ったテストコード =====
//Jest=JavaScript 用のテスティングフレームワークの1つ。実装方法がシンプル、テストの実行結果をわかりやすく表示してくれるなどの便利な機能。Node.js,Babel,TypeScript,Reactなどで利用できる
//今回実装しているのは、ユニットテスト（モジュール単体）、結合テスト（複数モジュール）、システムテスト（全体）のうち、ユニットテスト
'use strict';

 // ----- モジュールの読み込み -----
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

// ----- テストの準備 -----
//テスト用のユーザの情報testUserを準備する
const testUser = {
  userId: 0,
  username: 'testuser',
};

//テスト用のセッションmockIronSessionを準備する
function mockIronSession() {
  const ironSession = require('iron-session'); // jest.spyOn関数は、特定のオブジェクトのメソッドを監視する関数　今回はgetIronSession関数を監視
  jest.spyOn(ironSession, 'getIronSession').mockReturnValue({ //mockFn.mockReturnValue関数でgetIronSession関数をモック化（テストを動かすための最低限の関数に変換）して、user/save/destroyを持つオブジェクトを返すようにしている
    user: { login: testUser.username, id: testUser.userId },
    save: jest.fn(), //セッション情報を保存
    destroy: jest.fn(), //セッション情報を破棄
  });
}

// ----- テスト -----
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

// ----- ログイン・ログアウトのテスト -----
describe('/login', () => {
  /// ----- テスト前後の準備 -----
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    mockIronSession(); //mockIronSessionはテスト用のセッション
  });
  afterAll(() => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
  });

  // ----- ログインのためのリンクが含まれることのテスト -----
  test('ログインのためのリンクが含まれる', async () => {
    const app = require('./app');
    const res = await app.request('/login'); // /loginにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8'); //レスポンスヘッダの 'Content-Type' が text/html; charset=utf-8 であることのテスト
    expect(await res.text()).toMatch(/<a href="\/auth\/github"/); //<a href="/auth/github" が HTML に含まれることのテスト
    expect(res.status).toBe(200); //ステータスコードが200 OKで返ることのテスト
  });

  // ----- ログイン時はユーザ名が表示されることのテスト -----
  test('ログイン時はユーザ名が表示される', async () => {
    const app = require('./app');
    const res = await app.request('/login'); // /loginにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(await res.text()).toMatch(/testuser/); //HTMLのbody内のテキストを取得し、testuserという文字列が含まれることをテスト
    expect(res.status).toBe(200); //ステータスコードが200 OKで返ることのテスト
  });

  // ----- ログアウト時はリダイレクトされることのテスト -----
  test('ログアウト時はリダイレクトされる', async () => {
    const app = require('./app');
    const res = await app.request('/logout'); // /looutにアクセス、app.jsで定義したappオブジェクトのrequestメソッドを呼び出し
    expect(res.headers.get('Location')).toBe('/'); // /へリダイレクトされることをテスト
    expect(res.status).toBe(302); //ステータスコードが302 Found（一時的なリダイレクト）で返ることのテスト
  });
});

// ----- 予定作成時のテスト -----
describe('/schedules', () => {
  // ----- テスト前後の準備（ログイン・ログアウトのテストと同様。作成データ削除を追加）-----
  let scheduleId = '';
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    mockIronSession(); //mockIronSessionはテスト用のセッション
  });
  afterAll(async () => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
    // テストで作成したデータを削除
    await prisma.candidate.deleteMany({ where: { scheduleId } }); //テストで使用した候補を削除
    await prisma.schedule.delete({ where: { scheduleId } }); //テストで使用したスケジュールを削除
  });

  // ----- 予定が作成でき、表示されることのテスト -----
  test('予定が作成でき、表示される', async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });
    const app = require('./app');
    const postRes = await app.request('/schedules', { //POST メソッドで /schedules にアクセスして予定と候補を作成
      method: 'POST',
      body: new URLSearchParams({
        scheduleName: 'テスト予定1',
        memo: 'テストメモ1\r\nテストメモ2',
        candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', //application/x-www-form-urlencodedはbodyの内容がURL形式でエンコードされたフォームデータであることを表している。フォームの内容を送信するときに使われるヘッダ
      },
    });
    const createdSchedulePath = postRes.headers.get('Location'); //postRes.headers.get('Location') でリダイレクトされたパスを取得
    expect(createdSchedulePath).toMatch(/schedules/); // expect(createdSchedulePath).toMatch(/schedules/) でリダイレクトされたパスが /schedules/ になっているかを検証
    expect(postRes.status).toBe(302); //ステータスコードが302 Found（一時的なリダイレクト）で返ることのテスト
    scheduleId = createdSchedulePath.split('/schedules/')[1]; //リダイレクトされたパスの /schedules/ より右側の文字列を取得
    const res = await app.request(createdSchedulePath);
    const body = await res.text();
    expect(body).toMatch(/テスト予定1/);
    expect(body).toMatch(/テストメモ1/);
    expect(body).toMatch(/テストメモ2/);
    expect(body).toMatch(/テスト候補1/);
    expect(body).toMatch(/テスト候補2/);
    expect(body).toMatch(/テスト候補3/);
    expect(res.status).toBe(200); //ステータスコードが200 OKで返ることのテスト
  });
});
