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
var classifiers = [];  // NLC クラシファイのリスト
var classifiers_status = [];  // NLC クラシファイのリストにステータスを追加
var pre_classify_params;  // pre_classifierのパラメータ
var final_classify_params; // final_classifierのパラメータ
var services;  // Bluemixサービスの定義を格納
var answerstore_name;  // アンサーストア名を定義
var answerstore_data = [];  // アンサーストアのデータを格納
var defaultArray = [];  // アンサーストア内のデフォルトアンサーを格納
var classifierThresholdValue;  // 確信度のしきい値を格納
//var settingJson ={};  // classifierSettings.json のデータを格納
var ibmdb = require('ibm_db');
var router = express.Router();  // create a new express server
var comFunc = require('../common/commonFunctions.js');

var constr = comFunc.constrSetting();

var settingJson = {};

function readSettings() {
  if (typeof settingJson.answerstore_name === "undefined"  ||  typeof settingJson.classifierThresholdValue === "undefined"  ){
    settingJson = comFunc.readSettings();
    //classifierThresholdValue = settingJson.classifierThresholdValue;
    answerstore_name = settingJson.answerstore_name ;
  };
};
readSettings();

/*****************************************************************************
/manage/api/v1/createAnswerstore API Definition
*****************************************************************************/
// アンサーストアを作成するAPI
router.post('/manage/api/v1/createAnswerstore', function(req, res, next) {
  readSettings();

  var sql_delete = 'DROP TABLE ' + answerstore_name;
  //var sql_create = 'CREATE TABLE ' + answerstore_name + '(CLASS VARCHAR(512), TITLE VARCHAR(1000), TEXT VARCHAR(30000), TEXT4SPEECH VARCHAR(30000))';
  var sql_create = 'CREATE TABLE ' + answerstore_name + '(CLASS VARCHAR(512), TITLE VARCHAR(1000), ANSWER VARCHAR(30000), TEXT4SPEECH VARCHAR(30000))';

  comFunc.executeSQL(sql_delete, function(err, sqldata) {
    if (err) console.log(err);
    comFunc.executeSQL(sql_create, function(err2, sqldata) {
      if (err2) return next(err2);
      else res.json("アンサーストアは正常に作成されました"); //Sends a JSON response composed of a stringified version of data
    });
  });
});

/*****************************************************************************
/manage/api/v1/uploadAnswerstore API Definition
*****************************************************************************/
// アンサーストアのデータを登録するAPI
router.post('/manage/api/v1/uploadAnswerstore', upload.single('csv'), function(req, res, next) {
  readSettings();

  var reqPath = req.file.path;  // 入力ファイルのパス
  var reader = csv.createCsvFileReader(req.file.path, {});  // CSV Readerの定義
  var sqlError;
  var i = 0;
  var j = 0;

  var conn = ibmdb.openSync(constr);
  console.log("start connecting...");
  //begin transaction
  conn.beginTransaction(function(err){
    if (err) {
      next(err);
      return conn.closeSync();
    }
    // ya-csv reader error handling
    reader.addListener('error', function (err) {
      console.log('/manage/api/v1/uploadAnswerstore Error : ' + req.file.path);
      return next(err);
    });

    reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
      try {
        //var result = conn.querySync("INSERT INTO " + answerstore_name + "(CLASS,TITLE,TEXT,TEXT4SPEECH) VALUES('" + data[0] + "','" + data[1] + "','" + data[2] + "','" + data[3] + "')");
        var result = conn.querySync("INSERT INTO " + answerstore_name + "(CLASS,TITLE,ANSWER,TEXT4SPEECH) VALUES('" + data[0] + "','" + data[1] + "','" + data[2] + "','" + data[3] + "')");
      } catch (e) {
        sqlError = e;
        console.log(sqlError.message);
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
            setTimeout(function(){
            fs.unlink(reqPath, function (err) { // テンポラリーで作成した入力ファイルを削除する。
              if (err) return next(err);
              console.log('/manage/api/v1/uploadAnswerstore successfully deleted ' + reqPath);
            });
            comFunc.answerstore_getlist()
            if (sqlError) next(sqlError);
            else res.json("アンサーストアデータを登録しました");
          }, 1000);
        }
      });
      i++;
    });
  });
});

/*****************************************************************************
/manage/api/v1/dspAnswerstore API Definition
*****************************************************************************/
// アンサーストアのデータを表示するAPI
router.post('/manage/api/v1/dspAnswerstore', function(req, res, next) {
  readSettings();

  var sql = 'SELECT "CLASS","TITLE","ANSWER","TEXT4SPEECH" FROM '+answerstore_name;

  comFunc.executeSQL(sql, function(err, sqldata) {
    if (err) return next(err);
    try {
      res.json(sqldata);
    } catch (err) { return next(err); }
  });
});
// アンサーストアのデータを表示するAPI(ユーザー向けPopup用)
router.post('/api/v1/dspAnswerstore', function(req, res, next) {

  var sql = "SELECT CLASS,TITLE,ANSWER FROM "+answerstore_name+" WHERE CLASS NOT LIKE 'default%' ";

  comFunc.executeSQL(sql, function(err, sqldata) {
    if (err) return next(err);
    try {
      res.json(sqldata);
    } catch (err) { return next(err); }
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
