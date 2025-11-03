// ===== コメント更新のWebAPIの実装 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const ensureAuthenticated = require('../middlewares/ensure-authenticated');

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- コメント更新の処理 ----- /:scheduleId/users/:userId/commentsに POST でアクセスされたときの処理
app.post(
  '/:scheduleId/users/:userId/comments',
  ensureAuthenticated(),
  async (c) => {
    //予定ID、ユーザIDを受け取る
    const scheduleId = c.req.param('scheduleId'); //予定ID
    const userId = parseInt(c.req.param('userId'), 10); //ユーザID（文字列→10進数の数値）

    const body = await c.req.json();
    const comment = body.comment.slice(0, 255);

    const data = { //コメントを更新または作成
      userId,
      scheduleId,
      comment,
    };

    await prisma.comment.upsert({ //upsert() データがすでにあれば更新、なければ新規作成
      where: { //where句で複合キーを指定
        commentCompositeId: {
          userId,
          scheduleId,
        },
      },
      update: data,
      create: data,
    });

    return c.json({ status: 'OK', comment });
  },
);

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
// テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
