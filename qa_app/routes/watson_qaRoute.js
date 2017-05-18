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
var credentials_TTS;  // TTS のクレデンシャル
var classifiers = [];  // NLC クラシファイのリスト
var classifiers_status = [];  // NLC クラシファイのリストにステータスを追加
var pre_classify_params;  // pre_classifierのパラメータ
var final_classify_params; // final_classifierのパラメータ
var services;  // Bluemixサービスの定義を格納
var answerstore_name;  // アンサーストア名を定義
var answerstore_data = [];  // アンサーストアのデータを格納
var defaultArray = [];  // アンサーストア内のデフォルトアンサーを格納
var classifierThresholdValue;  // 確信度のしきい値を格納
var settingJson ={};  // classifierSettings.json のデータを格納
var ibmdb = require('ibm_db');
var router = express.Router();  // create a new express server
var comFunc = require('../common/commonFunctions.js');
var nlClassifier = comFunc.nlClassifierSetting();
var constr ;

var credentials_TTS = comFunc.settingCredentials_TTS();
console.log("credentials_TTS:");
console.log(credentials_TTS);
var textToSpeech = watson.text_to_speech(credentials_TTS);

router.get('/api/synthesize', function(req, res, next) {
  var transcript = textToSpeech.synthesize(req.query);
  transcript.on('response', function(response) {
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    };
  });
  transcript.on('error', function(error) {
    next(error);
  });
  transcript.pipe(res);
});

constr = comFunc.constrSetting();

function readSettings() {
  if (typeof settingJson.answerstore_name === "undefined"  ||  typeof settingJson.classifierThresholdValue === "undefined"  ){
    settingJson = comFunc.readSettings();
    classifierThresholdValue = settingJson.classifierThresholdValue;
    answerstore_name = settingJson.answerstore_name ;
  };
};
readSettings();

/*****************************************************************************
/api/v1/question API Definition
*****************************************************************************/
// アプリに質問し、回答を返すAPI
// Responses are json
router.post('/api/v1/question', function(req, res, next) {
  comFunc.watsonquestion(req.body, function(err, watson_response) {
    if (err) return next(err);
    if (process.env.DEBUG == '1') console.log(watson_response);
    try {
      res.json(watson_response);
    } catch (err) {
      console.log(err);
      return next(err);
    };

    // Input Q&A log to feedback DB (LOGS)
    for (var i = 0; i < Math.min(watson_response.answers.length, watson_response.setting_multi_answer); i++) {
      var j = i + 1;
      var xrefid = 'XREF_' + watson_response.client_id + '_' + watson_response.session_id + '_' + watson_response.chat_num + '_' + j;
      var userid = (req.user !== undefined) ? req.user : "";

      var sql_feedback = "INSERT INTO LOGGING_TABLE (CONVERSATIONID, CLIENTID, XREF_ID, USERID, IPADDRESS, MESSAGEID, ANSWER_NUM, LAST_UPDATE_TIME, TEXT, CLASS, ANSWER, CONFIDENCE,INSERTION_TIME) VALUES('" ;
      sql_feedback += watson_response.session_id + "','" +
      watson_response.client_id + "','" +
      xrefid + "','" +
      userid + "','" +
      req.ip + "','" +
      watson_response.chat_num + "','" +
      j +
      //  "',(current timestamp), null , '" +
      "',(current timestamp + 9 hour), '" +
      watson_response.text + "','" +
      watson_response.answers[i].class + "','" +
      watson_response.answers[i].answer +  "','" +
      watson_response.answers[i].confidence + "'," +
      "(current timestamp + 9 hour))";
      console.log("sql_feedback="+sql_feedback);
      comFunc.executeSQL(sql_feedback, function(err, sqldata) {
        if (process.env.DEBUG == '1') console.log('SQL: ' + sql_feedback);
        if (process.env.DEBUG == '1') console.log(sqldata);
        if (err) console.log(err);
      });
    };
  });
});

/*****************************************************************************
/api/v1/dspAnswerstore API Definition
*****************************************************************************/
// アンサーストアのデータを表示するAPI(ユーザー向けPopup用)
router.post('/api/v1/dspAnswerstore', function(req, res, next) {
  readSettings();
  var sql = "SELECT CLASS,TITLE,ANSWER FROM "+answerstore_name+" WHERE CLASS NOT LIKE 'default%' ";

  comFunc.executeSQL(sql, function(err, sqldata) {
    if (err) return next(err);
    try {
      res.json(sqldata);
    } catch (err) { return next(err); };
  });
});


