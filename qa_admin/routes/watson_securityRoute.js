/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

'use strict';

/*****************************************************************************
Define Valuable Section
*****************************************************************************/
var express = require('express'); // express
var watson = require('watson-developer-cloud'); // watson developer cloud
var bluemix      = require('../config/bluemix');
var extend       = require('util')._extend;
var basicAuth = require('basic-auth-connect'); // 基本認証用
var _ = require("underscore");  // アンダースコア
var fs = require('fs');  // ファイル操作用
var multer  = require('multer');  // ファイルアップロード用
var upload = multer({ dest: 'uploads/' });  // ファイルアップロードの配置場所を定義
var csv = require("ya-csv");  // csv 操作用
var credentials_NLC;  // NLC のクレデンシャル
var credentials_DB;  // SQL DB のクレデンシャル
var settingJson ={};  // classifierSettings.json のデータを格納
var ibmdb = require('ibm_db');
var router = express.Router();  // create a new express server
var comFunc = require('../common/commonFunctions.js');
var constr = comFunc.constrSetting();




/*****************************************************************************
/manage/api/v1/uploadAuthList API Definition
*****************************************************************************/
// ユーザーリストの作成
router.post('/manage/api/v1/uploadAuthList', upload.single('csv'), function (req, res, next) {
  if (process.env.DEBUG == '1') console.log("アップロード開始します");
  var authListPath = "uploads/authList.csv"
  fs.rename(req.file.path , authListPath, function(){
    var reqPath = authListPath;  // 入力ファイルのパス
    var reader = csv.createCsvFileReader(authListPath, {});  // CSV Readerの定義
    var sqlError;
    var i = 0;
    var j = 0;
    var success = 0;
    var failure = 0;
    var failure_list =[];
    var conn = ibmdb.openSync(constr);
    if (process.env.DEBUG == '1') console.log("AUTH_LISTテーブルへの挿入を開始します。");
    if (process.env.DEBUG == '1') console.log("start connecting...");
    //begin transaction
    conn.beginTransaction(function(err){
      if (err) {
        next(err);
        return conn.closeSync();
      }
      // ya-csv reader error handling
      reader.addListener('error', function (err) {
        if (process.env.DEBUG == '1') console.log('/manage/api/v1/uploadAuthList Error : ' + req.file.path);
        return next(err);
      });
      if (process.env.DEBUG == '1') console.log("テーブルを削除します");
      try {
        var result_delete = conn.querySync("DROP TABLE AUTH_LIST;");
      } catch (e) {
        //console.log(sqlError.message);　
      }
      if (process.env.DEBUG == '1') console.log("テーブルを削除しました、作り直しに入ります");
      try {
        var result_create = conn.querySync("CREATE TABLE AUTH_LIST (USERID VARCHAR(100) NOT NULL PRIMARY KEY, PASSWORD VARCHAR(100) NOT NULL , USERNAME VARCHAR(300) NOT NULL);"); //MBN
      } catch (e) {
        sqlError = e;
        if (process.env.DEBUG == '1') console.log(sqlError.message);
      }
      reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
        //パスワードチェック時の確認用デバッグコード
        if (process.env.DEBUG == '1') console.log(data[1]);//MBN
        if (process.env.DEBUG == '1') console.log("数字と文字が混在しているか："+ (/[a-zA-Z]/.test(data[1]) && /[0-9]/.test(data[1]))  );//MBN
        if (process.env.DEBUG == '1') console.log("文字と記号が混在しているか："+ (/[a-zA-Z]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])));//MBN
        if (process.env.DEBUG == '1') console.log("数字と記号が混在しているか："+ (/[0-9]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])) );//MBN
        //パスワードが要件を満たしているかチェックする
      //  if(data[1].length > 5 && ((/[a-zA-Z]/.test(data[1]) && /[0-9]/.test(data[1])) || (/[a-zA-Z]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])) || (/[0-9]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])))){ //MBN
          ///パスワードは要件を満たしていたケース
          try {
            var result_insert = conn.querySync("INSERT INTO AUTH_LIST VALUES('" + data[0] + "','" + data[1] + "','" + data[2] +  "');");//MBN
            success++ ;
          } catch (e) {
            sqlError = e;
            console.log(sqlError.message);
          }
  //      }else{
          var reason ="" ;
          /*if(data[1].length <= 5 ) {//MBN
            reason += "文字数が足りません。";
          }else{
            reason += "文字数は足りています。";
          }
          if((/[a-zA-Z]/.test(data[1]) && /[0-9]/.test(data[1])) || (/[a-zA-Z]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])) || (/[0-9]/.test(data[1]) && /[!#$%&'()-=~^|\\{}\[\]*+@`_/?]/.test(data[1])) ) { //MBN
            reason += "パスワードの文字に関するルールは遵守されています。";
          }else{
            reason += "パスワードの文字に関するルールが遵守されていません。";
          }
          */
  /*        if (process.env.DEBUG == '1') console.log("パスワード："+data[1] + "はパスワードの要件を満たしていません");
          var failure_data = {"USERID":data[0] , "PASSWORD":data[1] , "USERNAME":data[2], "REASON":reason};//MBN
          failure_list[failure] = failure_data;
          failure++;
        }*/
        //commit
        conn.commitTransaction(function (err) {
          if (err) {
            next(err);
            return conn.closeSync();
          }
          j++;
          if (i == j) { // 非同期処理が全て完了したら
            conn.closeSync(); //完了後にcloseSync
            if (process.env.DEBUG == '1') console.log("ユーザーリストの入れ替えが完了しました。");
            var text ="" ;
            if(failure>0){
              text = "ユーザーリストを更新しました。" + success +"件を登録し、" + failure　+ "件は要件を満たしていませんでしたので登録していません。以下のリストが対象となります。" ;
            }else{
              text = "ユーザーリストを更新しました。全件登録を行いました。" ;
            }
            var response = {
              "text" : text,
              "failure_list" : failure_list
            };
            if (process.env.DEBUG == '1') console.log("失敗リストです:" + JSON.stringify(failure_list));
            setTimeout(function(){
              if (sqlError) next(sqlError);
              else   {
                res.json(response);
              };
            }, 1000);
          }
        });
        i++;
      });
    });
  });
});


