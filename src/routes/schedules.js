// ===== 予定作成・編集・削除フォームの処理 =====
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

// ----- 候補作成処理の共通化 -----
async function createCandidates(candidateNames,scheduleId) {
  const candidates = candidateNames.map((candidateName) => ({ //map関数を使って、取得した候補名の配列からDBに保存するCandidateオブジェクト（candidateNameとscheduleIdの2つのプロパティを持つ）を作成し、配列にまとめる
    candidateName,
    scheduleId,
  }));
  await prisma.candidate.createMany({ //createManyは一度に複数のレコードを作成できるメソッド dataには作成したCandidateオブジェクトの配列を指定
    data: candidates,
  });
}
function parseCandidateNames(candidatesStr){
  return candidatesStr
    .split('\n') //改行コードで文字列を分割
    .map((s) => s.trim()) //map関数で配列を順に処理して新しい配列を作る、trim関数で文字列前後（ここでは入力フォームのテキスト）の空白を削除
    .filter((s) => s !== ''); //filter関数で配列を条件で抽出 ここでは空文字列のデータを取り除いている
}

// ----- 予定作成フォーム -----
app.get('/new', (c) => { // /schedules/new のパスにアクセスされたときに、フォームの HTML を返す
  // 予定作成画面のテンプレート
  return c.html(
    layout(
      c,
      '予定の作成',
      html`
        <form method="post" action="/schedules" class="my-3">
          <div class="my-3">
            <label class="form-label">予定名</label>
            <input type="text" name="scheduleName" class="form-control" />
          </div>
          <div class="my-3">
            <label class="form-label">メモ</label>
            <textarea name="memo" class="form-control"></textarea>
          </div>
          <div class="my-3">
            <label class="form-label">候補日程 (改行して複数入力してください)</label>
            <textarea name="candidates" class="form-control"></textarea>
          </div>
          <button class="btn btn-primary" type="submit">予定をつくる</button>
        </form>
      `,
    ),
  );
});

// 予定作成の内容を送信する処理
// PrismaのDB処理は基本的に非同期I/O。そのため適宜awaitをつける。メソッドチェーンで書きたい場合はthen 関数を使う。
app.post('/', async (c) => {
  const { user } = c.get('session') ?? {}; //ユーザー情報を取り出し、ユーザー情報があればその値を使う、存在しなければ空オブジェクト{}を返す（エラーにならない）
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
  const candidateNames = parseCandidateNames(body.candidates); //候補作成処理の共通化で作成した関数を使う
  await createCandidates(candidateNames, scheduleId); //候補作成処理の共通化で作成した関数を使う
  // 作成した予定のページにリダイレクト
  return c.redirect('/schedules/' + scheduleId);
});

