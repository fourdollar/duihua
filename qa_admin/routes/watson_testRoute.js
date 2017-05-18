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
var settingJson ={};  // classifierSettings.json のデータを格納

var router = express.Router();  // create a new express server


var comFunc = require('../common/commonFunctions.js');
var nlClassifiers = comFunc.nlClassifierSetting();
var nlClassifier = nlClassifiers[0];

function setClassifiers(){
  if(typeof classifiers.classifier_id === "undefined" ){
    var tmp = comFunc.classifiers_getParams(function(err,tmp){
      classifiers = tmp.classifiers;
      pre_classify_params = tmp.pre_classify_params;
      final_classify_params = tmp.final_classify_params;
    });
  };
};
setClassifiers();

/*****************************************************************************
/manage/api/v1/downloadNlctest API Definition
*****************************************************************************/
// NLC のテスト結果をダウンロードする。
router.post('/manage/api/v1/downloadNlctest', upload.single('csv'), function (req, res, next) {
  var select_classifier_id = req.body.select_classifier_id;  // NLC クラシファイを指定
  var reqPath = req.file.path;  // 入力ファイルのパス
  var output_file = 'downloads/n' + Math.random().toString(36).slice(-15) + '_output.csv';  // 出力ファイルのパス
  var reader = csv.createCsvFileReader(reqPath, {});  // CSV Readerの定義
  var i = 0;
  var j = 0;
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream('public/'+output_file));  // CSV Writerの定義

  // ya-csv writer error handling
  writer.addListener('error', function (err) {
    console.log('/manage/api/v1/downloadNlctest Error : ' + output_file);
    return next(err);
  });

  // ya-csv reader error handling
  reader.addListener('error', function (err) {
    console.log('/manage/api/v1/downloadNlctest Error : ' + req.file.path);
    return next(err);
  });

  reader.addListener('data', function (data) {
    var test_classify_params = {
      "classifier" : select_classifier_id, // preclassify_class
      "text" : data[0]
    };
    nlClassifier.classify(test_classify_params, function(err, test_classify_results) {
      if (err) return next(err);
      var csvresult;
      if (test_classify_results.classes.length > 1) {
        csvresult = [j, data[0], data[1],  test_classify_results.classes[0].class_name,"" , test_classify_results.classes[0].confidence,test_classify_results.classes[1].class_name,"" , test_classify_results.classes[1].confidence,test_classify_results.classes[2].class_name,"" , test_classify_results.classes[2].confidence]; //NLC Classify
      } else {
        csvresult = [j, data[0], data[1],  test_classify_results.classes[0].class_name,"" , test_classify_results.classes[0].confidence];
      }
      writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
      j++;
      if (i == j) { // 非同期処理が全て完了したら
        setTimeout(function(){
          fs.unlink(reqPath, function (err) { // テンポラリーで作成した入力ファイルを削除する。
            if (err) return next(err);
            console.log('/manage/api/v1/downloadNlctest successfully deleted ' + reqPath);
          });
          try {
            res.send('/' + output_file);
          } catch (err) { return next(err); }
          setTimeout(function(){
            fs.unlink('public/'+output_file, function (err) { // テンポラリーで作成した出力ファイルを削除する。
              if (err) return next(err);
              console.log('/manage/api/v1/downloadNlctest successfully deleted ' + output_file);
            });
          }, 1000);
        }, 1000);
      }
    });
    i++;
  });
});

/*****************************************************************************
/manage/api/v1/dspNlctest API Definition
*****************************************************************************/
// NLC のテスト結果を表示する。
router.post('/manage/api/v1/dspNlctest', upload.single('csv'), function (req, res, next) {
  var select_classifier_id = req.body.select_classifier_id;  // NLC クラシファイを指定
  var reqPath = req.file.path;  // 入力ファイルのパス
  var output_file = 'downloads/' + Math.random().toString(36).slice(-16) + '_output.csv';  // 出力ファイルのパス
  var reader = csv.createCsvFileReader(reqPath, {});  // CSV Readerの定義
  var i = 0;
  var j = 0;
  var jsonresult = [];  // JSONの出力結果を作成

  // ya-csv reader error handling
  reader.addListener('error', function (err) {
    console.log('/manage/api/v1/dspNlctest Error : ' + req.file.path);
    return next(err);
  });

  reader.addListener('data', function (data) {
    var test_classify_params = {
      "classifier" : select_classifier_id, // preclassify_class
      "text" : data[0]
    };
    nlClassifier.classify(test_classify_params, function(err, test_classify_results) {
      if (err) return next(err);
      jsonresult.push({
        "num": j,
        "question": data[0],
        "desired class": data[1],
        "returened class": test_classify_results.classes[0].class_name,
        "returned text": "" ,
        "returned confidence": test_classify_results.classes[0].confidence
      });
      j++;
      if (i == j) { // 非同期処理が全て完了したら
        setTimeout(function(){
          fs.unlink(reqPath, function (err) { // テンポラリーで作成した入力ファイルを削除する。
            if (err) return next(err);
            console.log('/manage/api/v1/dspNlctest successfully deleted ' + req.file.path);
          });
          try {
            res.json(jsonresult);
          } catch (err) { return next(err); }
        }, 1000);
      }
    });
    i++;
  });
});

