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
var classifierPotentialValue;  // 下限確信度のしきい値を格納
var settingJson ={};  // classifierSettings.json のデータを格納
var ibmdb = require('ibm_db');
var router = express.Router();  // create a new express server
var comFunc = require('../common/commonFunctions.js');
var constr = comFunc.constrSetting();
var nlClassifiers = comFunc.nlClassifierSetting();
var nlClassifier = nlClassifiers[0];

/*
try {
  fs.statSync(comFunc.datapath + 'testResultSummary.json')
  var testResultSummary = require(comFunc.datapath + 'testResultSummary.json');
  //console.log(comFunc.datapath + 'testResultSummary.json' + "ファイルを読み込みました");
} catch(err) {
  console.log(comFunc.datapath + 'testResultSummary.json' + "ファイルを読み込みませんでした");
}


try {
  fs.statSync('./routes/watson_learningOptimizationRoute.js')
  var learningOptimizationRoute = require('./watson_learningOptimizationRoute.js');
  //  console.log('./routes/watson_learningOptimizationRoute.js' + "ファイルを読み込みました");
} catch(err) {
  console.log('./routes/watson_learningOptimizationRoute.js' + "ファイルを読み込みませんでした");
}


try {
  fs.statSync('./learningOptimizationSettings.json')
  var learningOptimizationSettings = require('../learningOptimizationSettings.json');
  //  console.log('../learningOptimizationSettings.json' + "ファイルを読み込みました");
} catch(err) {
  console.log('../learningOptimizationSettings.json' + "ファイルを読み込みませんでした");
}
*/


//var cosntr = comFunc.constrSetting();

function readSettings() {
  if (typeof settingJson.answerstore_name === "undefined"  ||  typeof settingJson.classifierThresholdValue === "undefined"  ){
    settingJson = comFunc.readSettings();
    //classifierThresholdValue = settingJson.classifierThresholdValue;
    answerstore_name = settingJson.answerstore_name ;
  };
  var sql_threshold = "SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY = 'confidenceThreshold'";
  comFunc.executeSQL(sql_threshold, function(err, sqldata) {
  classifierThresholdValue = sqldata[0].PROPERTY_VALUE;
  console.log('asdflasdlfkjsdflkjsdfljk' + sqldata[0].PROPERTY_VALUE)
    if(err) console.log(err);
  });
  var sql_potential = "SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY = 'confidencePotentialThreshold'";
  comFunc.executeSQL(sql_potential, function(err, sqldata) {
    classifierPotentialValue = sqldata[0].PROPERTY_VALUE;
    if(err) console.log(err);
  });
};
readSettings();

// NLCのリストを取得
function setClassifiers(callback){
  if (process.env.DEBUG == '1') console.log('setClassifiers:');
  if(typeof classifiers.classifier_id === "undefined" ){
    comFunc.classifiers_getParams(function(err, tmp) {
      classifiers = tmp.classifiers;
      pre_classify_params = tmp.pre_classify_params;
      final_classify_params = tmp.final_classify_params;
      callback();
    });
  }else{
    callback();
  }
};
setClassifiers(function() {
  console.log('First setClassifiers:');
});

/*****************************************************************************
/manage/api/v1/listNlc API Definition
*****************************************************************************/
// NLC クラシファイのリストを表示
// router.post('/manage/api/v1/listNlc', function (req, res, next) {
//
//   var tmp = comFunc.classifiers_getParams()
//   classifiers = tmp.classifiers;
//   pre_classify_params = tmp.pre_classify_params;
//   final_classify_params = tmp.final_classify_params;
//
//   comFunc.classifiers_getlist(function(err){
//     if (err) return next(err);
//     console.log('/manage/api/v1/listNlc api : classifiers')
//     console.log(classifiers);
//     try {
//       res.json(classifiers);
//     } catch (err) { return next(err); }
//
//   });
// });

/*****************************************************************************
/manage/api/v1/listNlc API Definition
*****************************************************************************/
// NLC クラシファイのリストを表示
router.post('/manage/api/v1/listNlc', function (req, res, next) {
  if (process.env.DEBUG == '1') console.log('/manage/api/v1/listNlc:');
  setClassifiers(function() {
    if (process.env.DEBUG == '1') console.log('/manage/api/v1/listNlc api : classifiers')
    if (process.env.DEBUG == '1') console.log(classifiers);
    try {
      res.json(classifiers);
    } catch (err) { return next(err); }
  });
});

/*****************************************************************************
/manage/api/v1/listNlcstatus API Definition
*****************************************************************************/
// NLC クラシファイのリストをステータスつきで表示
router.post('/manage/api/v1/listNlcstatus', function (req, res, next) {
  setClassifiers(function() {
    classifiers_status = [];
    comFunc.classifiers_getlist(function(err){
      if (err) return next(err);
      if (process.env.DEBUG == '1') console.log("対象のクラシファイアーをリストします");
      var statusCount = 0;
      if(classifiers.length == 0){
        try {
          res.json(classifiers_status);
        } catch (err) { return next(err); }
      }else{
        for(var i=0;i<classifiers.length;i++){
          var params={
            classifier_id : classifiers[i].classifier_id
          };
          console.log(nlClassifier);
          nlClassifier.status(params, function(err,result){
            if(err) return next(err);
            classifiers_status.push(result);
            statusCount++;
            if(statusCount==classifiers.length){
              if (process.env.DEBUG == '1') console.log('/manage/api/v1/listNlcstatus api : classifiers_status')
              if (process.env.DEBUG == '1') console.log(classifiers_status);
              try {
                res.json(classifiers_status);
              } catch (err) { return next(err); }
            }
          });
        }
      }
    });
  });
});

