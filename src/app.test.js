// ===== Jestを使ったテストコード =====
//Jest=JavaScript 用のテスティングフレームワークの1つ。実装方法がシンプル、テストの実行結果をわかりやすく表示してくれるなどの便利な機能。Node.js,Babel,TypeScript,Reactなどで利用できる
//今回実装しているのは、ユニットテスト（モジュール単体）、結合テスト（複数モジュール）、システムテスト（全体）のうち、ユニットテスト
'use strict';

 // ----- モジュールの読み込み -----
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

// ----- テストの準備 ----- テスト用ユーザ情報の作成、よく使う操作の関数を作成
//テスト用のユーザの情報testUserを準備する
const testUser = {
  userId: 0,
  username: 'testuser',
};

//テスト用のセッションmockIronSessionを準備するための関数
function mockIronSession() {
  const ironSession = require('iron-session'); // jest.spyOn関数は、特定のオブジェクトのメソッドを監視する関数　今回はgetIronSession関数を監視
  jest.spyOn(ironSession, 'getIronSession').mockReturnValue({ //mockFn.mockReturnValue関数でgetIronSession関数をモック化（テストを動かすための最低限の関数に変換）して、user/save/destroyを持つオブジェクトを返すようにしている
    user: { login: testUser.username, id: testUser.userId },
    save: jest.fn(), //セッション情報を保存
    destroy: jest.fn(), //セッション情報を破棄
  });
}

// テストで作成したデータを削除するための関数
async function deleteScheduleAggregate(scheduleId) {
  await prisma.availability.deleteMany({ where: { scheduleId } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  await prisma.comment.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { scheduleId } });
}


// フォームからリクエストを送信するための関数
async function sendFormRequest(app, path, body) {
  return app.request(path, {
    method: 'POST',
    body: new URLSearchParams(body),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

// JSON を含んだリクエストを送信するための関数
async function sendJsonRequest(app, path, body) {
  return app.request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
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

// ----- ログインのテスト -----
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
});

// ----- ログアウトのテスト -----
describe('/logout', () => {
  // ----- ログアウト時はリダイレクトされることのテスト -----
  test('ログアウト時に / へリダイレクトされる', async () => {
    const app = require('./app');
    const res = await app.request('/logout');
    expect(res.headers.get('Location')).toBe('/');
    expect(res.status).toBe(302);
  });
});

// ----- 予定作成のテスト -----
describe('/schedules', () => {
  // ----- テスト前後の準備（ログインのテストと同様。作成データ削除を追加）-----
  let scheduleId = '';
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    mockIronSession(); //mockIronSessionはテスト用のセッション
  });
  afterAll(async () => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
    await deleteScheduleAggregate(scheduleId); // テストで作成したデータを削除
  });

  // ----- 予定が作成でき、表示されることのテスト -----
  test('予定が作成でき、表示される', async () => {
    //テストに使用するuserデータを追加
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    // /schedulesで予定と候補を作成
    const app = require('./app');
    const postRes = await sendFormRequest(app, '/schedules', {
      scheduleName: 'テスト予定1',
      memo: 'テストメモ1\r\nテストメモ2',
      candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3',
    });

    //リダイレクト
    const createdSchedulePath = postRes.headers.get('Location'); //postRes.headers.get('Location') でリダイレクトされたパスを取得
    expect(createdSchedulePath).toMatch(/schedules/); // expect(createdSchedulePath).toMatch(/schedules/) でリダイレクトされたパスが /schedules/ になっているかを検証
    expect(postRes.status).toBe(302); //ステータスコードが302 Found（一時的なリダイレクト）で返ることのテスト

    //作成された予定と候補を表示
    scheduleId = createdSchedulePath.split('/schedules/')[1]; //リダイレクトされたパスの /schedules/ より右側の文字列を取得し、予定IDを取得する
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

// ----- 出欠更新のテスト -----
describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
  // ----- テスト前後の準備（ログインのテストと同様。作成データ削除を追加）-----
  let scheduleId = '';
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    mockIronSession(); //mockIronSessionはテスト用のセッション
  });
  afterAll(async () => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
    await deleteScheduleAggregate(scheduleId); // テストで作成したデータを削除
  });

  // ----- 出欠が更新できることのテスト -----
  test('出欠が更新できる', async () => {
    //テストに使用するuserデータを追加
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    //更新用の予定と候補を作成
    const app = require('./app');
    const postRes = await sendFormRequest(app, '/schedules', {
      scheduleName: 'テスト出欠更新予定1',
      memo: 'テスト出欠更新メモ1',
      candidates: 'テスト出欠更新候補1',
    });

    const createdSchedulePath = postRes.headers.get('Location'); //postRes.headers.get('Location') でリダイレクトされたパスを取得
    scheduleId = createdSchedulePath.split('/schedules/')[1]; //リダイレクトされたパスの /schedules/ より右側の文字列を取得し、予定IDを取得する

    const candidate = await prisma.candidate.findFirst({ //予定に紐づく最初の候補を取得
      where: { scheduleId },
    });

    const res = await sendJsonRequest( //sendJsonRequest関数で/schedules/:scheduleId/users/:userId/candidates/:candidateIdにPOSTでアクセス
      app,
      `/schedules/${scheduleId}/users/${testUser.userId}/candidates/${candidate.candidateId}`,
      {
        availability: 2,
      },
    );

    expect(await res.json()).toEqual({ status: 'OK', availability: 2 }); //expect関数でリクエストのレスポンスに{'status':'OK','availability':2}という文字列が含まれるかどうかを検査

    const availabilities = await prisma.availability.findMany({
      where: { scheduleId },
    });
    expect(availabilities.length).toBe(1); //予定に関連する出欠情報が 1 つあることのテスト
    expect(availabilities[0].availability).toBe(2); //その内容が更新された 2 であることをテスト
  });
});

