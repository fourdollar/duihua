/*
IBM Confidential
OCO Source Materials
6949-63A
(c) Copyright IBM Corp. 2016
*/

var selectClassifierID;
var selectClassifierName;
$(function(){
  update_selectClassifier();
  getClassifierName();
});
update_nlcLOtestSumm();// NLCテスト結果を更新して表示
// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#upload-testfile-input').change(function() {
  $('#upload-test-cover').html($(this).val());
});
// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#upload-customfile-input').change(function() {
  $('#upload-custom-cover').html($(this).val());
});
var classifier_names;
getLOproperty(); //自動学習のプロパティーを取ってくる

$(window).ready( function(){
  // ページ読み込み時に実行したい処理
  getLOproperty(); //自動学習のプロパティーを取ってくる
});
var execMode;

/*****************************************************************************
function getLOproperty
*****************************************************************************/
// NLC Classifierのリストを更新して表示する関数
function getLOproperty(){
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/getLOproperty",
    dataType: "json"
  })
  .done(function(response){
    classifier_names = response.classifier_name;

    if(response.automatic == "true"){
      execMode = "自動";
    }else{
      execMode = "手動";
    }
    $("#execMode").text("学習最適化実行モード : "+execMode);
    $("#term_FBdata").text("テストデータに使用するFeedbackデータの対象期間 : "+response.interval_days+"日");
    $("#cronBatchTime").text("バッチ開始時刻：" +response.cronBatchTime);

    return response;

  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
}

/*****************************************************************************
function update_nlcLOtestSumm
*****************************************************************************/
// NLC Classifierのリストを更新して表示する関数
function update_nlcLOtestSumm(){
  $.when(
    getLOproperty()
  ).done(function(){
    $.ajax({
      type: "POST",
      url: "/manage/api/v1/updateNlcLOtestSumm",
      dataType: "json"
    })
    .done(function(response){
      $("#execMode").text("学習最適化実行モード : " + execMode);
      $("#executedDate").text("テスト完了時刻 : "+response.execDate);
      $("#num_feedback").text("フィードバック数：" +response.num_feedback);

      var tableRef = document.getElementById("nlcLOtestSumm");
      var tableRowLength = tableRef.rows.length;
      for(var i=1;i<tableRowLength;i++){tableRef.deleteRow(1)}
      for(var i=0;i<response.result.length;i++){
        var newRow = tableRef.insertRow(tableRef.rows.length);
        var cell=[];
        for(var j=0;j<9;j++){
          cell[j] = newRow.insertCell(j);
        }

        var classifier_name= response.result[i].classifier_name;
        var downloadTestResult = "<div><input type=\"file\" id=\"nlc-file-input1\" name=\"csv\" multiple=\"multiple\" style=\"display: none;\"><button id=\"downloadTestResult\" type=\"button\" class=\"btn btn-warning btn-sm\" onclick=\"downloadTestResult(\'"+classifier_name+"\');\">Download</button></div>"
        var downloadTrainData = "<div><input type=\"file\" id=\"nlc-file-input2\" name=\"csv\" multiple=\"multiple\" style=\"display: none;\"><button id=\"downloadTrainResult\" type=\"button\" class=\"btn btn-success btn-sm\" onclick=\"downloadTrainData(\'"+classifier_name+"\');\">Download</button></div>"
        var submitProdNlc = "<button id=\"submitProdNlc\" type=\"button\" class=\"btn btn-info btn-sm\" onclick=\"submitProdNlc(\'"+classifier_name+"\');\">Submit</button><div id=\"message_submitProdNlc_"+classifier_name+"\"></div>"
        var downloadTestResult_disabled = "<div><input type=\"file\" id=\"nlc-file-input1\" name=\"csv\" multiple=\"multiple\" style=\"display: none;\"><button id=\"downloadTestResult\" type=\"button\" class=\"btn btn-warning btn-sm\" onclick=\"downloadTestResult(\'"+classifier_name+"\');\" disabled>Download</button></div>"
        var downloadTrainData_disabled = "<div><input type=\"file\" id=\"nlc-file-input2\" name=\"csv\" multiple=\"multiple\" style=\"display: none;\"><button id=\"downloadTrainResult\" type=\"button\" class=\"btn btn-success btn-sm\" onclick=\"downloadTrainData(\'"+classifier_name+"\');\" disabled>Download</button></div>"
        var submitProdNlc_disabled = "<button id=\"submitProdNlc\" type=\"button\" class=\"btn btn-info btn-sm\" onclick=\"submitProdNlc(\'"+classifier_name+"\');\" disabled>Submit</button><div id=\"message_submitProdNlc_"+classifier_name+"\"></div>"

        cell[0].innerHTML = classifier_name;
        cell[1].innerHTML = response.result[i].classifier_id;
        cell[2].innerHTML = response.result[i].rate_correctAns;
        cell[3].innerHTML = response.result[i].status;
        cell[4].innerHTML = response.result[i].num_traindata;
        cell[5].innerHTML = downloadTestResult;
        cell[6].innerHTML = downloadTrainData;

        if(classifier_name == classifier_names.AutoLearn || classifier_name == classifier_names.Modified){
          cell[7].innerHTML = submitProdNlc;
        }else{
          cell[7].innerHTML = "";
        }
        if(classifier_name == classifier_names.Modified && response.result[i].status!=="完了"){
          cell[5].innerHTML = downloadTestResult_disabled;
          cell[6].innerHTML = downloadTrainData_disabled;
          cell[7].innerHTML = submitProdNlc_disabled;
        }
        if(response.result[i].status!=="完了"){
          cell[5].innerHTML = downloadTestResult_disabled;
          cell[6].innerHTML = downloadTrainData_disabled;
          cell[7].innerHTML = submitProdNlc_disabled;
        }
        if(classifier_name == classifier_names.Production){
          cell[8].innerHTML = "NLC作成日時:"+response.result[i].created_date+"<br>"+response.result[i].remark;
        }else{
          cell[8].innerHTML = response.result[i].remark;
        }
      }
    })
    .fail(function( jqXHR, textStatus, errorThrown ){
      console.log(errorThrown);
    });
  }).fail(function(err){
    console.log(err);
  })
};


/*****************************************************************************
downloadNlcLOtest
*****************************************************************************/
//download result of LearningOptimization NLC-batch-test
//テスト結果ダウンロード
function downloadTestResult(classifier_name){

  $.ajax({
    type: "POST",
    url: "/manage/api/v1/downloadTestResult",
    data: {
      "train_type": classifier_name
    },
    dataType: "text"
  })
  .done(function(nlc_result){
    console.log(nlc_result);
    window.location = nlc_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};

/*****************************************************************************
downloadNlcLOtrain
*****************************************************************************/
//download training data of Learning Optimization NLC-batch-test
//トレーニングデータダウンロード

function downloadTrainData(classifier_name) {
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/downloadTrainData",
    data: {
      "train_type": classifier_name
    },
    dataType: "text"
  })
  .done(function(nlc_result){
    console.log("ファイルが転送されました");
    console.log(nlc_result);
    window.location = nlc_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};

/*****************************************************************************
download test data
*****************************************************************************/
//テストデータのダウンロード
function downloadTestData() {
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/downloadTestData",
    //data: formData
    dataType: "text"
  })
  .done(function(nlc_testdata){
    console.log("ダウンロードファイルを転送してもらいました。");
    console.log(nlc_testdata);
    window.location = nlc_testdata;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};

/*****************************************************************************
download custom-train data
*****************************************************************************/
//カスタマイズ用トレーニングデータのダウンロード
function downloadCustomTrain() {
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/downloadCustomTrain",
    //data: formData,
    dataType: "text"
  })
  .done(function(custom_traindata){
    console.log(custom_traindata);
    window.location = custom_traindata;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};

/*****************************************************************************
function uloadtest data
*****************************************************************************/
//テストデータのアップロード

$('#uploadTestDataForm').submit(function(event){
  //$('#uploadTestDataForm')(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得

  $.ajax({
    url: '/manage/api/v1/uploadTestData',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);// ボタンを無効化
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);// ボタンを有効化
    }
  })
  .done(function(response){
    $('#message_uploadtest').text(response);
    update_nlcLOtestSumm();
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    $('#message_uploadtest').text("テストデータのアップロード失敗");
    console.log(errorThrown);
  });


});