/*****************************************************************************
/manage/api/v1/setClassifierThreshold API Definition
*****************************************************************************/
// 確信度のしきい値をセットするAPI
/*router.post('/manage/api/v1/setClassifierThreshold', function (req, res, next) {
classifierThresholdValue = req.body.classifierThresholdValue;
console.log("しきい値を"+classifierThresholdValue+"にセットしました");
res.json("しきい値を"+classifierThresholdValue+"にセットしました");
settingJson.classifierThresholdValue = classifierThresholdValue;
fs.writeFile('./classifierSettings.json', JSON.stringify(settingJson) ,function(err){
if(err) console.log(err);
});
});
*/
router.post('/manage/api/v1/setClassifierThreshold', function (req, res, next) {
  classifierThresholdValue = req.body.classifierThresholdValue;
  classifierPotentialValue = req.body.classifierPotentialValue;
  console.log("しきい値を"+classifierThresholdValue+"にセットしました");
  var sql_threshold = "UPDATE CONFIG_TABLE SET PROPERTY_VALUE = '" + classifierThresholdValue + "' WHERE PROPERTY = 'confidenceThreshold'";
  console.log(sql_threshold);
  comFunc.executeSQL(sql_threshold, function(err, sqldata) {
    console.log('test');
    if(err) console.log(err);
  });
  var sql_potential = "UPDATE CONFIG_TABLE SET PROPERTY_VALUE = '" + classifierPotentialValue + "' WHERE PROPERTY = 'confidencePotentialThreshold'";
  console.log(sql_potential);
  comFunc.executeSQL(sql_potential, function(err, sqldata) {
    console.log('test');
    if(err) console.log(err);
  });

  res.json("しきい値を上限"+classifierThresholdValue+"下限"+classifierPotentialValue+"にセットしました");
});

/*****************************************************************************
/manage/api/v1/showClassifierThreshold API Definition
*****************************************************************************/
// 確信度のしきい値を取得するAPI
router.post('/manage/api/v1/showClassifierThreshold', function (req, res, next) {
  try {
    var getThreshold = {"classifierThresholdValue" : classifierThresholdValue,
    "classifierPotentialValue" : classifierPotentialValue}
    res.json(getThreshold);
  } catch (err) { return next(err); }
});

/*router.post('/manage/api/v1/showClassifierThreshold', function (req, res, next) {
try {
readSettings();
res.json(classifierThresholdValue);
} catch (err) { return next(err); }
});
*/

