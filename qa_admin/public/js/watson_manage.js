/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/


//IPアドレス・チェック
/* 有効化する場合、このコメントブロックを外す
ipcheck();
function ipcheck(){
	$.ajax({
			type: "POST",
			url: "/api/v1/ipcheck", //url:ルートの下にある/api/v1/ipcheckというurlで受け取る
		})
		.done(function(response){ //通信が成功した場合、アクセス可否がJsonに格納され、引数としてdoneの関数に渡される
			console.log("isValidate:"+response.isValidate);
			var isValidateStr = response.isValidate;
			if (isValidateStr == 'false'){
				$('.navbar').css('display','none');
				$('.row').css('display','none');
			}
		})
		.fail(function(jqXHR, textStatus, errorThrown){
			//通信エラー
			console.log("通信エラー");
		});
}
有効化する場合、このコメントブロックを外す */

update_manageNLCtable();// NLC Classifierのリストを更新して表示
showClassifierThreshold();// 設定しているしきい値を取得

// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#create-file-input').change(function() {
    $('#create-cover').html($(this).val());
});

/*****************************************************************************
function create Classifier submit form
*****************************************************************************/
// Classifierの作成
$('#createClassifierForm').submit(function(event){
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
    $('#createClassifierResult').text(response);
		update_manageNLCtable();
	})
	.fail(function( jqXHR, textStatus, errorThrown ){
		console.log(errorThrown);
	});
});

/*****************************************************************************
function set Threshold submit form
*****************************************************************************/
// しきい値の設定
$('#setClassifierThreshold').submit(function(event){
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  console.log($("#confidenceThreshold").val()[0]);
  console.log($("#confidencePotentialThreshold").val()[0]);
  if($("#confidenceThreshold").val() == null) $('#setClassifierThresholdresult').text("値が指定されていません");
  else {
    $.ajax({
      url: '/manage/api/v1/setClassifierThreshold',
      type: $form.attr('method'),
      data: {"classifierThresholdValue" : $("#confidenceThreshold").val()[0],
      		 "classifierPotentialValue" : $("#confidencePotentialThreshold").val()[0]},
      dataType: 'json',
    })
    .done(function(response){
      console.log(response);
      $('#setClassifierThresholdresult').text(response);
    })
    .fail(function( jqXHR, textStatus, errorThrown ){
      console.log(errorThrown);
    });
  }
});




/*****************************************************************************
function showClassifierThreshold
*****************************************************************************/
// 設定しているしきい値を取得する関数
function showClassifierThreshold(){
	$.ajax({
		type: "POST",
		url: "/manage/api/v1/showClassifierThreshold",
		dataType: "json"
	})
	.done(function(response){
		console.log(response);
    //$('#classifierThresholdValue').val(response);
	$('#confidenceThreshold').val(response.classifierThresholdValue);
    $('#confidencePotentialThreshold').val(response.classifierPotentialValue);
    
	})
	.fail(function( jqXHR, textStatus, errorThrown ){
		console.log(errorThrown);
	});
}

/*****************************************************************************
function deleteClassifiers
*****************************************************************************/
// Classifierを削除する関数
function deleteClassifiers(){
	// 画面上でcheckしたClassifierのIDを変数に代入
	var checkedClassifierID = $("[name=nlcRadio]:checked").val();
	$.ajax({
		type: "POST",
		url: "/manage/api/v1/deleteNlc",
		dataType: "json",
		data: {classifier_id : checkedClassifierID}
	})
	.done(function(response){
		update_manageNLCtable();
	})
	.fail(function( jqXHR, textStatus, errorThrown ){
		console.log(errorThrown);
	});
}

/*****************************************************************************
function update_manageNLCtable
*****************************************************************************/
// NLC Classifierのリストを更新して表示する関数
function update_manageNLCtable(){
	$.ajax({
		type: "POST",
		url: "/manage/api/v1/listNlcstatus",
		dataType: "json"
	})
	.done(function(response){
		console.log(response);
		var tableRef = document.getElementById("manageNLCtable");
		var tableRowLength = tableRef.rows.length;
		for(var i=1;i<tableRowLength;i++){tableRef.deleteRow(1)}
		for(var i=0;i<response.length;i++){
			var newRow = tableRef.insertRow(1);
			var cell=[];
			for(var j=0;j<6;j++){
				cell[j] = newRow.insertCell(j);
			}

			cell[0].innerHTML = '<input type="radio" name="nlcRadio" value=' + response[i].classifier_id + '>';
			cell[1].innerHTML = response[i].name;
			cell[2].innerHTML = response[i].classifier_id;
			cell[3].innerHTML = response[i].language;
			cell[4].innerHTML = response[i].created;
			cell[5].innerHTML = response[i].status;
		}
	})
	.fail(function( jqXHR, textStatus, errorThrown ){
		console.log(errorThrown);
	});
}