// ----- 予定表示フォーム -----
// 予定表示フォームにアクセスされたときの処理を追加
app.get('/:scheduleId', async (c) => {
  const { user } = c.get('session') ?? {}; //ユーザー情報を取り出し、ユーザー情報があればその値を使う、存在しなければ空オブジェクト{}を返す（エラーにならない）

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

  //予定表示画面のテンプレート
  const buttonStyles = ['btn-danger', 'btn-secondary', 'btn-success'];

  return c.html(
    layout(
      c,
      `予定: ${schedule.scheduleName}`,
      html`
        <div class="card my-3">
          <h4 class="card-header">${schedule.scheduleName}</h4>
          <div class="card-body">
            <p style="white-space: pre;">${schedule.memo}</p>
          </div>
          <div class="card-footer">作成者: ${schedule.user.username}</div>
        </div>
        ${isMine(user.id, schedule)
          ? html`
              <a
                href="/schedules/${schedule.scheduleId}/edit"
                class="btn btn-primary"
              >
              この予定を編集する <i class="bi bi-pencil"></i>
            </a>`
        : ''}
        <h3 class="my-3">出欠表</h3>
        <div class="table-responsive">
          <table class="table table-bordered">
            <tr>
              <th>予定</th>
              ${users.map((user) => html`<th>${user.username}</th>`)}
            </tr>
            ${candidates.map(
              (candidate) => html`
                <tr>
                  <th>${candidate.candidateName}</th>
                  ${users.map((user) => {
                    const availability = availabilityMapMap
                      .get(user.userId)
                      .get(candidate.candidateId);
                    const availabilityLabels = ['欠', '？', '出'];
                    const label = availabilityLabels[availability];
                    return html`
                      <td>
                        ${user.isSelf
                          ? html`<button
                              data-schedule-id="${schedule.scheduleId}"
                              data-user-id="${user.userId}"
                              data-candidate-id="${candidate.candidateId}"
                              data-availability="${availability}"
                              class="availability-toggle-button btn btn-lg ${buttonStyles[
                                availability
                              ]}"
                            >
                              ${label}
                            </button>`
                          : html`<h3>${label}</h3>`}
                      </td>
                    `;
                  })}
                </tr>
              `,
            )}
            <tr>
              <th>コメント</th>
              ${users.map((user) => {
                const comment = commentMap.get(user.userId);
                return html`
                  <td>
                    <p>
                      <small id="${user.isSelf ? "self-comment" : ""}">
                        ${comment}
                      </small>
                    </p>
                    ${user.isSelf
                      ? html`
                          <button
                            data-schedule-id="${schedule.scheduleId}"
                            data-user-id="${user.userId}"
                            id="self-comment-button"
                            class="btn btn-info"
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
        </div>
      `,
    ),
  );
});

// ----- 予定編集フォーム -----
//　現在ログインしているuserIdとscheduleと、予定の作成者が同じなのか判定し真偽値を返す関数を作成
function isMine(userId, schedule) {
  return schedule && parseInt(schedule.createdBy, 10) === parseInt(userId, 10);
}
// 予定編集フォームにアクセスされたときの処理を追加
app.get('/:scheduleId/edit', async (c) => {
  const { user } = c.get('session') ?? {}; //ユーザー情報を取り出し、ユーザー情報があればその値を使う、存在しなければ空オブジェクト{}を返す（エラーにならない）

  // DB（scheduleテーブル）から、予定を取得する。予定は作成日順で並べる。
  const schedule = await prisma.schedule.findUnique({ //findUniqueで指定した一意のキーに一致する単一のレコードを取得
    where: { scheduleId: c.req.param('scheduleId') },
  });

  // ログインしているユーザーと予定の作成者が同じなのか判定し、同じでない場合は404notFound、同じ場合はユーザーIDを読み込んで予定編集フォームを表示する
  if (!isMine(user.id, schedule)) {
    return c.notFound(); //ログインユーザーと作成者が同じでない場合には、404notFoundを表示する
  }
  const candidates = await prisma.candidate.findMany({ //予定が見つかった場合には、候補日を作成日順で並べる
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' },
  });

// 予定編集画面のテンプレート
  return c.html(
    layout(
      c,
      `予定の編集: ${schedule.scheduleName}`,
      html`
        <form
          class="my-3"
          method="post"
          action="/schedules/${schedule.scheduleId}/update"
        >
          <div class="mb-3">
            <label class="form-label">予定名</label>
            <input
              type="text"
              name="scheduleName"
              class="form-control"
              value="${schedule.scheduleName}"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">メモ</label>
            <textarea name="memo" class="form-control">${schedule.memo}</textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">既存の候補日程</label>
            <ul class="list-group mb-2">
              ${candidates.map(
                (candidate) =>
                  html`<li class="list-group-item">${candidate.candidateName}</li>`,
              )}
            </ul>
            <p>候補日程の追加 (改行して複数入力してください)</p>
            <textarea name="candidates" class="form-control"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">以上の内容で予定を編集する <i class="bi bi-pencil"></i>
          </button>
        </form>
        <h3 class="my-3">危険な変更</h3>
        <form method="post" action="/schedules/${schedule.scheduleId}/delete">
          <button type="submit" class="btn btn-danger">この予定を削除する <i class="bi bi-pencil"></i>
          </button>
        </form>
      `,
    ),
  );
});

