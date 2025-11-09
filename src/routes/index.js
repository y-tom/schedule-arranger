// ===== トップページの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono'); //Honoのモジュールを読み込む
const { html } = require('hono/html'); //HonoでHTMLを返すためのヘルパー。タグ付きテンプレートリテラル
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client'); //Prismaをインポートする
const prisma = new PrismaClient({ log: ['query'] }); //Prisma クライアントを作成
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');


// ----- アプリケーションの初期化 -----
const app = new Hono(); //Honoインスタンスを作成。Honoの機能が使えるようになる。

// ----- トップページの表示と、表示する予定をDBから取得する処理 -----
//トップページのテンプレート
function scheduleTable(schedules) {
  return html`
    <table class="table">
      <tr>
        <th>予定名</th>
        <th>更新日時</th>
      </tr>
      ${schedules.map(
        (schedule) => html`
          <tr>
            <td>
              <a href="/schedules/${schedule.scheduleId}">
                ${schedule.scheduleName}
              </a>
            </td>
            <td>${schedule.formattedUpdatedAt}</td>
          </tr>
        `,
      )}
    </table>
  `;
}

//表示処理、表示する予定をDBから取得する処理
app.get('/', async (c) => { //asyncで非同期関数にする、awaitを使えるようになる
  const { user } = c.get('session') ?? {}; //??=Null合体演算子 左側がnullまたはundefined //のときは右側を使う=セッションがなければ空のオブジェクト{}を使う
  const schedules = user
    ? await prisma.schedule.findMany({ //findManyは条件に合ったレコードをすべて取得するメソッド
        where: { createdBy: user.id },
        orderBy: { updatedAt: 'desc' },
      })
    : [];
  schedules.forEach((schedule) => {
    schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });
  return c.html(
    layout(
      c,
      null,
      html`
        <div class="my-3">
          <div class="p-5 bg-light rounded-3">
            <h1 class="text-body">予定調整くん</h1>
            <p class="lead">
              予定調整くんは、GitHubで認証でき、予定を作って出欠が取れるサービスです。
            </p>
          </div>
        </div>
        ${user //${user ? ... : ...} userが存在する（ログイン中）ならログアウトを表示、userが存在しない（未ログイン）ならログインを表示する
          ? html`
              <div class="my-3">
                <h3 class="my-3">予定を作る</h3>
                <a class="btn btn-primary" href="/schedules/new">予定を作る</a>
                ${schedules.length > 0
                  ? html`
                      <h3 class="my-3">あなたの作った予定一覧</h3>
                      ${scheduleTable(schedules)}
                    `
                  : ''}
              </div>
            `
          : ''}
      `,
    ),
  );
});

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
//テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
