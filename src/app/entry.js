// ===== クライアント側のエントリーポイント。出欠ボタン・コメント編集ボタンのイベント処理を定義、Fetch APIを用いてサーバーと非同期通信を行い、画面表示を動的に更新する =====
'use strict';

// ----- jQueryライブラリの読み込み -----　$で使えるようにして、DOM操作（要素取得・イベント設定など）を簡単にしている。
import $ from 'jquery';

// ----- 出欠更新の処理 -----
// 出欠ボタンをすべて取得、各ボタンに対して順番に処理を設定、ボタンがクリックされたときに処理を実行、data属性から値を取得、出欠を次の状態に進める、サーバーへ送信、サーバーからのレスポンスを反映
$('.availability-toggle-button').each((i, e) => { //availability-toggle-buttonクラスが設定されている要素をすべて取得。$('.クラス名') はクラス名で要素を取得するjQueryのセレクタ。each 関数で各要素ごとに引数iに順番引数eにHTML要素を渡して無名関数を実行
  const button = $(e); //$(e) で、ボタン要素の jQuery オブジェクトを取得
  button.on('click', () => { //ボタンがクリックされたときのイベントを記述
    //jQuery の data 関数を使用して、src/routes/schedules.jsで準備した 4 つの情報を取得　予定ID/ユーザID/候補ID/出欠
    const scheduleId = button.data('schedule-id');
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability')); //HTMLから取得した情報は文字列になっているため、intに変換
    const nextAvailability = (availability + 1) % 3; //更新後の出欠を作成。0 → 1 → 2 → 0 → 1 → 2 のように循環させたいため、1を足して3の剰余（3 で割ったときの余り）で計算
    fetch( //非同期リクエストを行う POST メソッドの HTTP 通信で JSON を送り、返ってきたデータを読み込む
      `/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: nextAvailability }),
      },
    )
      .then((response) => response.json())
      .then((data) => {
        button.data('availability', data.availability);
        const availabilityLabels = ['欠', '？', '出'];
        button.text(availabilityLabels[data.availability]);
      });
  });
});

// ----- コメント更新の処理 -----
// self-comment-buttonのボタンを取得、ボタンがクリックされたときの処理を設定、ポップアップ表示でコメント入力させる、サーバーへコメントを送信、サーバーからのレスポンスで画面を更新
const buttonSelfComment = $('#self-comment-button'); //self-comment-buttonを取得
buttonSelfComment.on('click', () => { //クリックイベントを設定
  const scheduleId = buttonSelfComment.data('schedule-id');
  const userId = buttonSelfComment.data('user-id');
  const comment = prompt('コメントを255文字以内で入力してください。'); //prompt() テキストの入力を促すダイアログボックスを表示して、その入力内容を文字列として取得できる
  if (comment) {
    fetch(`/schedules/${scheduleId}/users/${userId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment }),
    })
      .then((response) => response.json())
      .then((data) => {
        $('#self-comment').text(data.comment);
      });
  }
});
