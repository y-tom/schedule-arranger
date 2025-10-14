#!/bin/bash
# ===== 開発環境セットアップスクリプト =====

# 1. コンテナ起動・接続
  # コンテナをバックグラウンドで起動する　※毎回実行
  docker compose up -d

  # appコンテナに入る　※毎回実行　（app,db=compose.yamlに書かれているサービス名、bash=コンテナ内で実行するシェル）
  docker compose exec app bash

  # DBコンテナに入る　※DBアクセス時のみ（PostgreSQLに直接入ってSQLを確認したり、テーブル作成・デバッグを行う）
  docker compose exec db bash

# 2. データ保存用の永続化ストレージ作成　※初回 or 再構築時のみ
  docker volume create --name=schedule-arranger-data

    ※既存データを消す場合のみ
    docker volume rm schedule-arranger-data

# 3. パッケージインストール
  # Hono　※初回 or 新パッケージを追加時のみ
  yarn add hono@^4.7.10 @hono/node-server@^1.14.2

  # GitHub認証に必要なモジュール　※初回 or 新パッケージを追加時のみ
  yarn add @hono/oauth-providers@0.8.0 iron-session@8.0.1

  # テスティングフレームワーク　※初回 or 新パッケージを追加時のみ
  yarn add --dev jest@29.7.0 dotenv@16.4.5

# 4. Prisma設定（Node.js でデータベースを操作するためのパッケージ）
  # Prismaのインストール　※初回 or Prisma利用時のみ
  yarn add -D prisma@5.13.0

  # Prismaのプロジェクトの初期設定　※初回のみ（Prisma主要設定ファイルprisma/schema.prismaと、.envのDATABASE_URLが自動で追加される。--urlで接続データベースを指定）
  npx prisma init --url postgresql://postgres:postgres@db/schedule_arranger

  # schema.prismaを整形する　※初回 or schema.prisma編集時のみ
  npx prisma format

  # Prismaの内容をデータベースに反映させる　※初回 or モデル変更時のみ
  npx prisma db push


