#!/bin/bash
# ===== 開発環境セットアップスクリプト =====

# 1. コンテナをバックグラウンドで起動、コンテナに入る（app,db=compose.yamlに書かれているサービス名、bash=コンテナ内で実行するシェル）
  # appコンテナに入る（普段の開発作業）
  docker compose up -d
  docker compose exec app bash

  # DBコンテナに入る（PostgreSQLに直接入ってSQLを確認したり、テーブル作成・デバッグをしたいときのみ）
  docker compose up -d
  docker compose exec db bash

# 2. データ保存用の永続化ストレージ（ボリューム）を作成（同名のボリュームがあれば削除する）
  docker volume rm schedule-arranger-data
  docker volume create --name=schedule-arranger-data

# 3. コンテナ内でパッケージをインストールする
  # Honoアプリの基本ライブラリ
  yarn add hono@^4.7.10 @hono/node-server@^1.14.2

  # GitHub認証に必要なモジュール
  yarn add @hono/oauth-providers@0.8.0 iron-session@8.0.1

  # テスティングフレームワーク
  yarn add --dev jest@29.7.0 dotenv@16.4.5

# 4. Prismaのインストール（Node.js でデータベースを操作するためのパッケージ）
  yarn add -D prisma@5.13.0

  # Prisma のプロジェクトの初期設定（Prismaの主要設定ファイルであるprisma/schema.prismaと、.envのDATABASE_URLが自動で追加される。--urlオプションは接続するデータベースのURLを指定）
  npx prisma init --url postgresql://postgres:postgres@db/schedule_arranger
