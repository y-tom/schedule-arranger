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

  // DB（scheduleテーブル）から、予定を取得する。予定は作成日順で並べる。
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

  // 予定を指定する。予定が見つからなければ404notFound、予定が見つかれば候補日を作成日順で並べる
  if (!schedule) {
    return c.notFound(); //予定が見つからない場合には、404notFoundを表示する
  }
  const candidates = await prisma.candidate.findMany({ //予定が見つかった場合には、候補日を作成日順で並べる
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' },
  });

  // 指定した予定に対し、DB（availabilityテーブル）からすべての候補日と出欠を取得する。出欠のデフォルトは「欠席」
  const availabilities = await prisma.availability.findMany({ //Prismaスキーマのavailabilityテーブルから条件にあう複数レコードを取得する
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' },
    include: {
      user: {
        select: {
          userId: true,
          username: true,
        },
      },
    },
  });
  // 出欠 MapMap を作成する
  const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, value: availability)
  availabilities.forEach((a) => {
    const map = availabilityMapMap.get(a.user.userId) || new Map(); //親の出欠 MapMap に、ユーザ ID の出欠 Map がある場合はその Map を、ない場合は新しい Map を準備する
    map.set(a.candidateId, a.availability);
    availabilityMapMap.set(a.user.userId, map);
  });
    // 閲覧ユーザと出欠に紐づくユーザからユーザ Map を作る
  const userMap = new Map(); // key: userId, value: User
  userMap.set(parseInt(user.id, 10), { //parseInt関数で数値に変換。10進数で値を取得
    isSelf: true,
    userId: parseInt(user.id, 10),
    username: user.username,
  });
  availabilities.forEach((a) => {
    userMap.set(a.user.userId, {
      isSelf: parseInt(user.id, 10) === a.user.userId, // 閲覧ユーザ自身であるかを示す真偽値
      userId: a.user.userId,
      username: a.user.username,
    });
  });
  // 全ユーザ、全候補で二重ループして、デフォルトで「欠席」を設定する（出欠の値がない場合には「欠席」）
  const users = Array.from(userMap.values()); //ユーザMapの配列を作る処理
  users.forEach((u) => { //ユーザと候補の二重ループの処理
    candidates.forEach((c) => {
      const map = availabilityMapMap.get(u.userId) || new Map();
      const a = map.get(c.candidateId) || 0; // デフォルト値は 0 を使用
      map.set(c.candidateId, a);
      availabilityMapMap.set(u.userId, map);
    });
  });
  // コメント取得
  const comments = await prisma.comment.findMany({ //findMany() で、予定に紐づいているコメントをすべて取得
    where: { scheduleId: schedule.scheduleId }, //予定IDで検索
  });
  const commentMap = new Map(); // key: userId, value: comment ユーザIDをキーとして、コメントを値として保持するMapオブジェクトを作る
  comments.forEach((comment) => {
    commentMap.set(comment.userId, comment.comment);
  });

  //予定を表示する画面のテンプレート
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
                ${users.map((user) => {
                  const availability = availabilityMapMap //ユーザと候補の出欠情報の取得
                    .get(user.userId)
                    .get(candidate.candidateId);
                  const availabilityLabels = ['欠', '？', '出']; //出欠情報のラベルの定義を追加 0のときは欠、1のときは?、2のときは出
                  const label = availabilityLabels[availability];
                  return html`
                    <td>
                      ${user.isSelf //更新できる出欠ボタンの作成。ユーザーが自分自身かどうか判別、出欠情報に応じたラベルでボタンを表示。自分自身の場合はボタンを表示、自分自身でない場合はただの<p>テキストとして出欠ラベルを表示
                        //data-属性:HTMLの要素に独自のデータを保有させたい場合に利用する属性。予定ID/ユーザID/候補ID/出欠
                        ? html`<button
                            data-schedule-id="${schedule.scheduleId}"
                            data-user-id="${user.userId}"
                            data-candidate-id="${candidate.candidateId}"
                            data-availability="${availability}"
                            class="availability-toggle-button"
                          >
                            ${label}
                          </button>`
                        : html`<p>${label}</p>`}
                    </td>
                  `;
                })}
              </tr>
            `,
          )}
          <tr>
            <th>コメント</th>
            ${users.map((user) => {
              const comment = commentMap.get(user.userId); //テンプレートにコメントを追加。
              // pタグには、自分自身なら、id="self-comment" をつけて他人のコメントと別の指示ができるようにする、コメント＋編集ボタンを表示する。自分自身でなければ、何もidにつけずコメントのみ表示する。
              // button要素には、自分自身なら、予定IDユーザIDの属性をつけて、id="self-comment-button"とする。自分自身でなければ何もにidつけない。
              return html`
                <td>
                  <p id="${user.isSelf ? "self-comment" : ""}">${comment}</p>
                  ${user.isSelf
                    ? html`
                      <button
                        data-schedule-id="${schedule.scheduleId}"
                        data-user-id="${user.userId}"
                        id="self-comment-button"
                      >
                        編集
                      </button>
                    `
                    : ''}
                </td>
              `;
            })}
          </tr>
        </table>
      `,
    ),
  );
});

// ----- アプリのエクスポート -----
module.exports = app;
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
