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
// router.js 内で利用する変数を定義する
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
var classifiers = [];  // NLC クラシファイのリスト
var classifiers_status = [];  // NLC クラシファイのリストにステータスを追加
var pre_classify_params;  // pre_classifierのパラメータ
var final_classify_params; // final_classifierのパラメータ
var services;  // Bluemixサービスの定義を格納
var answerstore_name;  // アンサーストア名を定義
var answerstore_data = [];  // アンサーストアのデータを格納
var defaultArray = [];  // アンサーストア内のデフォルトアンサーを格納
var classifierThresholdValue;  // 確信度のしきい値を格納



var router = express.Router();  // create a new express server


var comFunc = require('../common/commonFunctions.js');
var nlClassifier = comFunc.nlClassifierSetting();
var settingJson = comFunc.readSettings();  // classifierSettings.json のデータを格納

// 現在時刻の取得
var dt    = new Date();
dt.setTime(dt.getTime() + 32400000); // 日本時間   1000 * 60 * 60 * 9(hour)
// 日付を数字として取り出す
var year  = dt.getFullYear();
var month = dt.getMonth()+1; if (month < 10) {month = '0' + month;}
var day   = dt.getDate(); if (day   < 10) {day   = '0' + day;}
var hour  = dt.getHours(); if (hour   < 10) {hour  = '0' + hour;}
var min   = dt.getMinutes(); if (min   < 10) {min   = '0' + min;}

var time_now = hour + min;
console.log('now:' + time_now);


/*****************************************************************************
/manage/api/v1/getFeedback API Definition
*****************************************************************************/
// フィードバックストアを作成するAPI
router.post('/manage/api/v1/createFeedbackstore', function(req, res, next) {

  //feedback popupを使用する場合、下記を使用する
var sql_feedback = "CREATE TABLE LOGGING_TABLE (CONVERSATIONID VARCHAR(64),CLIENTID VARCHAR(100),XREF_ID VARCHAR(80),USERID VARCHAR(100),IPADDRESS VARCHAR(50),MESSAGEID INT,ANSWER_NUM INT,TEXT VARCHAR(1024),CLASS VARCHAR(512),ANSWER VARCHAR(10240),CONFIDENCE DECFLOAT,FEEDBACK VARCHAR(128),EXPECTED_ANSWER VARCHAR(512),COMMENT VARCHAR(4096),INSERTION_TIME TIMESTAMP,LAST_UPDATE_TIME TIMESTAMP) ORGANIZE BY ROW;"
  comFunc.executeSQL(sql_feedback, function(err, sqldata) {
    if (err) res.json("フィードバックストアは作成済みです")
    else  {
      res.json("フィードバックストアとコメントストアが作成されました");
    }
  });
});

/*****************************************************************************
/manage/api/v1/dspFeedback API Definition
*****************************************************************************/
// フィードバックストアのデータを表示するためのAPI
// 出力ファイルのパスを応答する。
router.post('/manage/api/v1/dspFeedback', function(req, res, next) {

   //フィードバックテーブルの構造変更にあわせて修正 @ 2016/09
   var sql_feedback = "SELECT CONVERSATIONID,IPADDRESS,USERID,ANSWER_NUM,TEXT,CLASS,ANSWER,CONFIDENCE,FEEDBACK,EXPECTED_ANSWER,COMMENT,INSERTION_TIME FROM LOGGING_TABLE" ;
    //feedback popupを使用する場合、下記を使用する
    if(req.body.feedback_all == 'true'){
    	sql_feedback += " WHERE (FEEDBACK != 65535 OR FEEDBACK IS NULL) "
    }else{
    	sql_feedback += " WHERE (FEEDBACK != 0 AND FEEDBACK IS NOT NULL) AND FEEDBACK != 9";
    	sql_feedback += (req.body.feedback_good == 'true') ? '' : " AND FEEDBACK != 1";
    	sql_feedback += (req.body.feedback_bad == 'true') ? '' : " AND FEEDBACK != -1";
    }
    sql_feedback += (req.body.dtp_from == '') ? '' : " AND INSERTION_TIME >= '" + req.body.dtp_from +"'";
    sql_feedback += (req.body.dtp_to == '') ? '' : " AND INSERTION_TIME <= '" + req.body.dtp_to +"'";
    sql_feedback += " order by INSERTION_TIME";

  comFunc.executeSQL(sql_feedback, function(err, sqldata) {
    if (err) return next(err);
    try {
      res.json(sqldata);
    } catch (err) { return next(err); }
  });
});

