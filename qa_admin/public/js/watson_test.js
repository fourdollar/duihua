/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

/*****************************************************************************
update_qatestNLCtable
*****************************************************************************/
//update and display NLC classifiers list in qatestNLCtable
update_qatestNLCtable();

$('#nlc-file-input').change(function() {
  $('#nlc-cover').html($(this).val());
});

$('#qa-file-input').change(function() {
  $('#qa-cover').html($(this).val());
});

function update_qatestNLCtable() {
  //jQueryを利用した非同期通信
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/listNlc",
    dataType: "json"
  })
  .done(function(response){
    console.log(response);
    var tableRef = document.getElementById("qatestNLCtable");
    var tableRowLength = tableRef.rows.length;
    $('#select_classifier_id').get(0).options.length = 0;
    for(var i=1;i<tableRowLength;i++){tableRef.deleteRow(1)}
    for(var i=0;i<response.length;i++){
      var newRow = tableRef.insertRow(1);
      var cell=[];
      for(var j=0;j<4;j++){
        cell[j] = newRow.insertCell(j);
      }

      cell[0].innerHTML = response[i].name;
      cell[1].innerHTML = response[i].classifier_id;
      cell[2].innerHTML = response[i].language;
      cell[3].innerHTML = response[i].created;

      var newOpt = new Option(response[i].name, response[i].classifier_id);
      $('#select_classifier_id').get(0).appendChild(newOpt);
    }
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
}

/*****************************************************************************
downloadNlctest
*****************************************************************************/
//download result of NLC-batch-test

$('#NlctestForm').submit(function(event){
  event.preventDefault();
  //formのデータを、html内で指定したurlに送信
  var $form = $(this);
  var formData = new FormData($form[0]);
  $.ajax({
    url: '/manage/api/v1/downloadNlctest',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'text'
  })
  .done(function(nlc_result){
    console.log(nlc_result);
    window.location = nlc_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});

/*****************************************************************************
dspnlctest
*****************************************************************************/
//display result of NLC-batch-test
//display in modal-dialog
function dspnlctest() {
  $('#dspnlc_columns').remove(); //前のテスト結果のdspnlc_columnsを消去

  var dspnlc_columns = $('<div>');
  dspnlc_columns.attr('id', 'dspnlc_columns');
  $('#Nlc-modal-body').append(dspnlc_columns); //新規のdspnlc_columnsを作成
  // FormData オブジェクトを作成
  // formのデータを、html内で指定したurlに送信
  var formData = new FormData($('#NlctestForm').get()[0]);
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/dspNlctest",
    data: formData,
    // Ajaxがdataを整形しない指定
    processData: false,
    // contentTypeもfalseに指定
    contentType: false,
    dataType: "json"
  })
  .done(function(data){
    $('#dspnlc_columns').columns({
      "data": data
    });
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
}

/*****************************************************************************
downloadQAtest
*****************************************************************************/
//download result of QA-batch-test

$('#QAtestForm').submit(function(event){
  event.preventDefault();
  //formのデータを、html内で指定したurlに送信
  var $form = $(this);
  var formData = new FormData($form[0]);
  $.ajax({
    url: '/manage/api/v1/downloadQAtest',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'text'
  })
  .done(function(QA_result){
    console.log(QA_result);
    window.location = QA_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
});


/*****************************************************************************
dspQAtest
*****************************************************************************/
//display result of QA-batch-test
//display in modal-dialog
function dspQAtest() {
  $('#dspQA_columns').remove(); //前のテスト結果のdspQA_columnsを消去

  var dspQA_columns = $('<div>');
  dspQA_columns.attr('id', 'dspQA_columns');
  $('#QA-modal-body').append(dspQA_columns); //新規のdspQA_columnsを作成
  // FormData オブジェクトを作成
  // formのデータを、html内で指定したurlに送信
  var formData = new FormData($('#QAtestForm').get()[0]);
  $.ajax({
    type: "POST",
    url: "/manage/api/v1/dspQAtest",
    data: formData,
    // Ajaxがdataを整形しない指定
    processData: false,
    // contentTypeもfalseに指定
    contentType: false,
    dataType: "json"
  })
  .done(function(data){
    console.log(data);
    $('#dspQA_columns').columns({//
      "data": data
    });
  })
  .fail(function(jqXHR, textStatus, errorThrown){
    console.log(textStatus + errorThrown);
  });
}