/*****************************************************************************
/manage/api/v1/downloadQAtest API Definition
*****************************************************************************/
// QAテストの結果をダウンロードするAPI
router.post('/manage/api/v1/downloadQAtest', upload.single('csv'), function (req, res, next) {
  var reqPath = req.file.path;  // 入力ファイルのパス
  var output_file = 'downloads/' + Math.random().toString(36).slice(-16) + '_output.csv';   // 出力ファイルのパス
  var reader = csv.createCsvFileReader(reqPath, {});  // CSV Readerの定義
  var i = 0;
  var j = 0;
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream('public/'+output_file)); // CSV Writerの定義

  // ya-csv writer error handling
  writer.addListener('error', function (err) {
    console.log('/manage/api/v1/downloadQAtest Error : ' + output_file);
    return next(err);
  });

  // ya-csv reader error handling
  reader.addListener('error', function (err) {
    console.log('/manage/api/v1/downloadQAtest Error : ' + req.file.path);
    return next(err);
  });

  reader.addListener('data', function (data) {
    var param = {
      "output_num" : 2,
      "session_id" : 0,
      "client_id" : 'qa_test',
      "chat_num" : 0,
      "setting_multi_answer" : 1,
      "text" : data[0]
    }

    comFunc.watsonquestion(param, function(err, watson_response) {
      if (err) return next(err);
      var csvresult;
      if(watson_response.answers.length > 1) {
        csvresult = [j, data[0], data[1],  watson_response.answers[0].class,watson_response.answers[0].answer , watson_response.answers[0].confidence, watson_response.answers[1].class,watson_response.answers[1].answer , watson_response.answers[1].confidence, watson_response.answers[2].class,watson_response.answers[2].answer , watson_response.answers[2].confidence];
      } else {
        csvresult = [j, data[0], data[1],  watson_response.answers[0].class,watson_response.answers[0].answer , watson_response.answers[0].confidence];
      }
      //console.log(csvresult);
      writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
      j++;
      if (i == j) { // 非同期処理が全て完了したら
        setTimeout(function(){
          fs.unlink(reqPath, function (err) { // テンポラリーで作成した入力ファイルを削除する。
            if (err) return next(err);
            console.log('/manage/api/v1/downloadQAtest successfully deleted ' + reqPath);
          });
          try {
            res.send('/' + output_file);
          } catch (err) { return next(err); }
          setTimeout(function(){
            fs.unlink('public/'+output_file, function (err) { // テンポラリーで作成した出力ファイルを削除する。
              if (err) return next(err);
              console.log('/manage/api/v1/downloadQAtest successfully deleted ' + output_file);
            });
          }, 1000);
        }, 1000);
      }
    });
    i++;
  });
});

/*****************************************************************************
/manage/api/v1/dspQAtest API Definition
*****************************************************************************/
// QAテストの結果を表示するAPI
router.post('/manage/api/v1/dspQAtest', upload.single('csv'), function (req, res, next) {
  var reqPath = req.file.path;  // 入力ファイルのパス
  var output_file = 'downloads/b' + Math.random().toString(36).slice(-15) + '_output.csv';   // 出力ファイルのパス
  var reader = csv.createCsvFileReader(reqPath, {});  // CSV Readerの定義
  var i = 0;
  var j = 0;
  var jsonresult = [];  // JSONの出力結果を作成

  // ya-csv reader error handling
  reader.addListener('error', function (err) {
    console.log('/manage/api/v1/dspQAtest Error : ' + req.file.path);
    return next(err);
  });

  // ya-csv reader listener setting
  reader.addListener('data', function (data) {
    var param = {
      "output_num" : 1,
      "session_id" : 0,
      "client_id" : 'qa_test',
      "chat_num" : 0,
      "setting_multi_answer" : 1,
      "text" : data[0]
    }

    comFunc.watsonquestion(param, function(err, watson_response) {
      if (err) return next(err);
      jsonresult.push({
        "num": j,
        "question": data[0],
        "desired class": data[1],
        "returned class" : watson_response.answers[0].class,
        "answer" : watson_response.answers[0].answer,
        "confidence" : watson_response.answers[0].confidence
      });

      j++;
      if (i == j) { // 非同期処理が全て完了したら
        setTimeout(function(){
          fs.unlink(reqPath, function (err) { // テンポラリーで作成した入力ファイルを削除する。
            if (err) return next(err);
            console.log('/manage/api/v1/dspQAtest successfully deleted ' + req.file.path);
          });
          try {
            res.json(jsonresult);
          } catch (err) { return next(err); }
        }, 1000);
      }
    });
    i++;
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