/*****************************************************************************
/manage/api/v1/createNlc API Definition
*****************************************************************************/
// NLC クラシファイの作成
router.post('/manage/api/v1/createNlc', upload.single('csv'), function (req, res, next) {
  var params = {
    language: req.body.selectLanguage,
    name: req.body.classifierName,
    training_data: fs.createReadStream(req.file.path)
  };

  console.log('complete set params');

  //var upperName = req.body.classifierName.toUpperCase();
  nlClassifier.create(params, function(err, result){
    console.log('nlClassifier.creat start');

    if(err) return next(err);
    if (process.env.DEBUG == '1') console.log('/manage/api/v1/createNlc : result')
    if (process.env.DEBUG == '1') console.log(result);
    if (process.env.DEBUG == '1') console.log("req.file is " + JSON.stringify(req.file));
    var trainDataPath = "uploads/traindata_" + req.body.classifierName + ".csv" ;
    fs.rename(req.file.path , trainDataPath, function(){
      console.log('fs.rename');
      var reqPath = trainDataPath;  // 入力ファイルのパス
      var reader = csv.createCsvFileReader(trainDataPath, {});  // CSV Readerの定義
      var sqlError;
      var i = 0;
      var j = 0;
      //ここにマージ
      var now = new Date();
      now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
      var y = now.getFullYear();
      var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
      var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
      var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
      var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
      var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;
      var created_date_tmp = "'" + y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second+"'";
      //var nlc_name_tmp = "'"+params.name+"'";
      var nlc_name_tmp = params.name;

      console.log('delete SQL start');

      // var delete_data_temp=created_date_tmp+
      var datetime_delete_sql = "DELETE FROM CONFIG_TABLE WHERE PROPERTY ='created_date_"+nlc_name_tmp+"';" ;
      comFunc.executeSQL(datetime_delete_sql , function(err,sqldata){
        if(err) console.log(err);
        //var datetime_insert_sql = "INSERT INTO CONFIG_TABLE (PROPERTY,PROPERTY_VALUE) VALUES ('created_date' , REPLACE(sUBSTR(CURRENT TIMESTAMP + 9 HOURS ,1,19),'.',':' )) ;";
        var datetime_insert_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('created_date_"+nlc_name_tmp+ "',"+created_date_tmp+ ");" ;
        comFunc.executeSQL(datetime_insert_sql, function(err,sqldata){
          if(err) console.log(err);
        });
      });
      //
      var conn = ibmdb.openSync(constr);
      if (process.env.DEBUG == '1') console.log("TRAIN_DATAテーブルへの挿入を開始します。");
      if (process.env.DEBUG == '1') console.log("start connecting...");
      //begin transaction
      conn.beginTransaction(function(err){
        if (err) {
          next(err);
          return conn.closeSync();
        }
        // ya-csv reader error handling
        reader.addListener('error', function (err) {
          if (process.env.DEBUG == '1') console.log('/manage/api/v1/createNlc Error : ' + req.file.path);
          return next(err);
        });

        try {
          var result_delete = conn.querySync("DROP TABLE TRAIN_DATA_" + req.body.classifierName +";" +"SELECT COUNT(*) FROM SYSCAT.TABLES WHERE TABNAME = TRAIN_DATA_" + req.body.classifierName + "; ");
        } catch (e) {
          //sqlError = e;
          console.log(sqlError.message);
        }

        try {
          var result_create = conn.querySync("CREATE TABLE TRAIN_DATA_" + req.body.classifierName + " (DATA_ID VARCHAR(150), TEXT VARCHAR(10240) , CLASS VARCHAR(512)) ;");
        } catch (e) {
          sqlError = e;
          console.log(sqlError.message);
        }

        var num=0;
        reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
          num++;
          var data_id="PRODUCT_TRAIN_DATA_"+num;
          try {
            if (process.env.DEBUG == '1') console.log("INSERT INTO TRAIN_DATA_" + req.body.classifierName +" VALUES('"+data_id + "','"+data[0] + "','" + data[1] + "');");
            var result_insert = conn.querySync("INSERT INTO TRAIN_DATA_" + req.body.classifierName +" VALUES('" +data_id + "','"+ data[0] + "','" + data[1] + "');");

          } catch (e) {
            sqlError = e;
            console.log("SQLERROR;")
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
                if (sqlError)  next(sqlError);
                else{
                  if (process.env.DEBUG == '1') console.log("トレーニングデータの入れ替えが完了しました。");
                  try{
                    res.json("NLC "+req.body.classifierName+"クラスを作成しました");
                  }catch(e){
                    if (process.env.DEBUG == '1') console.log("res,jsonが失敗しました");
                    console.log(e);
                  }
                };
              }, 1000);
            }
          });
          i++;
        });
      });
    });
  });
});

/*****************************************************************************
/manage/api/v1/deleteNlc API Definition
*****************************************************************************/
// NLC クラシファイを削除するAPI
router.post('/manage/api/v1/deleteNlc', function(req, res, next){
  var params = {
  classifier_id : req.body.classifier_id,
  classifier_name:req.body.classifier_name
};
if (process.env.DEBUG == '1') console.log(req.body.classifier_name);
// var upperName = req.body.classifier_name.toUpperCase();
nlClassifier.remove(params,function(err, result){
  if (err) return next(err);
  if (process.env.DEBUG == '1') console.log('/manage/api/v1/deleteNlc : result')
  if (process.env.DEBUG == '1') console.log("delete result:"+JSON.stringify(result));
  var delete_classifiers = classifiers.filter(function(classifier,index){
    if (process.env.DEBUG == '1') console.log(JSON.stringify(classifier));
    if(classifier.name === req.body.classifier_name) return true;
  })
  if (process.env.DEBUG == '1') console.log("削除するクラシファイアーは："+req.body.classifier_name);
  if (process.env.DEBUG == '1') console.log("delete_classifiers:"+delete_classifiers);
  if (process.env.DEBUG == '1') console.log("delete_classifiers_length:"+delete_classifiers.length);
  setClassifiers(function() {
    if(delete_classifiers.length == 1){
      if (process.env.DEBUG == '1') console.log("テーブルを削除します。");
      var train_data_delete_sql = "DELETE FROM CONFIG_TABLE WHERE PROPERTY ='created_date_"+req.body.classifier_name+"';" ;
      try{
        comFunc.executeSQL(train_data_delete_sql, function(err,sqldata){
          if(err) console.log(err);
          var delete_insert_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('created_date_"+req.body.classifier_name+ "',"+created_date_tmp+ ");" ;
          comFunc.executeSQL(delete_insert_sql,function(err,sqldata2){
            if(err) console.log(err);
          })
        });
      }catch(err){
        console.log(err);
      }
    }else if(delete_classifiers.length > 1){
      if (process.env.DEBUG == '1') console.log("クラシファイアーが重複するのでテーブルは削除しません。");
    }else{
      if (process.env.DEBUG == '1') console.log("クラシファイアーが存在しません。");
    }
    try {
      res.json(result);
    } catch (err) { return next(err); }
  });
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