/*****************************************************************************
/api/v1/feedback API Definition
*****************************************************************************/
// フィードバックを登録するAPI
// Responses are json
router.post('/api/v1/feedback', function(req, res, next) {
  if (process.env.DEBUG == '1') console.log('/api/v1/feedback');
  var watson_response = req.body;
  if (process.env.DEBUG == '1') console.log(watson_response);

  var sql_feedback = "UPDATE LOGGING_TABLE SET LAST_UPDATE_TIME=(current timestamp + 9 hour),   FEEDBACK='" +
  watson_response.feedback + "',EXPECTED_ANSWER='" +
  watson_response.expected_answer + "', COMMENT='" +
  watson_response.comment + "' WHERE CONVERSATIONID='" +
  watson_response.session_id + "' AND CLIENTID='" +
  watson_response.client_id + "' AND MESSAGEID='" +
  watson_response.chat_num + "' AND ANSWER_NUM='"+
  watson_response.answer_num+"'";
  if (process.env.DEBUG == '1') console.log('SQL: ' + sql_feedback);
  comFunc.executeSQL(sql_feedback, function(err, sqldata) {
    if (process.env.DEBUG == '1') console.log(sqldata);
    if (err) console.log(err);
    try {
      if (process.env.DEBUG == '1') console.log(watson_response);
      res.json(watson_response);
    } catch (err) {
      return next(err);
    };
  });
});


/*****************************************************************************
 /api/v1/ipcheck API Definition
 *****************************************************************************/
// クライアントipアドレスのアクセス可否を回答を返すAPI
// Responses are json
router.post('/api/v1/ipCheck', function(req, res, next) {
  var originalIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log("original_Ip:" + originalIp);
  var ip = originalIp.split(","); //取得したIPを,で分割する (xxx.xxx.xxx.xxx, yyy.yyy.yyy.yyy -> xxx.xxx.xxx.xxx)
  console.log("ip:" + ip[0]);
/* IPアドレスのチェックを行う場合の処理始まり
  var ipSplit = ip[0].split("."); //取得したIPを.で分割する
  var ipTmp = ""; //比較するIPをセットする変数
  //ipArrayで何番のオクテットまで指定されているかをチェックする
  var ipArraySplit= ipArray[0].split(".");
  if (ipArraySplit[0] != null && ipArraySplit[1] != null
      && ipArraySplit[2] != null && ipArraySplit[3] != null){
    //第1オクテットから第4オクテットまで指定された場合
    ipTmp =   ipSplit[0]+'.'+ipSplit[1] +'.'+ipSplit[2] +'.'+ipSplit[3];
  }
  else if  (ipArraySplit[0] != null && ipArraySplit[1] != null
      && ipArraySplit[2] != null && ipArraySplit[3] == null){
    //第1オクテットから第3オクテットまで指定された場合
    ipTmp =   ipSplit[0]+'.'+ipSplit[1] +'.'+ipSplit[2];
  }
  else if  (ipArraySplit[0] != null && ipArraySplit[1] != null
      && ipArraySplit[2] == null && ipArraySplit[3] == null){
    //第1オクテットから第2オクテットまで指定された場合
    ipTmp =   ipSplit[0]+'.'+ipSplit[1]
  }
  else if  (ipArraySplit[0] != null && ipArraySplit[1] == null
      && ipArraySplit[2] == null && ipArraySplit[3] == null){
    //第1オクテットまで指定された場合
    ipTmp =   ipSplit[0]
  }
  console.log("IP Adress(ipTmp) ：" + ipTmp );
  //  ipArrayに存在しない場合、不正アクセスとみなす
  if(ipArray.indexOf(ipTmp) < 0) {
    console.log('不正なipからのアクセス');
    var watson_response = {  // Response 用変数
      "isValidate" : "false",
      "ip" : originalIp
    };
    res.json(watson_response);
  }
  else{
    var watson_response = {  // Response 用変数
      "isValidate" : "true",
      "ip" : originalIp
    };
    res.json(watson_response);
  }
IPアドレスのチェックを行う場合の処理終わり */

/* IPアドレスのチェックを行わずに、IPアドレスの取得のみ行う場合の処理 */
  var watson_response = {  // Response 用変数
    "isValidate" : "true",
    "ip" : originalIp
  };
  res.json(watson_response);
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
