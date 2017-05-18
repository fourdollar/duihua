/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

/*****************************************************************************
Define Valuable Section
*****************************************************************************/
//watson_qa.js内で利用する変数を定義する
var chatlognumber = 0; //QAサービス内のやり取りの番号
var response_history = []; //質問へのresponceを格納
var setting_feedback = 1; //「フィードバック機能」の設定因子
var setting_multi_answer = 1; //「複数選択肢の表示」機能の設定因子
var setting_confidence = 1; //「確信度の表示」機能の設定因子
var answer_chatlognumber =0; //「フィードバック機能」のModal画面にて、どの回答に対するフィードバックかを指定するために使用する
var answer_seq =0; //「フィードバック機能」のModal画面にて、回答内の順番を指定する
var session_id = '0'; // genSessionId()が値を設定する
var client_id = 'WebAppli01'; // この初期値はIPアドレスで上書きされる

// 初期セットアップ
conf_feedback(setting_feedback);
conf_multi_answer(setting_multi_answer);
conf_confidence(setting_confidence);

//IPアドレス・チェック
ipcheck();
function ipcheck(){
  $.ajax({
        type: "POST",
        url: "/api/v1/ipCheck", //url:ルートの下にある/api/v1/ipcheckというurlで受け取る
      })
      .done(function(response){ //通信が成功した場合、アクセス可否がJsonに格納され、引数としてdoneの関数に渡される
        console.log("isValidate:"+response.isValidate);
        var isValidateStr = response.isValidate;
        if (isValidateStr == 'false'){
          $('.navbar').css('display','none');
          $('.row').css('display','none');
        }
        client_id = response.ip;
      })
      .fail(function(jqXHR, textStatus, errorThrown){
        //通信エラー
        console.log("通信エラー");
      });
};

//SESSION_IDの生成
genSessionId();
function genSessionId() {
  var date = new Date();
  var year_val = date.getFullYear();
  var month_val = date.getMonth() + 1;
  var month_str = ("0"+month_val).substr(-2);
  var date_str =  ("0"+date.getDate()).substr(-2);
  var hour_str = ("0"+date.getHours()).substr(-2);
  var minute_str = ("0"+date.getMinutes()).substr(-2);
  var second_str = ("0"+date.getSeconds()).substr(-2);
  var millisecond_str = ("000"+date.getMilliseconds()).substr(-4);
  var rand_val = Math.floor(Math.random() * 10000);
  var rand_str = ("000"+rand_val).substr(-4);
  session_id = year_val + month_str + date_str + "_" + hour_str + minute_str + second_str + "_" + millisecond_str + rand_str;
};

//開始時に「こんにちは、ご質問を入力してください」の吹き出しの表示
greet();
function greet(){
  document.getElementById("chatlog").innerHTML += '<div class="row"><div class="col-xs-11">'+
  '<div class="col-xs-2 pull-1"><center><img src="images/watson_think_stop.gif" class="watsongif"></center></div>' +
  '<div class="col-xs-offset1"><p class="balloon-left">こんにちは、ご質問を入力してください</p></div></div>';
};

//modal画面(other comment feedback)にてアンサーストアのプルダウン内容の取得処理
dispExpectedAnser();
function dispExpectedAnser(){
  $.ajax({
        url: '/api/v1/dspAnswerstore',
        type: "POST",
        dataType: 'json'
      })
      .done(function(response){
        // console.log("answer store");
         $("#ExpectedAnswer").append("<option value=''></option>");

        for(var i= 0;i< response.length;i++){
          // console.log(response);
          $("#ExpectedAnswer").append("<option value=" + response[i].CLASS + ">"+ response[i].TITLE + "</option>");
        }
      })
      .fail(function( jqXHR, textStatus, errorThrown ){
        console.log(errorThrown);
      });
};

//modal画面(other comment feedback)起動時に起動元のotherボタンを特定する処理
$('#exampleModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget); // Button that triggered the modal
  answer_seq = button.data('num');
  answer_chatlognumber = button.data('chatlognumber');
  var modal = $(this);
});