/*****************************************************************************
function create LearningOptimization Classifier submit form
*****************************************************************************/
// Learning Optimization用 Classifierを作成してテスト
$('#createLOClassifierForm').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  $.ajax({
    url: '/manage/api/v1/uploadModifiedData',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json' ,
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);// ボタンを無効化
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);// ボタンを有効化
    }
  })
  .done(function(response){
    $('#message_customtest').text(response);
    update_nlcLOtestSumm();
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});

/*****************************************************************************
Function create classifier for production
*****************************************************************************/
//本番環境へのトレーニングデータのsubmit
function submitProdNlc(classifier_name) {
  $('#message_submitProdNlc'+classifier_name).text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/submitProdNlc",
    data: {
      "train_type": classifier_name
    },
    dataType: "json"
  })
  .done(function(result){
    console.log(result);
    $('#message_submitProdNlc_'+classifier_name).text(result);
    update_nlcLOtestSumm();
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
};

/*****************************************************************************
Function change batch execution mode
******************************************************************************/
$('#update_execMode').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  //  var execMode = "";
  var execMode = false;
  if(document.forms.update_execMode.manual.checked == true){
    //   execMode = "manual";
    execMode = false;
  }else if(document.forms.update_execMode.auto.checked == true){
    //    execMode ="auto";
    execMode =true;
  }

  event.preventDefault();
  $('#message_changeExecMode').text("");
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/changeLOsetting",
    data:{
      "execMode":execMode
    },
    dataType: "json"
  })
  .done(function(result){
    console.log(result);
    $('#message_changeExecMode').text(result);
    update_nlcLOtestSumm()
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
});
/*****************************************************************************
Function retest for all train data
*****************************************************************************/
//再テスト実施
function retestAllTraindata() {
  $('#message_retest').text("　再テスト実施中です。");
  var result ='-' ;
  //  $('#retestAllTraindata').prop('disabled', true);
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/allTraindataRetest",
    dataType: "json"
  })
  .done(function(test_result){
    console.log(test_result);
    $('#message_retest').text("　再テストが成功しました。");
    update_nlcLOtestSumm();
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(JSON.stringify(jqXHR));
    console.log(textStatus + errorThrown);
    console.log("ループします。");
    var checkfunction;
    checkfunction = setInterval(function(){
      $.ajax({
        type: "POST",
        url: '/manage/api/v1/getRetestResult',
        dataType: "json"
      })
      .done(function(result){
        result = result.result;
        //      $('#message_retest').text("　再テストが完了しました。");
        if(result == "成功"){
          $('#message_retest').text("　再テストが完了しました。");
          update_nlcLOtestSumm();
          clearInterval(checkfunction);
        }else if(result == "失敗"){
          $('#message_retest').text("　再テストが失敗しました。");
          clearInterval(checkfunction);
        }else{
          console.log("再テストはまだ完了していません。");
        }
      })
      .fail(function(jqXHR2, textStatus2, errorThrown2){
        console.log(JSON.stringify(jqXHR2));
        console.log(textStatus2 + errorThrown2);
        //      $('#message_retest').text("　再テストが失敗しました。");
      });
    }　, 10000);
  });
};
/*****************************************************************************
function create InitialTraindata Classifier submit form
*****************************************************************************/
//初期トレーニングデータのアップロード
$('#uploadInitialTraindataForm').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  $.ajax({
    url: '/manage/api/v1/uploadTrainbaseData',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);// ボタンを無効化
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);// ボタンを有効化
    }
  })
  .done(function(response){
    $('#message_crtIniClass').text(response);
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});