// 予定編集の内容を送信する処理
// PrismaのDB処理は基本的に非同期I/O。そのため適宜awaitをつける。メソッドチェーンで書きたい場合はthen 関数を使う。
app.post('/:scheduleId/update', async (c) => {
  const { user } = c.get('session') ?? {}; //ユーザー情報を取り出し、ユーザー情報があればその値を使う、存在しなければ空オブジェクト{}を返す（エラーにならない）
  // DB（scheduleテーブル）から、予定を取得する。予定は作成日順で並べる。
  const schedule = await prisma.schedule.findUnique({ //findUniqueで指定した一意のキーに一致する単一のレコードを取得
    where: { scheduleId: c.req.param('scheduleId') },
  });
  // ログインしているユーザーと予定の作成者が同じなのか判定し、同じでない場合は404notFound、同じ場合はユーザーIDを読み込んで予定編集フォームを表示する
  if (!isMine(user.id, schedule)) {
    return c.notFound(); //ログインユーザーと作成者が同じでない場合には、404notFoundを表示する
  }

  const body = await c.req.parseBody(); //POSTで受け取ったフォームのデータを取得
  // 予定をDBに登録
  const updatedSchedule = await prisma.schedule.update({ //update()は既存のレコードを更新するためのメソッド。updateの前にawaitがあるので、次の処理は予定が保存し終わってから実行される。
    where: { scheduleId: schedule.scheduleId },
    data: { //モデルで定義された属性を持つオブジェクトを指定
      scheduleName: body.scheduleName.slice(0, 255) || '（名称未設定）', //データベース上で長さの制限があるため255文字以内に切り抜き
      memo: body.memo, //リクエストから取得した情報を設定
      updatedAt: new Date(), //現在時刻を設定
    },
  });

  // 候補が追加されているかチェック
  const candidateNames = parseCandidateNames(body.candidates); //候補作成処理の共通化で作成した関数を使う
  if(candidateNames.length){ //配列の長さをチェック。配列の長さが0=空の場合false、1以上の場合true。配列に1つ以上要素が入っている場合のみ{}内を実行する
    await createCandidates(candidateNames, updatedSchedule.scheduleId); //候補作成処理の共通化で作成した関数を使う
  }
  // 作成した予定のページにリダイレクト
  return c.redirect('/schedules/' + updatedSchedule.scheduleId);
});

// ----- 予定削除処理（削除用のフォームはないので予定編集フォームに削除ボタンを追加する） -----
// データを削除するための関数
async function deleteScheduleAggregate(scheduleId) {
  await prisma.availability.deleteMany({ where: { scheduleId } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  await prisma.comment.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { scheduleId } });
}
app.deleteScheduleAggregate = deleteScheduleAggregate;

app.post('/:scheduleId/delete', async (c) => {
  const { user } = c.get('session') ?? {}; //ユーザー情報を取り出し、ユーザー情報があればその値を使う、存在しなければ空オブジェクト{}を返す（エラーにならない）
  // DB（scheduleテーブル）から、予定を取得する。予定は作成日順で並べる。
  const schedule = await prisma.schedule.findUnique({ //findUniqueで指定した一意のキーに一致する単一のレコードを取得
    where: { scheduleId: c.req.param('scheduleId') },
  });
  // ログインしているユーザーと予定の作成者が同じなのか判定し、同じでない場合は404notFound、同じ場合はユーザーIDを読み込んで予定編集フォームを表示する
  if (!isMine(user.id, schedule)) {
    return c.notFound(); //ログインユーザーと作成者が同じでない場合には、404notFoundを表示する
  }
  // 削除処理を実行
  await deleteScheduleAggregate(schedule.scheduleId);
  // トップページにリダイレクト
  return c.redirect('/');
});

// ----- アプリのエクスポート -----
module.exports = app;
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