/*****************************************************************************
Function askwatson
*****************************************************************************/
//post question through QuestionText form to ask Watson a question
//create answer field and get Watson responses

function askwatson(ask) {
  ask = ask.replace(/\r?\n/g,"");
  //if(ask == "") ask = $('#QuestionText').val();

  if(ask != "") {  //入力の吹き出しの表示、watsonのgifと回答の吹き出しの表示
	  document.getElementById("chatlog").innerHTML += '<div class="row"><div class="col-xs-11">' +
	    '<p id="watsonQuestion' + chatlognumber + '" class="balloon-right"> </p></div>' +
	    '<div class="col-xs-11"><div class="col-xs-2 pull-l"><center><img class="watsongif" id="watsongif' + chatlognumber + '" src="images/watson_think.gif"></center></div>' +
	    '<div class="col-xs-offset1"><p id="watsonAnswer' + chatlognumber + '" class="balloon-left"></p></div>';
    $('#watsonQuestion' + chatlognumber).text(ask);
    $('#watsonAnswer' + chatlognumber).text("問い合わせ中");
    document.getElementById('watsongif' + chatlognumber).src="images/watson_think.gif";
    document.getElementById("watsonAnswer" + chatlognumber).scrollIntoView(true);
    document.getElementById("QuestionText").focus();
    $('#QuestionText').val("");

    //jQueryを利用した非同期通信
    //質問テキストの送信
    $.ajax({
      type: "POST",
      url: "/api/v1/question", //url:ルートの下にある/api/v1/questionというurlで受け取る
      data: {
        "text": ask,
        "session_id": session_id,
        "client_id": client_id,
        "chat_num" : chatlognumber,
        "setting_multi_answer" : setting_multi_answer
      }, //data:画面から入力された質問データ
      dataType: "json"
    })
    .done(function(response){ //通信が成功した場合、データがanswerに格納され、引数としてdoneの関数に渡される
      // 解答欄の更新
      console.log(response);
      response_history.push(response);
      $('#watsonAnswer' + chatlognumber).html('');
      for (var i=0;i<Math.min(response.answers.length,setting_multi_answer);i++)
      $('#watsonAnswer' + chatlognumber).get(0).innerHTML += response.answers[i].answer + '<BR>' +
      ((setting_confidence == 1) ? '(' + Math.floor(response.answers[i].confidence*10000)/100 + '%)' : '') +
      //((setting_feedback == 1) ? ' <span style="float:right;"><button id="goodfeedback' + chatlognumber + '-' + i +
      //'" type="button" class="btn btn-info btn-xs" onclick="putfeedback(' + chatlognumber + ',' + i + ',1);"><span class="glyphicon glyphicon-thumbs-up">Good</button> &nbsp;&nbsp;&nbsp; <button id="badfeedback' +
      //chatlognumber + '-' + i + '" type="button" class="btn btn-warning btn-xs" onclick="putfeedback(' + chatlognumber + ',' + i + ',-1);"><span class="glyphicon glyphicon-thumbs-down">Bad</button></span><BR> ' : '<BR>');
      //
      //pop-up feedbackを有効にする場合、下記を使用する
      ((setting_feedback == 1) ? ' <span style="float:right;"><button id="goodfeedback' + chatlognumber + '-' + i +
          '" type="button" class="btn btn-info btn-xs" onclick="putfeedback(' + chatlognumber + ',' + i + ',1);">' +
          '<span class="glyphicon glyphicon-thumbs-up">Good</button> ' +
          '<button id="badfeedback'+ chatlognumber + '-' + i + '" type="button" class="btn btn-warning btn-xs" onclick="putfeedback(' + chatlognumber + ',' + i + ',-1 );">' +
          '<span class="glyphicon glyphicon-thumbs-down">Bad</button>' +
          '&nbsp;&nbsp;<button id="otherfeedback' + chatlognumber + '-' + i + '"' +
          ' type="button" class="btn btn-primary btn-xs" data-toggle="modal" data-target="#exampleModal" ' +
          'data-chatlognumber=' + chatlognumber + ' data-num=' + i + ' >Other</button></span><BR>'
              : '<BR>'
      );

      document.getElementById('watsongif' + chatlognumber).src="images/watson_think_stop.gif";
      document.getElementById("watsonAnswer" + chatlognumber).scrollIntoView(true);
      document.getElementById("QuestionText").focus();
      $('#QuestionText').val("");
      chatlognumber++;

//// Text to Speechを使用する場合
  // if (response.answers[0].answer4speech != "") {
  //   var downloadURL = '/api/synthesize' +
  //     '?voice=ja-JP_EmiVoice' +
  //     '&text=' + encodeURIComponent(response.answers[0].answer4speech) +
  //     '&X-WDC-PL-OPT-OUT=0'; // sessionPermissions true ? 0 : 1
  //
  //   var audio = $('.audio').get(0);
  //   try {
  //     audio.currentTime = 0;
  //   }
  //   catch(ex) {
  //     // ignore. Firefox just freaks out here for no apparent reason.
  //   }
  //   audio.controls = true;
  //   audio.pause();
  //   audio.src = downloadURL;
  //   audio.play();
  // }

    })
    .fail(function(jqXHR, textStatus, errorThrown){
      console.log(errorThrown);
      $('#watsonAnswer' + chatlognumber).get(0).innerHTML = textStatus + ' : ' + errorThrown + '<BR>管理者にお問合わせください。'
      document.getElementById('watsongif' + chatlognumber).src="images/watson_think_stop.gif";
      document.getElementById("QuestionText").scrollIntoView(true);
      document.getElementById("QuestionText").focus();
      $('#QuestionText').val("");
      response_history.push("");//ここはchatlognumberとresponse_historyのデータを対応させるために必要
      chatlognumber++;
    });
  };
};