//ここから井上追記
//QAテストコピペ
//セレクトボックスの中身を更新する
function update_selectClassifier(callback) {
  //jQueryを利用した非同期通信
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/listNlc",
    dataType: "json"
  })
  .done(function(response){
    console.log(response);
    $('#select_classifier_id_update').get(0).options.length = 0;
    //ここでajax通信をして、前回選択したクラシファイアー名を取得する。
    $.ajax({
      type: "POST",
      url: "/manage/api/v1/send_selectedNLC",  //ここを合わせる。
      dataType: "json"
    })
    .done(function(res){
      var pre_selectedNLC=res.selectedNLC;
      selectClassifierName=res.selectedNLC;
      console.log(selectClassifierName);
      for(var i=0;i<response.length;i++){
        //ここでajax通信をして、前回選択されたクラシファイアー名(pre_selectedNLC)を取得する→それで、response[i].nameと一致した場合は、Option()の引数としてtrueを加えて
        //はじめからセレクトボックスでそれが選ばれた状態にする。
        console.log("koksdopkdopas"+pre_selectedNLC);
        if(response[i].name==pre_selectedNLC){
          var newOpt = new Option(response[i].name, response[i].classifier_id,true,true);
        }else{
          var newOpt = new Option(response[i].name, response[i].classifier_id);
        }
        $('#select_classifier_id_update').get(0).appendChild(newOpt);
      }
      try{
              callback();
      }catch(e){
        console.log(e)
      }

    });
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
    callback();
  });
};

