/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

// jQuery プラグインの日時の入力支援機能
$(".form_datetime").datetimepicker({
    format: "yyyy/mm/dd hh:ii",
    language: 'ja'
});

/*****************************************************************************
Function createFeedbackstore
*****************************************************************************/
//create Feedbackstore
function createFeedbackstore() {
  $('#message_feedback').text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/createFeedbackstore",
    data: {}, //data:画面から入力された質問データ
    dataType: "json"
  })
  .done(function(feedback_result){
    console.log(feedback_result);
    $('#message_feedback').text(feedback_result); //フィードバックストアの有無、作成完了を通達
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
};

/*****************************************************************************
Function dspFeedback
*****************************************************************************/
// display stored feedback with options of time and evaluation
// display in a modal-dialog
function dspFeedback() {
  $('#columns_feedback').remove(); //前のフィードバック表示のcolumns_feedbackを消去

  var columns_feedback = $('<div>');
  columns_feedback.attr('id', 'columns_feedback');
  $('#FB-modal-body').append(columns_feedback);//新規のcolumns_feedbackを作成

  $('#message_feedback').text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/dspFeedback",
    //表示するフィードバック結果の指定
    data: {
      "dtp_to": $("#dtp_to").val(), //日時指定
      "dtp_from": $("#dtp_from").val(), //日時指定
      "feedback_good": $("#feedback_good").is(':checked'), //「Good」評価
      "feedback_bad": $("#feedback_bad").is(':checked'), //「Bad」評価
      "feedback_all": $("#feedback_all").is(':checked') //すべてのフィードバック結果を指定
    }, //data:画面から入力された質問データ
    dataType: "json"
  })
  //作成したフィードバックの表示
  .done(function(feedback_result){
    $('#columns_feedback').columns({
      "data": feedback_result
    });
    console.log(feedback_result);
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
};

/*****************************************************************************
Function downloadFeedback
*****************************************************************************/
//download specified feedback
function downloadFeedback() {
  $('#message_feedback').text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/downloadFeedback",
    //ダウンロードするフィードバック結果の指定
    data: {
      "dtp_to": $("#dtp_to").val(), //日時指定
      "dtp_from": $("#dtp_from").val(), //日時指定
      "feedback_good": $("#feedback_good").is(':checked'), //「Good」評価
      "feedback_bad": $("#feedback_bad").is(':checked'), //「Bad」評価
      "feedback_all": $("#feedback_all").is(':checked') //すべてのフィードバック結果を指定
    }, //data:画面から入力された質問データ
    dataType: "text"
  })
  .done(function(feedback_result){
    console.log(feedback_result);
    window.location = feedback_result; //ダウンロードダイアログを表示
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
};

/*****************************************************************************
Ffunction deleteFeedback
*****************************************************************************/
//delete a specified feedback
function deleteFeedback() {
  $('#message_feedback').text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/deleteFeedback",
    //削除するフィードバック結果の指定
    data: {
      "dtp_to": $("#dtp_to").val(), //日時指定
      "dtp_from": $("#dtp_from").val(), //日時指定
      "feedback_good": $("#feedback_good").is(':checked'), //「Good」評価
      "feedback_bad": $("#feedback_bad").is(':checked'), //「Bad」評価
      "feedback_all": $("#feedback_all").is(':checked') //すべてのフィードバック結果を指定
    }, //data:画面から入力された質問データ
    dataType: "json"
  })
  .done(function(feedback_result){
    console.log(feedback_result)
    $('#message_feedback').text(feedback_result); //指定のフィードバックの削除完了を通達
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
    $('#message_feedback').text(textStatus + errorThrown);
  });
};
