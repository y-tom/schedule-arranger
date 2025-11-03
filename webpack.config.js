// ===== WebpackでJavaScriptファイルをまとめて変換 =====
// ① Webpackがスタート地点（src/app/entry.js）を見つける
// ② 関連するすべてのJSファイルをまとめて1つ（bundle.js）にする
// ③ Babel（新しいJavaScriptを古い環境でも動くように書き換える変換ツール）で新しい書き方を古いブラウザでも動くように直す（ES6+ を ES5 に変換）
// ④ 変換＆結合した結果をpublic/javascripts/bundle.jsに出力
module.exports = {
  context: __dirname + '/src/app', //エントリーポイント（基準ディレクトリ）。src/app フォルダを基準にする。__dirname はこの設定ファイルがあるディレクトリの絶対パス
  mode: 'none', //node:純粋に設定のみ。他のmodeは、development,production
  entry: './entry', //ビルドの開始地点となる JavaScript ファイルを指定。context で src/app を基準にしているので、実際のパスはsrc/app/entry.js
  output: { //出力先。public/javascripts/bundle.js が生成される
    path: __dirname + '/public/javascripts',
    filename: 'bundle.js',
  },
  module: { //モジュールの変換設定。どんなファイルをどう変換するか。
    rules: [
      {
        test: /\.js$/, //.jsで終わるファイルを対象にする。
        exclude: /node_modules/, //node_modulesは変換対象から除く。
        use: {
          loader: 'babel-loader', //Webpack で Babel を使うためのローダー。
          options: {
            presets: ['@babel/preset-env'], //ES6+ の構文を古いブラウザでも動くように変換する設定。
          },
        },
      },
    ],
  },
};