/*****************************************************************************
/manage/api/v1/downloadAuthList API Definition
*****************************************************************************/
// ユーザーリストのデータをダウンロードするためのAPI
router.post('/manage/api/v1/downloadAuthList', function(req, res, next) {
  var output_file = 'downloads/a' + Math.random().toString(36).slice(-15) + '_authList.csv';   // 出力ファイルのパス
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream('public/'+output_file)); // CSV Writerの定義
  var sql_feedback = "SELECT USERID,PASSWORD,USERNAME FROM AUTH_LIST ORDER BY USERID";//MBN
  // ya-csv writer error handling
  writer.addListener('error', function (err) {
    if (process.env.DEBUG == '1') console.log('/manage/api/v1/downloadAuthList Error : ' + output_file);
    return next(err);
  });

  comFunc.executeSQL(sql_feedback, function(err, sqldata) {
    if (err) console.log(err);
    for (var i=0;i<sqldata.length;i++) {
      //ユーザーリストの書き出し
      var csvresult = [sqldata[i].USERID, sqldata[i].PASSWORD, sqldata[i].USERNAME];//MBN
      writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
    }
    setTimeout(function(){
      try {
        res.send('/' + output_file);
      } catch (err) { console.log("ここでエラーです。"); return next(err); }
      setTimeout(function(){
        fs.unlink('public/'+output_file, function (err) {  // テンポラリーで作成した出力ファイルを削除する。
          if (err) return next(err);
          if (process.env.DEBUG == '1') console.log('/manage/api/v1/downloadAuthList successfully deleted ' + output_file);
        });
      }, 20000);
    },5000)
  });
});


