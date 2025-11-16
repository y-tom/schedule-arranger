// ===== 出欠を更新するWebAPIの処理 =====
// ----- モジュールの読み込み -----
const { Hono } = require('hono');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const { z } = require('zod'); //Zod(バリデーション作成)をインポート
const { zValidator } = require('@hono/zod-validator'); //zValidator(Zodを利用したバリデーションミドルウェアを作る)をインポート

// ----- アプリケーションの初期化 -----
const app = new Hono();

// ----- バリデーション -----
// パスパラメータのバリデータを定義
const paramValidator = zValidator(
  'param', //パラメータの種類
  z.object({ //バリデーションするパラメータのスキーマ
    scheduleId: z.string().uuid(), //scheduleId: UUID 形式の文字列であることを確かめる
    userId: z.coerce.number().int().min(0), //userId: 0 以上の整数値として解釈できるデータであることを確かめる。z.coerce.number()で「数値として解釈可能な文字列」が数値型に変換されバリデーションが実行される
    candidateId: z.coerce.number().int().min(0), //candidateId: 0 以上の整数値として解釈できるデータであることを確かめる
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
    availability: z.number().int().min(0).max(2), //availability: 0 以上 2 以下の整数値であることを確かめる
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

// ----- 予定更新の処理 ----- /:scheduleId/users/:userId/candidates/:candidateId に POST でアクセスされたときの処理
app.post(
  '/:scheduleId/users/:userId/candidates/:candidateId', //予定ID、ユーザID、候補ID を受け取るパスパラメータ
  ensureAuthenticated(),
  paramValidator,
  jsonValidator,
  async (c) => {
    const { scheduleId, userId, candidateId } = c.req.valid('param');
    const { availability } = c.req.valid('json');

    const { user } = c.get('session') ?? {};
    if (user?.id !== userId) {
      return c.json({
        status: 'NG',
        errors: [{ msg: 'ユーザ ID が不正です。' }],
      }, 403);
    }

    const data = { //出欠状態を更新または作成
      userId,
      scheduleId,
      candidateId,
      availability,
    };

    try{ //エラーハンドリング
      await prisma.availability.upsert({ //upsert() データがすでにあれば更新、なければ新規作成
        where: { //where句で複合キーを指定
          availabilityCompositeId: {
            candidateId,
            userId,
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
