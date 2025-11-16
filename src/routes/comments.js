// ===== コメント更新のWebAPIの実装 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { z } = require('zod');
const { zValidator } = require('@hono/zod-validator');

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- バリデーション -----
// パスパラメータのバリデータを定義
const paramValidator = zValidator(
  'param', //パラメータの種類
  z.object({ //バリデーションするパラメータのスキーマ
    scheduleId: z.string().uuid(), //scheduleId: UUID 形式の文字列であることを確かめる
    userId: z.coerce.number().int().min(0), //userId: 0 以上の整数値として解釈できるデータであることを確かめる。z.coerce.number()で「数値として解釈可能な文字列」が数値型に変換されバリデーションが実行される
  }),
  (result, c) => { //バリデーション後の処理
    if (!result.success) { //バリデーションに失敗した場合は、result.error として与えられる Zod のエラーを JSON 形式で返す
      return c.json({
        status: 'NG',
        errors: [result.error],
      }, 400);
    }
  }
);

// JSONバリデータを定義
const jsonValidator = zValidator(
  'json', //パラメータの種類
  z.object({ //バリデーションするパラメータのスキーマ
    comment: z.string().min(1).max(255), //candidateId: 0 以上の整数値として解釈できるデータであることを確かめる
  }),
  (result, c) => { //バリデーション後の処理
    if (!result.success) { //バリデーションに失敗した場合は、result.error として与えられる Zod のエラーを JSON 形式で返す
      return c.json({
        status: 'NG',
        errors: [result.error],
      }, 400);
    }
  }
);

// ----- コメント更新の処理 ----- /:scheduleId/users/:userId/commentsに POST でアクセスされたときの処理
app.post(
  '/:scheduleId/users/:userId/comments',
  ensureAuthenticated(),
  paramValidator,
  jsonValidator,
  async (c) => {
    const { scheduleId, userId } = c.req.valid('param');
    const { comment } = c.req.valid('json');

    const { user } = c.get('session') ?? {};
    if (user?.id !== userId) {
      return c.json({
        status: 'NG',
        errors: [{ msg: 'ユーザ ID が不正です。' }],
      }, 403);
    }

    const data = { //コメントを更新または作成
      userId,
      scheduleId,
      comment,
    };

    try{ //エラーハンドリング
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
    } catch (error) {
      console.error(error);
      return c.json({
        status: 'NG',
        errors: [{ msg: 'データベース エラー。' }],
      }, 500);
    }
    return c.json({ status: 'OK', comment });
  },
);

// ----- アプリのエクスポート -----
module.exports = app; //他ファイルで require('./app') と書くとこのappが読み込める
// テスト用でファイル単体で起動させるため、=appとしている
// 本来は複数ページをまとめて１つのアプリとして起動するため、メインのapp.jsに登録するためのルーターとして=routerとする。
