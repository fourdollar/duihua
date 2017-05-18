$('#failure_list').hide();
$('#createAuthFileResult').hide();

/*****************************************************************************
function upload to userAUTH form
*****************************************************************************/

// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#UserAuth-file-input').change(function() {
    $('#security-cover').html($(this).val());
});


// ユーザーの認証データをアップロード
$('#uploadUserAuthForm').submit(function(event){
  $('#createAuthFileResult').hide();
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
    console.log("アップロードを開始します");
  $.ajax({
    url: '/manage/api/v1/uploadAuthList',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);
      $('#createAuthFileResult').text("登録中");
      $('#failure_list').hide();
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);
    }
  })
  .done(function(response){
    $('#createAuthFileResult').show();
    $('#createAuthFileResult').text(response.text);
    if(response.failure_list.length > 0){
      //console.log(response);
      $('#failure_list').show();
      var tableRef = document.getElementById("failure_list");
      var tableRowLength = tableRef.rows.length;
      for(var i=1;i<tableRowLength;i++){tableRef.deleteRow(1)}
      for(var i=0;i<response.failure_list.length;i++){
        var newRow = tableRef.insertRow(1);
        var cell=[];
        for(var j=0;j<4;j++){
          cell[j] = newRow.insertCell(j);
        }
        //cell[0].innerHTML = response.failure_list[i].ID;
        cell[0].innerHTML = response.failure_list[i].USERID;//MBN
        cell[1].innerHTML = response.failure_list[i].USERNAME;//MBN
        cell[2].innerHTML = response.failure_list[i].REASON;//MBN
      }
    }
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    $('#createAuthFileResult').show();
    $('#createAuthFileResult').text('ユーザーリストの登録失敗:' + errorThrown);
    console.log(errorThrown);
  });
});


/*****************************************************************************
downloadQAtest
*****************************************************************************/
//download result of QA-batch-test
function downloadUserAuthForm(){
  console.log("ダウンロードを実行します。");
  $.ajax({
    url: '/manage/api/v1/downloadAuthList',
    type: 'POST',
    dataType: 'text'
  })
  .done(function(QA_result){
    console.log(QA_result);
    window.location = QA_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};

/*****************************************************************************
function upload to IPList form
*****************************************************************************/

// input type="file"タグとspan id="***-cover"タグの値を同期させる
$('#IPList-file-input').change(function() {
  $('#IPList-cover').html($(this).val());
});

// IPアドレスリストのデータをアップロード
$('#uploadIPListForm').submit(function(event){
  $('#uploadIPListResult').hide();
  event.preventDefault();// HTMLでの送信をキャンセル
  var $form = $(this);// 操作対象のform要素を取得
  var formData = new FormData($form[0]);// FormDataオブジェクトを作成
  var $button = $form.find('button');// 送信ボタンを取得
  console.log("アップロードを開始します");
  $.ajax({
    url: '/manage/api/v1/uploadIPList',
    type: $form.attr('method'),
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    beforeSend: function(xhr, settings){
      $button.attr('disabled', true);
      $('#uploadIPListResult').text("登録中");
      console.log("登録開始");
    },
    complete: function(xhr, textStatus){
      $button.attr('disabled', false);
    }
  })
  .done(function(response){
    $('#uploadIPListResult').show();
    $('#uploadIPListResult').text(response);
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    $('#uploadIPListResult').show();
    $('#uploadIPListResult').text('IPリストの登録失敗:' + errorThrown);
    console.log(errorThrown);
  });
});


/*****************************************************************************
downloadIPList
*****************************************************************************/
//download IP List
function downloadIPList(){
  $.ajax({
    type:"POST",
    url: '/manage/api/v1/downloadIPList',
    dataType: 'text'
  })
  .done(function(download_result){
    console.log(download_result);
    window.location = download_result;
  })
  .fail(function( jqXHR, textStatus, errorThrown ){
    console.log(errorThrown);
  });
};