//新規作成
function setClassifier(){
  selectClassifierID = $("#select_classifier_id_update option:selected").val();
  selectClassifierName=$("#select_classifier_id_update option:selected").text();

  var sendClassifierInfo={
    ClassifierID:selectClassifierID,
    selectClassifierName:selectClassifierName,
  }
  $.ajax({
    url: '/manage/api/v1/ClassifierInfo', //ここを決める
    type: 'POST',
    data:JSON.stringify(sendClassifierInfo),  // JSONデータ本体
    contentType: 'application/json', // リクエストの Content-Type
    timeout: 5000,
  })
  .done(function(response){
    update_nlcLOtestSumm();
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
  //送った後に、画面側に表示させる
  if(selectClassifierName==""){
    selectClassifier='Classifierが選択されていません'
  }else{
    // selectClassifier='最適化学習中のクラシファイアは'+selectClassifierName+'(id:'+selectClassifierID+')'+'です';
    selectClassifier='最適化学習中のClassifierは'+selectClassifierName+'です';
  }
  $('#UseClassifierName').text(selectClassifier);
};

//ゲッターの定義
var selectClassifierInfo={
  selectClassifierID:'',
  selectClassifierName:'',
  get get_selectClassifierInfo(){
    var Get_sendClassifierInfo={
      selectClassifierID:null,
      selectClassifieName:null,
      ClassifierID:this.selectClassifierID,
      selectClassifierName:this.selectClassifierName,
    };
    return Get_sendClassifierInfo;
  },
}


//選択しているクラシファイアーを表示するための関数
function getClassifierName(){
  update_selectClassifier(function(){
    if(selectClassifierName==""){
      console.log(selectClassifierName);
      selectClassifier='Classifierが選択されていません';
    }else{
      // selectClassifier='最適化学習中のクラシファイアは'+selectClassifierName+'(id:'+selectClassifierID+')'+'です';
      selectClassifier='最適化学習中のClassifierは'+selectClassifierName+'です';
    }
    $('#UseClassifierName').text(selectClassifier);

  });
};

/*****************************************************************************
function create Classifier submit form
カスタマイズしたクラシファイアをアップロードする
watson_manage.jsをほぼ流用
*****************************************************************************/
// Classifierの作成
$('#uploadCustomizedClassifier_button').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  $.ajax({
    url: '/manage/api/v1/createNlc',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);// ボタンを無効化
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);// ボタンを有効化
    }
  })
  .done(function(response){
    $('#uploadCustomizedClassifierResult').text(response);
    update_manageNLCtable();
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});


/*****************************************************************************
downloadNlctest
テストの実施のところ
*****************************************************************************/
//download result of NLC-batch-test
function testClassifier(){
  event.preventDefault();
  selectClassifierID = $("#select_classifier_id_update option:selected").val();
  selectClassifierName=$("#select_classifier_id_update option:selected").text();
  var sendData={
    select_classifier_id:selectClassifierID,
    select_classifier_name:selectClassifierName
  }
  $.ajax({
    url: '/manage/api/v1/allTraindataRetest',
    type: 'POST',
    data:JSON.stringify(sendData),
    contentType: 'application/json',
  })
  .done(function(nlc_result){
    console.log(nlc_result.res);
    //window.location = nlc_result;
    //ここを他のものと同じように
    $("#test_nlc_result").text(nlc_result.res);
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};
