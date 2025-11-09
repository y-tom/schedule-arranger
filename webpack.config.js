// ===== WebpackでJavaScriptファイル、CSSファイルをまとめて変換 =====
// ① Webpackがスタート地点（src/app/entry.js）を見つける
// ② 関連するすべてのJSファイルをまとめて1つ（bundle.js）にする
// ③ Babel（新しいJavaScriptを古い環境でも動くように書き換える変換ツール）で新しい書き方を古いブラウザでも動くように直す（ES6+ を ES5 に変換）
// ④ 変換＆結合した結果をpublic/javascripts/bundle.jsに出力

//mini-css-extract-pluginを使用して独立したファイルとして抽出したCSSを<head>内に<link>で埋め込む
//通常webpackはCSSをJavaScriptファイルにバンドルして出力する。<style>がDOM に挿入される処理には時間がかかり、一瞬不格好な状態で表示される。これをプラグインを使ってCSSを独立のファイルにすることで防ぐ。
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
module.exports = {
  context: __dirname + '/src/app', //エントリーポイント（基準ディレクトリ）。src/app フォルダを基準にする。__dirname はこの設定ファイルがあるディレクトリの絶対パス
  mode: 'production', //node:純粋に設定のみ。production:コードを圧縮するなどして最適化、本番環境に適したファイル生成。他のmodeはdevelopmentなど
  entry: './entry', //ビルドの開始地点となる JavaScript ファイルを指定。context で src/app を基準にしているので、実際のパスはsrc/app/entry.js
  output: { //出力先。public/javascripts/bundle.js が生成される
    path: __dirname + '/public',
    filename: 'javascripts/bundle.js',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'stylesheets/bundle.css',
    }),
  ],
  module: { //モジュールの変換設定。どんなファイルをどう変換するか。
    rules: [
      {
        test: /\.js$/, //.jsで終わるファイルを対象にする。
        exclude: /node_modules/, //node_modulesは変換対象から除く。
        use: {
          loader: 'babel-loader', //WebpackでBabelを使うためのローダー。
          options: {
            presets: ['@babel/preset-env'], //ES6+ の構文を古いブラウザでも動くように変換する設定。
          },
        },
      },
      {
        test: /\.css$/, //.cssで終わるファイルを対象にする。
        use: [MiniCssExtractPlugin.loader, 'css-loader'], //CSSファイルをJavaScriptモジュールとしてインポートするためのローダー。
      },
    ],
  },
};
