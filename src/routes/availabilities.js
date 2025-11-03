// ===== 出欠を更新するWebAPIの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- 予定更新の処理 ----- /:scheduleId/users/:userId/candidates/:candidateId に POST でアクセスされたときの処理
app.post(
  '/:scheduleId/users/:userId/candidates/:candidateId', //予定ID、ユーザID、候補ID を受け取るパスパラメータ
  ensureAuthenticated(),
  async (c) => {
    //予定ID、ユーザID、候補ID を受け取る
    const scheduleId = c.req.param('scheduleId'); //予定ID
    const userId = parseInt(c.req.param('userId'), 10); //ユーザID（文字列→10進数の数値）
    const candidateId = parseInt(c.req.param('candidateId'), 10); //候補ID（文字列→10進数の数値）

    const body = await c.req.json();
    const availability = body.availability ? parseInt(body.availability, 10) : 0; //availabilityがtruthyな値のときは文字列→10進数の数値

    const data = { //出欠状態を更新または作成
      userId,
      scheduleId,
      candidateId,
      availability,
    };

    await prisma.availability.upsert({ //upsert() データがすでにあれば更新、なければ新規作成
      where: { //where句で複合キーを指定
        availabilityCompositeId: {
          candidateId,
          userId,
        },
      },
      create: data,
      update: data,
    });

    return c.json({ status: 'OK', availability }); //
  },
);

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
// テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