/*****************************************************************************
Function putfeedback
*****************************************************************************/
//give "Good" or "Bad" feedback to responses
function putfeedback(feedbacklognumber, num, feedback_result) {
  var goodbutton = $('#goodfeedback'+feedbacklognumber+'-'+num);
  var badbutton = $('#badfeedback'+feedbacklognumber+'-'+num);
  var response_feedback = {
    session_id : response_history[feedbacklognumber].session_id,
    client_id : response_history[feedbacklognumber].client_id,
    chat_num : response_history[feedbacklognumber].chat_num,
    feedback : feedback_result,
    text : response_history[feedbacklognumber].text,
    class : response_history[feedbacklognumber].answers[num].class,
    answer : response_history[feedbacklognumber].answers[num].answer,
    confidence : response_history[feedbacklognumber].answers[num].confidence,
    answer_num : (num + 1),
    setting_multi_answer : setting_multi_answer,
    expected_answer :"",  //ブランク値をセット
    comment :"" //ブランク値をセット
  };
  console.log("response_feedback" + response_feedback);
  feedback(response_feedback);
  goodbutton.get(0).disabled=true; //ボタンを無効化
  badbutton.get(0).disabled=true; //ボタンを無効化

  //結果に合わせボタンの色を変更
  if(feedback_result == 1){
	  goodbutton.removeClass('btn-info');
	  goodbutton.addClass('btn-primary');
	  badbutton.addClass('btn-notChosen');
  }else{
	  goodbutton.addClass('btn-notChosen');
	  badbutton.removeClass('btn-warning');
	  badbutton.addClass('btn-danger');
  };
};


/*****************************************************************************
 Function feedback popup - save feedback
 *****************************************************************************/
