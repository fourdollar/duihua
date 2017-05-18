/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#Answerstore-file-input').change(function() {
  $('#Answerstore-cover').html($(this).val());
});

/*****************************************************************************
function create Answerstore submit form
*****************************************************************************/
// アンサーストアの作成
$('#createAnswerstoreForm').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  $.ajax({
    url: '/manage/api/v1/createAnswerstore',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);// ボタンを無効化
      $('#createAnswerstoreResult').text("アンサーストア作成中");
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);// ボタンを有効化
    }
  })
  .done(function(response){
    $('#createAnswerstoreResult').text(response);
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});

/*****************************************************************************
function upload to Answerstore submit form
*****************************************************************************/
// アンサーストアへデータをアップロード
$('#uploadAnswerstoreForm').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  $.ajax({
    url: '/manage/api/v1/uploadAnswerstore',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);
      $('#uploadAnswerstoreResult').text("アンサーストアデータの登録中");
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);
    }
  })
  .done(function(response){
    $('#uploadAnswerstoreResult').text(response);
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    $('#uploadAnswerstoreResult').text('アンサーストアデータの登録失敗:' + errorThrown);
    console.log(errorThrown);
  });
});

/*****************************************************************************
function dspAnswerstore
*****************************************************************************/
// アンサーストアのテーブル内容を表示
function dspAnswerstore() {
  $('#columns_Answerstore').remove();
  var columns_Answerstore = $('<div>');
  columns_Answerstore.attr('id', 'columns_Answerstore');
  $('#AS-modal-body').append(columns_Answerstore);
  $.ajax({
    url: '/manage/api/v1/dspAnswerstore',
    type: "POST",
    dataType: 'json'
  })
  .done(function(response){
    $('#columns_Answerstore').columns({
      "data": response
    });
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};
