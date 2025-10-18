// ===== 認証チェック機能の実装 =====
// ----- モジュールの読み込み -----
const { createMiddleware } = require('hono/factory');

// ページの閲覧に認証を必須にするミドルウェア
function ensureAuthenticated() {
  return createMiddleware(async (c, next) => {
    const session = c.get('session');
    if (!session.user) { //認証をチェックして、認証されていない場合は /login にリダイレクトする
      return c.redirect('/login');
    }
    await next(); //認証されていた場合にのみ次のハンドラに進む
  });
}

// ----- アプリのエクスポート -----
module.exports = ensureAuthenticated;