/*****************************************************************************
/manage/api/v1/uploadIPList API Definition
*****************************************************************************/
// IPリストの作成
router.post('/manage/api/v1/uploadIPList', upload.single('csv'), function (req, res, next) {
  if (process.env.DEBUG == '1') console.log("アップロード開始します");
  var IPListPath = "uploads/IPList.csv"
  fs.rename(req.file.path , IPListPath, function(){
    var reqPath = IPListPath;  // 入力ファイルのパス
    var reader = csv.createCsvFileReader(IPListPath, {});  // CSV Readerの定義
    var sqlError;
    var i = 0;
    var j = 0;

    var conn = ibmdb.openSync(constr);
    if (process.env.DEBUG == '1') console.log("IP_LISTテーブルへの挿入を開始します。");
    if (process.env.DEBUG == '1') console.log("start connecting...");
    //begin transaction
    conn.beginTransaction(function(err){
      if (err) {
        next(err);
        return conn.closeSync();
      }
      // ya-csv reader error handling
      reader.addListener('error', function (err) {
        if (process.env.DEBUG == '1') console.log('/manage/api/v1/IPList Error : ' + req.file.path);
        return next(err);
      });
      console.log("テーブルを削除します");
      try {
        var result_delete = conn.querySync("DROP TABLE IP_LIST;");
      } catch (e) {
        //console.log(sqlError.message);
      }
      if (process.env.DEBUG == '1') console.log("テーブルを削除しました、作り直しに入ります");
      try {
        //LocationNameは店舗名
        var result_create = conn.querySync("CREATE TABLE IP_LIST (IPADDRESS VARCHAR(15) NOT NULL,LOCATIONNAME VARCHAR(100) NOT NULL);");
      } catch (e) {
        sqlError = e;
        if (process.env.DEBUG == '1') console.log(sqlError.message);
      }
      reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
        try {
          //IPリストがどんな情報を持っているかでここは変わる
          var result_insert = conn.querySync("INSERT INTO IP_LIST VALUES('" + data[0] + "','" + data[1] + "');");
        } catch (e) {
          sqlError = e;
          if (process.env.DEBUG == '1') console.log(sqlError.message);
        }
        //commit
        conn.commitTransaction(function (err) {
          if (err) {
            next(err);
            return conn.closeSync();
          }
          j++;
          if (i == j) { // 非同期処理が全て完了したら
            conn.closeSync(); //完了後にcloseSync
            if (process.env.DEBUG == '1') console.log("IPリストの入れ替えが完了しました。");
            setTimeout(function(){
              if (sqlError) next(sqlError);
              else   {
                res.json("IPリストを更新しました。");
              };
            }, 1000);
          }
        });
        i++;
      });
    });
  });
});

/*****************************************************************************
/manage/api/v1/downloadIPList API Definition
*****************************************************************************/
// IPリストのデータをダウンロードするためのAPI
router.post('/manage/api/v1/downloadIPList', function(req, res, next) {

  var output_file = 'downloads/i' + Math.random().toString(36).slice(-15) + '_IPList.csv';   // 出力ファイルのパス
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream('public/'+output_file)); // CSV Writerの定義
  //IPアドレス順、店舗名順で並び替える必要はあまりないと判断したので、ORDER BY は使わない
  var sql_IPList = "SELECT IPADDRESS,LOCATIONNAME FROM IP_LIST";
  // ya-csv writer error handling
  writer.addListener('error', function (err) {
    if (process.env.DEBUG == '1') console.log('/manage/api/v1/downloadIPList Error : ' + output_file);
    return next(err);
  });

  comFunc.executeSQL(sql_IPList, function(err, sqldata) {
    if (err) console.log(err);
    for (var i=0;i<sqldata.length;i++) {
      //IPリストの書き出し
      var csvresult = [sqldata[i].IPADDRESS, sqldata[i].LOCATIONNAME];
      writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
    }
    try {
      res.send('/' + output_file);
    } catch (err) { if (process.env.DEBUG == '1') console.log("ここでエラーです。"); return next(err); }
    setTimeout(function(){
      fs.unlink('public/'+output_file, function (err) {  // テンポラリーで作成した出力ファイルを削除する。
        if (err) return next(err);
        if (process.env.DEBUG == '1') console.log('/manage/api/v1/downloadIPList successfully deleted ' + output_file);
      });
    }, 10000);
  });
});



// catch 404 and forward to error handler
router.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.code = 404;
  err.message = 'Not Found';
  next(err);
});

// error handler
router.use(function(err, req, res, next) {
  var error = {
    code: err.code || 500,
    error: err.message || err.error
  };
  console.log('error:', error);
  res.status(error.code).json(error);
});


// モジュールのエクスポート
module.exports = router;