/*****************************************************************************
/manage/api/v1/downloadFeedback API Definition
*****************************************************************************/
// フィードバックストアのデータをダウンロードするためのAPI
router.post('/manage/api/v1/downloadFeedback', function(req, res, next) {

  var output_file = 'downloads/f' + Math.random().toString(36).slice(-15) + '_output.csv';   // 出力ファイルのパス
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream('public/'+output_file)); // CSV Writerの定義
  //フィードバックテーブルの構造変更にあわせて修正 @ 2016/09
  var sql_feedback = "SELECT CONVERSATIONID,CLIENTID,XREF_ID,USERID,IPADDRESS,MESSAGEID,ANSWER_NUM,TEXT,CLASS,ANSWER,CONFIDENCE,FEEDBACK,EXPECTED_ANSWER,COMMENT,INSERTION_TIME,LAST_UPDATE_TIME FROM LOGGING_TABLE" ;
  //feedback popupを使用する場合、下記を使用する
  if(req.body.feedback_all == 'true'){
    	sql_feedback += " WHERE (FEEDBACK != 65535 OR FEEDBACK IS NULL) "
  }else{
    	sql_feedback += " WHERE (FEEDBACK != 0 AND FEEDBACK IS NOT NULL) AND FEEDBACK != 9";
    	sql_feedback += (req.body.feedback_good == 'true') ? '' : " AND FEEDBACK != 1";
    	sql_feedback += (req.body.feedback_bad == 'true') ? '' : " AND FEEDBACK != -1";
  }
  sql_feedback += (req.body.dtp_from == '') ? '' : " AND INSERTION_TIME >= '" + req.body.dtp_from +"'";
  sql_feedback += (req.body.dtp_to == '') ? '' : " AND INSERTION_TIME <= '" + req.body.dtp_to +"'";
  sql_feedback += " order by INSERTION_TIME";
  // ya-csv writer error handling
  writer.addListener('error', function (err) {
    console.log('/manage/api/v1/downloadFeedback Error : ' + output_file);
    return next(err);
  });

  comFunc.executeSQL(sql_feedback, function(err, sqldata) {
    if (err) console.log(err);
    for (var i=0;i<sqldata.length;i++) {
    //feedback popupを使用する場合、下記を使用する
    var csvresult = [sqldata[i].CONVERSATIONID, sqldata[i].CLIENTID, sqldata[i].XREF_ID, sqldata[i].USERID, sqldata[i].IPADDRESS, sqldata[i].MESSAGEID, sqldata[i].ANSWER_NUM, sqldata[i].TEXT, sqldata[i].CLASS, sqldata[i].ANSWER, sqldata[i].CONFIDENCE, sqldata[i].FEEDBACK, sqldata[i].EXPECTED_ANSWER, sqldata[i].COMMENT, sqldata[i].INSERTION_TIME, sqldata[i].LAST_UPDATE_TIME];
      writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
    }
    try {
      res.send('/' + output_file);
      // res.send('../' + output_file);
    } catch (err) { return next(err); }
    setTimeout(function(){
      fs.unlink('public/'+output_file, function (err) {  // テンポラリーで作成した出力ファイルを削除する。
        if (err) return next(err);
        console.log('/manage/api/v1/downloadFeedback successfully deleted ' + output_file);
      });
    }, 10000);
  });
});

/*****************************************************************************
/manage/api/v1/deleteFeedback API Definition
*****************************************************************************/
// フィードバックストアのデータを削除する。
router.post('/manage/api/v1/deleteFeedback', function(req, res, next) {

  if(req.body.dtp_from == '' & req.body.dtp_to == '')  res.json("日付の指定は必須です。");
  else {

    var sql_feedback = "DELETE FROM LOGGING_TABLE" ;
    //feedback popupを使用する場合、下記を使用する
    if(req.body.feedback_all == 'true'){
    	sql_feedback += " WHERE (FEEDBACK != 65535 OR FEEDBACK IS NULL) "
    }else{
    	sql_feedback += " WHERE (FEEDBACK != 0 AND FEEDBACK IS NOT NULL) AND FEEDBACK != 9";
    	sql_feedback += (req.body.feedback_good == 'true') ? '' : " AND FEEDBACK != 1";
    	sql_feedback += (req.body.feedback_bad == 'true') ? '' : " AND FEEDBACK != -1";
    }
    sql_feedback += (req.body.dtp_from == '') ? '' : " AND INSERTION_TIME >= '" + req.body.dtp_from +"'";
    sql_feedback += (req.body.dtp_to == '') ? '' : " AND INSERTION_TIME <= '" + req.body.dtp_to +"'";

    comFunc.executeSQL(sql_feedback, function(err, sqldata) {
      if (err) return next(err);
      else  res.json("フィードバックストアのデータが削除されました");
    });

  };
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