// ----- コメント更新のテスト -----
describe('/schedules/:scheduleId/users/:userId/comments', () => {
  // ----- テスト前後の準備（ログインのテストと同様。作成データ削除を追加）-----
  let scheduleId = '';
  beforeAll(() => { //beforeAll関数は、テストが始まる前に実行される関数
    mockIronSession(); //mockIronSessionはテスト用のセッション
  });
  afterAll(async () => { //afterAll関数はテストが終わった後に実行される関数
    jest.restoreAllMocks(); //jest.restoreAllMocks関数は、jest.spyOn で監視していたモックを元の値に戻す関数
    await deleteScheduleAggregate(scheduleId); // テストで作成したデータを削除
  });

  // ----- コメントが更新できることのテスト -----
  test('コメントが更新できる', async () => {
    //テストに使用するuserデータを追加
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    //更新用の予定と候補を作成
    const app = require('./app');
    const postRes = await sendFormRequest(app, '/schedules', {
      scheduleName: 'テストコメント更新予定1',
      memo: 'テストコメント更新メモ1',
      candidates: 'テストコメント更新候補1',
    });

    const createdSchedulePath = postRes.headers.get('Location'); //postRes.headers.get('Location') でリダイレクトされたパスを取得
    scheduleId = createdSchedulePath.split('/schedules/')[1]; //リダイレクトされたパスの /schedules/ より右側の文字列を取得し、予定IDを取得する

    const candidate = await prisma.candidate.findFirst({ //予定に紐づく最初の候補を取得
      where: { scheduleId },
    });

    const res = await sendJsonRequest( //sendJsonRequest関数で/schedules/:scheduleId/users/:userId/candidates/:candidateIdにPOSTでアクセス
      app,
      `/schedules/${scheduleId}/users/${testUser.userId}/comments`,
      {
        comment: 'testcomment',
      },
    );

    expect(await res.json()).toEqual({ status: 'OK', comment: 'testcomment' }); //expect関数でリクエストのレスポンスに{'status':'OK',comment: 'testcomment'}という文字列が含まれるかどうかを検査

    const comments = await prisma.comment.findMany({
      where: { scheduleId },
    });
    expect(comments.length).toBe(1); //予定に関連するコメントが 1 つあることのテスト
    expect(comments[0].comment).toBe('testcomment'); //その内容が更新された'testcommentS'であることをテスト
  });
});
