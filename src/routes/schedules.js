// ===== 予定作成フォームの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono'); //Honoのモジュールを読み込む
const { html } = require('hono/html');//HonoでHTMLを返すためのヘルパー。タグ付きテンプレートリテラル
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto'); //バージョン 4 の UUID を生成
const { PrismaClient } = require('@prisma/client'); //Prismaをインポートする
const prisma = new PrismaClient({ log: ['query'] }); //Prisma クライアントを作成

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- ミドルウェア登録 -----
app.use(ensureAuthenticated()); //認証チェックのミドルウェア

// ----- 予定作成用の画面を表示する処理 -----
app.get('/new', (c) => { // /schedules/new のパスにアクセスされたときに、フォームの HTML を返す
  return c.html(
    layout(
      c,
      '予定の作成',
      html`
        <form method="post" action="/schedules">
          <div>
            <h5>予定名</h5>
            <input type="text" name="scheduleName" />
          </div>
          <div>
            <h5>メモ</h5>
            <textarea name="memo"></textarea>
          </div>
          <div>
            <h5>候補日程 (改行して複数入力してください)</h5>
            <textarea name="candidates"></textarea>
          </div>
          <button type="submit">予定をつくる</button>
        </form>
      `,
    ),
  );
});

// ----- 予定作成用の画面で入力した内容を送信する処理 -----
//PrismaのDB処理は基本的に非同期I/O。そのため適宜awaitをつける。メソッドチェーンで書きたい場合はthen 関数を使う。
app.post('/', async (c) => {
  const { user } = c.get('session') ?? {};  //セッションからユーザの情報を取得 ??=Null合体演算子 左側がnullまたはundefinedのときは右側を使う=セッションがなければ空のオブジェクト{}を使う
  const body = await c.req.parseBody(); //POSTで受け取ったフォームのデータを取得
  // 予定をDBに登録
  const { scheduleId } = await prisma.schedule.create({ //create()はテーブルに新しいレコードを作成するためのメソッド。createの前にawaitがあるので、次の処理は予定が保存し終わってから実行される。
    data: { //モデルで定義された属性を持つオブジェクトを指定
      scheduleId: randomUUID(), //バージョン 4 の UUID を設定
      scheduleName: body.scheduleName.slice(0, 255) || '（名称未設定）', //データベース上で長さの制限があるため255文字以内に切り抜き
      memo: body.memo, //リクエストから取得した情報を設定
      createdBy: user.id, //リクエストから取得した情報を設定
      updatedAt: new Date(), //現在時刻を設定
    },
  });
  // 候補日程を登録
  const candidateNames = body.candidates
    .split('\n') //改行コードで文字列を分割
    .map((s) => s.trim()) //map関数で配列を順に処理して新しい配列を作る、trim関数で文字列前後（ここでは入力フォームのテキスト）の空白を削除
    .filter((s) => s !== ''); //filter関数で配列を条件で抽出 ここでは空文字列のデータを取り除いている
  const candidates = candidateNames.map((candidateName) => ({ //map関数を使って、取得した候補名の配列からDBに保存するCandidateオブジェクト（candidateNameとscheduleIdの2つのプロパティを持つ）を作成し、配列にまとめる
    candidateName,
    scheduleId,
  }));
  await prisma.candidate.createMany({ //createManyは一度に複数のレコードを作成できるメソッド dataには作成したCandidateオブジェクトの配列を指定
    data: candidates,
  });
  // 作成した予定のページにリダイレクト
  return c.redirect('/schedules/' + scheduleId);
});

// ----- 作成した予定を表示する処理 -----
app.get('/:scheduleId', async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({ //findUniqueで指定した一意のキーに一致する単一のレコードを取得
    where: { scheduleId: c.req.param('scheduleId') },
    include: { //includeは別のテーブルを結合してデータを取得するオプション
      user: { //Userテーブルを結合
        select: { //selectでuserIDとusernameのみを取得するよう指定
          userId: true,
          username: true,
        },
      },
    },
  });
  if (!schedule) {
    return c.notFound(); //予定が見つからない場合には404notFoundを表示する
  }
  const candidates = await prisma.candidate.findMany({ //予定が見つかった場合は候補を作成日順で並べる
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' },
  });
  const users = [
    {
      userId: user.id,
      username: user.login,
    },
  ];
  //作成した予定を表示する画面のテンプレート
  return c.html(
    layout(
      c,
      `予定: ${schedule.scheduleName}`,
      html`
        <h4>${schedule.scheduleName}</h4>
        <p style="white-space: pre;">${schedule.memo}</p>
        <p>作成者: ${schedule.user.username}</p>
        <h3>出欠表</h3>
        <table>
          <tr>
            <th>予定</th>
            ${users.map((user) => html`<th>${user.username}</th>`)}
          </tr>
          ${candidates.map(
            (candidate) => html`
              <tr>
                <th>${candidate.candidateName}</th>
                ${users.map(
                  (user) => html`
                    <td>
                      <button>欠席</button>
                    </td>
                  `,
                )}
              </tr>
            `,
          )}
        </table>
      `,
    ),
  );
});

// ----- アプリのエクスポート -----
module.exports = app;
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
