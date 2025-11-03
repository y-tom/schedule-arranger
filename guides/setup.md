#!/bin/bash
# ===== 開発環境セットアップスクリプト =====
# ----- 開発作業時に毎回必要なコマンド -----
  docker compose up -d
  docker compose exec app bash
  yarn start

# 1. コンテナ起動・接続
  # コンテナをバックグラウンドで起動する　※毎回
  docker compose up -d

  # appコンテナに入る　※毎回（app,db=compose.yamlに書かれているサービス名、bash=コンテナ内で実行するシェル）
  docker compose exec app bash

# 2. サーバー・アプリ起動　※毎回
  yarn start

  ※初期化　初回の初期設定 or プロジェクトを初期化する場合のみ (package.json を生成する)
  yarn init

# 3. パッケージ
  # Hono　※新パッケージを追加時のみ
  yarn add hono@^4.7.10 @hono/node-server@^1.14.2

  # GitHub認証　※新パッケージを追加時のみ
  yarn add @hono/oauth-providers@0.8.0 iron-session@8.0.1

  # テスティングフレームワーク　※新パッケージを追加時のみ
  yarn add --dev jest@29.7.0 dotenv@16.4.5

# 4. Prisma（Node.js でデータベースを操作するためのパッケージ）
  # Prismaのインストール　※初回のみ
  yarn add -D prisma@5.13.0

  # Prismaの初期化　※初回の初期設定時のみ（Prisma主要設定ファイルprisma/schema.prismaと、.envのDATABASE_URLが自動で追加される。--urlで接続データベースを指定）
  npx prisma init --url postgresql://postgres:postgres@db/schedule_arranger

  # スキーマ整形　※schema.prisma変更時のみ
  npx prisma format

  # データベースへのスキーマ反映　※モデル変更時のみ
  npx prisma db push

  # Prismaクライアント生成　※schema.prisma変更時 or モデル変更時 or node_modules再生成時のみ
  npx prisma generate

# 5. DB
  # データ保存用の永続化ストレージ作成　※初回 or 再構築時のみ
  docker volume create --name=schedule-arranger-data

    ※既存データを消す場合のみ
    docker volume rm schedule-arranger-data

  # DBコンテナに入る　※DBアクセス時のみ（PostgreSQLに直接入ってSQLを確認したり、テーブル作成・デバッグを行う）
  docker compose exec db bash

  # psqlを起動、DBに接続する　※DBアクセス時のみ
  psql schedule_arranger
    # テーブル一覧
    \dt
    # クエリ例
    SELECT * FROM users;

# 6. Webpack
  # ES5に変換したファイルを作成　※初回 or public/javascripts/bundle.js作成時 のみ
  npx webpack