//modal画面で保存をクリックされたときのイベント
function saveComment(){
  var otherbutton = $('#otherfeedback'+answer_chatlognumber+'-'+answer_seq);
  var response_feedback = {
    session_id : response_history[answer_chatlognumber].session_id,
    client_id : response_history[answer_chatlognumber].client_id,
    chat_num : answer_chatlognumber,
    feedback : 9,  // 「フィードバックの表示／ダウンロード」機能では0以外を出力しているため、仮で'9'をセット
    text : response_history[answer_chatlognumber].text,
    class : response_history[answer_chatlognumber].answers[answer_seq].class,
    answer : response_history[answer_chatlognumber].answers[answer_seq].answer,
    confidence : response_history[answer_chatlognumber].answers[answer_seq].confidence,
    answer_num : (answer_seq + 1),
    setting_multi_answer : setting_multi_answer,
    expected_answer :$("#ExpectedAnswer").children(':selected').val(),
    comment :$("#comment").val()
  };

  console.log("response_feedback" + response_feedback);
  feedback(response_feedback);
  //blankで初期化
  $("#ExpectedAnswer").val("");
  $("#comment").val("");

  otherbutton.get(0).disabled=true; //ボタンを無効化
};

/*****************************************************************************
 Function feedback popup - cancel feedback
 *****************************************************************************/
//modal画面でCloseをクリックされたときのイベント
function closePopup(){
  //blankで初期化
  $("#ExpectedAnswer").val("");
  $("#comment").val("");
};

/*****************************************************************************
Function feedback
*****************************************************************************/
//posting feedbacks for registration
function feedback(response_feedback) {
  //jQueryを利用した非同期通信
  $.ajax({
    type: "POST",
    url: "/api/v1/feedback", //url:ルートの下にある/callnlcというurlで受け取る 変更/callnlc→/api/v1/question
    data: response_feedback,
    dataType: "json"
  })
  .done(function(response){ //通信が成功した場合、データがanswerに格納され、引数としてdoneの関数に渡される
    // 解答欄の更新
    console.log(response);
    $('#debuginfo').html(JSON.stringify(response));
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(errorThrown);
  });
};

/*****************************************************************************
Function conf_feedback
*****************************************************************************/
//「フィードバック」機能の設定
function conf_feedback(setting) {
  if(((setting == undefined) && (setting_feedback == 0)) || (setting == 1)) {
    $('#conf_feedback').html('<span class="glyphicon glyphicon-ok"> フィードバック機能');
    setting_feedback = 1; //機能有効化
  }
  //機能有効時
  else if(((setting == undefined) && (setting_feedback == 1)) || (setting == 0)) {
    $('#conf_feedback').html('<span class="glyphicon glyphicon-remove"> フィードバック機能');
    setting_feedback = 0; //機能無効化
  };
};

/*****************************************************************************
Function conf_multi_answer
*****************************************************************************/
//「複数選択肢の表示」機能の設定
function conf_multi_answer(setting) {
  if(((setting == undefined) && (setting_multi_answer == 1)) || (setting > 1)) {
    $('#conf_multi_answer').html('<span class="glyphicon glyphicon-ok"> 複数選択肢の提示');
    setting_multi_answer = 3; //返答数 3
  }
    //機能有効時
  else if(((setting == undefined) && (setting_multi_answer > 1)) || (setting == 1)) {
    $('#conf_multi_answer').html('<span class="glyphicon glyphicon-remove"> 複数選択肢の提示');
    setting_multi_answer = 1; //返答数 1
  };
};

/*****************************************************************************
Function conf_confidence
*****************************************************************************/
//「確信度の表示」機能の設定
function conf_confidence(setting) {
  if(((setting == undefined) && (setting_confidence == 0)) || (setting == 1)) {
    $('#conf_confidence').html('<span class="glyphicon glyphicon-ok"> 確信度の表示');
    setting_confidence = 1; //機能有効化
  }
  //機能有効時
  else if(((setting == undefined) && (setting_confidence == 1)) || (setting == 0)) {
    $('#conf_confidence').html('<span class="glyphicon glyphicon-remove"> 確信度の表示');
    setting_confidence = 0; //機能無効化
  };
};
