/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/
//修正した箇所にはbmarkのコメントを挿入
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
//var upload = multer({ dest: 'uploads/' });  // ファイルアップロードの配置場所を定義
var upload = multer({ dest: 'uploads/' });  // ファイルアップロードの配置場所を定義
var csv = require("ya-csv");  // csv 操作用
var credentials_NLC;  // NLC のクレデンシャル
var credentials_DB;  // SQL DB のクレデンシャル

var pre_classify_params;  // pre_classifierのパラメータ
var final_classify_params; // final_classifierのパラメータ
var services;  // Bluemixサービスの定義を格納
var answerstore_name;  // アンサーストア名を定義
var answerstore_data = [];  // アンサーストアのデータを格納
var defaultArray = [];  // アンサーストア内のデフォルトアンサーを格納
var classifierThresholdValue;  // 確信度のしきい値を格納
//var constr;
var ibmdb = require('ibm_db');
var router = express.Router();  // create a new express server
var archive = require('archiver');
var async = require('async');
var comFunc = require('../common/commonFunctions.js');
var constr = comFunc.constrSetting();
//var datapath = __dirname + '/../public/data/';
var learningOptimizationSettings = require('../learningOptimizationSettings.json');
var comFuncLO = require("../common/commonFunctionsLO.js");
var testResultSummary ;//= require(comFuncLO.datapath + 'testResultSummary_default.json'); //psn_mark
var CronJob = require('cron').CronJob;
var debugmode = 'false';
var classifiers = comFuncLO.nlClassifierSetting();  // NLC クラシファイのリスト
var traindata_production = "traindata_"+ learningOptimizationSettings.classifier_name.Production ;
var traindata_autolearn = "traindata_"+ learningOptimizationSettings.classifier_name.AutoLearn ;
var traindata_modified = "traindata_"+ learningOptimizationSettings.classifier_name.Modified ;
//var classifiers_status = [];  // NLC クラシファイのリストにステータスを追加
var retestResult = {
  "result":"-",
  "execDate":"-",
};

var selectedNLC; //選択したClassifier名
var pre_selectedNLC;
/*
router.post('/manage/api/v1/allTraindataTest' , function(req,res,next){
    //step7を実行し、basetrain.csv / newtrain.csv / modifiedtrain.csvの3つをテストする。
    //再テスト
});
*/
//--------------------------psn_mark
router.post('/manage/api/v1/send_selectedNLC', function(req,res){
  var sendData={
    "selectedNLC":selectedNLC
  };
    console.log("選択されたClassifie="+sendData.selectedNLC);
  res.json(sendData);
});

getSelectedNLC(function(){
  //if(err) console.log(err);
  getCreateDate(function(err){
    console.log(selectedNLC);
    console.log("前回定義したNLC名の取り出しに成功いたしました。");
  });
});

//前回定義したNLC名と、前回のバッチ処理終了時に選択していたNLC名をCONFIG_TABLEから取り出す
//配列は[selectedNLC,pre_selectedNLC]と仮定
function getSelectedNLC(callback){
  var selectedNLC_sql="SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY ='selectedNLC';";
  var pre_selectedNLC_sql="SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY ='pre_selectedNLC';";
  comFuncLO.executeSQL(selectedNLC_sql , function(err,sqldata){
    if(err) console.log(err);
    else {
      if(typeof sqldata[0] === 'undefined' ){
        selectedNLC = "";
      }else{
        selectedNLC = sqldata[0].PROPERTY_VALUE;
      }
    }
    comFuncLO.executeSQL(pre_selectedNLC_sql , function(err2,sqldata2){
      if(err2) console.log(err2);
      else {
        if(typeof sqldata2[0] === 'undefined' ){
          pre_selectedNLC = "";
        }else{
          pre_selectedNLC = sqldata2[0].PROPERTY_VALUE;
        }
      }
      console.log("selectedNLC="+selectedNLC);
      console.log("pre_selectedNLC="+pre_selectedNLC);
      fs.readFile(comFuncLO.datapath + 'testResultSummary_default.json',"utf-8" ,function(err3,data3){
        if(err3) console.log(err3);
        console.log("data3:"+data3);
        testResultSummary = JSON.parse(data3);
        console.log("更新しました:"+JSON.stringify(testResultSummary));
        callback();
      });
    });
  });
};
//-----------------------psn_mark

function getCreateDate(callback){
  var created_date_sql = "SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY = 'created_date_"+selectedNLC+"';"; //cmark?
  comFuncLO.executeSQL(created_date_sql , function(err,sqldata){
    if(err) console.log(err);
    else {
      if(typeof sqldata[0] === 'undefined'){
        testResultSummary.result[0].created_date  = "最適化対象のクラシファイアが設定されていません。";
      }else{
        testResultSummary.result[0].created_date = sqldata[0].PROPERTY_VALUE ;
      }
    }
    callback(err);
  });
};


function getAutomaticExecMode(){
  var automatic_exec_mode_sql = "SELECT PROPERTY_VALUE FROM CONFIG_TABLE WHERE PROPERTY = 'automatic'"
  comFuncLO.executeSQL(automatic_exec_mode_sql , function(err, sqldata){
    if(err) console.log(err);
    else {
      if(typeof sqldata[0] === 'undefined'){
        console.log("sqldata[0]がundefinedなので、手動モードに設定します。");
        learningOptimizationSettings.automatic = "false";
      }else {
        learningOptimizationSettings.automatic = sqldata[0].PROPERTY_VALUE ;
      }
    };
  });
};


getAutomaticExecMode();

router.post('/manage/api/v1/downloadTestResult' , function(req,res,next){
  //テストが完了した結果ファイルをダウンロードする。
 //ダウンロードするタイプに応じて処理が若干異なる
 console.log("download req.body.train_type is " + JSON.stringify(req.body.train_type) );
 var FileName;
 var FilePath;
 var num ;
    switch (req.body.train_type){
      case learningOptimizationSettings.classifier_name.Production:
         console.log("本番トレーニング");
       FileName = traindata_production +"_result_"+selectedNLC+".csv"; //cmark
       num = 1;
         break;
      case learningOptimizationSettings.classifier_name.AutoLearn:
         console.log("自動トレーニング");
       FileName = traindata_autolearn +"_result_"+selectedNLC+".csv"; //cmark
         num = 1;
         break;
      case learningOptimizationSettings.classifier_name.Modified:
         console.log("修正トレーニング");
       FileName = traindata_modified +"_result_"+selectedNLC+".csv"; //cmark
       num = 2;
         break;
      default :
       console.log("どのトレーニングにも当てはまりません");
    };
    FilePath = comFuncLO.datapath + FileName;
    console.log("FileName is " + FileName);
    console.log("FilePath is " + FilePath);
    try {
      fs.statSync(FilePath)
      console.log("File exists!");
      res.send("/data/" + FileName);
    } catch (err) {
      console.log("テスト結果が存在しませんでした。");
      //res.json("テスト結果が存在しませんでした。再テストを実行しファイルをします。");
      var nlClassifier = comFuncLO.nlClassifierSetting();
      var old_classifier;
      var finaltestdata_num =[];
      async.series([
        function(async_callback) {
          console.log('=======================================================')
          console.log('FINALTESTDATAのCSVを作成 : ');
          var sql = 'select count(*) as finaltestdata_num from finaltestdata;';
          comFuncLO.executeSQL(sql, function(err, sqldata) {
            if (err) console.log(err);
            else {
              if(debugmode == 'true') console.log('FINALTESTDATA_NUM: ' + sqldata[0].FINALTESTDATA_NUM);
              //finaltestdata_num = sqldata[0].FINALTESTDATA_NUM;
              for (var k = 1; k <= Math.ceil(sqldata[0].FINALTESTDATA_NUM / 200); k++) {
                finaltestdata_num.push(k);
              }
              if(debugmode == 'true') console.log("finaltestdata_num: " + finaltestdata_num);
              async.each(finaltestdata_num, function(data, next) {
                comFuncLO.create_finaltestdata_csv(data, next);
              }, function complete(err) {
                console.log('FINALTESTDATAのCSVを作成 : Finished.');
                async_callback();
              });
            }
          });
        },
        function(async_callback){
          comFuncLO.finaltest_classifier(finaltestdata_num, num, "traindata_" + req.body.train_type, selectedNLC,function(test_result) {
          var train_result = test_result;
          train_result.rate = Math.round((train_result.correct_total/train_result.total)*10000)/100 ;
          if(debugmode == 'true') console.log(customtrain_result);
          console.log('classifier でテスト : Finished.');
          var temp_num= testResultSummary.result[num].num_traindata;
          testResultSummary.result[num] = {
            "classifier_name": req.body.train_type,
            "classifier_id": train_result.classifier_id,
            "num_ans": train_result.total,
            "num_correctAns": train_result.correct_total,
            "rate_correctAns": train_result.rate,
            "num_traindata" : temp_num,
            "status": "完了",
            "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
          };
          fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
          async_callback();
        });
      }],function(err){
        if(err) return next(err);
        console.log("File was created!");
        res.send("/data/" + FileName);
      }
    );
  }
});



router.post('/manage/api/v1/uploadModifiedData' , upload.single('csv'), function(req,res,next){
	//修正データのアップロードから、テストまで実施
	//テスト実施の処理はallTraindataTestと共通なので、共通ファイルに、関数を定義する
  //アップロードした、ファイルはmodifiedData.csvとして保存する

 var FileName = traindata_modified + "_" + selectedNLC + ".csv";
 var FilePath = comFuncLO.datapath + FileName ;

 console.log("req.file is " + JSON.stringify(req.file));
  fs.rename(req.file.path , FilePath , function(){
    //console.log("MOVED!!!!");
 //ページが遷移してしまうのが気になる
      var num_traindata  ; //= comFuncLO.countRecords(FileName);
      var automatic = learningOptimizationSettings.automatic;
      var randgroup_num = learningOptimizationSettings.try_num;  // 1-4 までのグループを作成
      var split_num = learningOptimizationSettings.split_num;    // 1つのグループを3つに分割してフィードバックデータを作成
      var inttestdata_num = [];                                  // 内部テストデータのファイル数
      var finaltestdata_num = [];                                // 最終テストデータのファイル数
      var cycle_group_num = [];                                  // グループ、分割を配列化する
      var NLC_modified = "traindata_" + learningOptimizationSettings.classifier_name.modified;
      for (var i = 1; i <= randgroup_num; i++) {
        for (var j = 1; j <= split_num; j++) {
          cycle_group_num.push({
            cycle: i,
            group: j
          });
        }
      }
      var prodtrain_result;                                      // Production のトレーニングのテスト結果
      var autotrain_result;                                       // 自動トレーニングによるテスト結果
      var customtrain_result;                                    // Custom トレーニングによるテスト結果
      var inttestdata_count;                                     //　内部テストデータ数
      var num_traindata="集計中";
      async.series([

        // Delay を入れる
        function(async_callback) {
          console.log('=======================================================')
          console.log('10秒間Delayする : ');
          setTimeout(function() {
            async_callback();
          }, 10000);
        },

        //既存のclassifier2を削除する
        function(async_callback) {
          console.log('=======================================================')
          console.log('既存のClassifier2を削除 : ');
          comFuncLO.deleteNLC2(function(err) {
            if (err) console.log(err);
            console.log('既存のClassifier2を削除 : Finished.');
            async_callback();
          });
        },

        // Custom classifier を作成する
        function(async_callback) {
          console.log('=======================================================')
          console.log('Modified classifier を作成 : ');
        //  comFuncLO.createClassifier2("traindata_modified", "traindata_modified.csv", function() {})
          comFuncLO.createClassifier2(traindata_modified, FileName, function() { //cmark?
            console.log('Modified classifier を作成 : Finished.');
            //データの件数を集計
            fs.readFile(comFuncLO.datapath + FileName, 'utf8', function(err, data) {
              if(err) {
                console.log(err);
                throw err;
              }
              console.log(data.split('\n').length);
              num_traindata = data.toString().split('\n').length;
              console.log("num_traindata is " + num_traindata);
              testResultSummary.result[2] = {
                "classifier_name": learningOptimizationSettings.classifier_name.Modified,
                "classifier_id": "-",
                "num_ans": "-",
                "num_correctAns": "-",
                "rate_correctAns": "-",
                "num_traindata" : num_traindata,
                "status": "NLC作成完了",
                "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
              };
              fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
              async_callback();
          });
        })
      },

    ],function(err) {
      if (err) {
        console.log("err: " + JSON.stringify(err));
        runLOdata_callback(err, null);
      } else {
        console.log("Classifierの作成終了");
        res.json("NLC作成完了");
        //res.json(testResultSummary);
      }
    });

    });
});

/*bmark

        //classifierがトレーニング完了状態かどうかを確認する
        function(async_callback) {
          console.log('=======================================================')
          console.log('classifierがトレーニング完了状態かどうかを確認 : ');
          comFuncLO.check_and_wait_nlc(2, function() {
            console.log('classifierがトレーニング完了状態かどうかを確認 : Finished.');
            async_callback();
          });
        }]);
});
});
        // FINALTESTDATAのCSVを作成する
        function(async_callback) {
          console.log('=======================================================')
          console.log('FINALTESTDATAのCSVを作成 : ');
          var sql = 'select count(*) as finaltestdata_num from finaltestdata;';
          comFuncLO.executeSQL(sql, function(err, sqldata) {
            if (err) console.log("SQLのエラー：：："+err);
            else {
              console.log("エラーはありませんでした");
              if(debugmode == 'true') console.log('FINALTESTDATA_NUM: ' + sqldata[0].FINALTESTDATA_NUM);
              for (var k = 1; k <= Math.ceil(sqldata[0].FINALTESTDATA_NUM / 200); k++) {
                finaltestdata_num.push(k);
                console.log("pushしています");
              }
              if(debugmode == 'true') console.log("finaltestdata_num: " + finaltestdata_num);
              async.each(finaltestdata_num, function(data, next) {
                comFuncLO.create_finaltestdata_csv(data, next);
              }, function complete(err) {
                console.log('FINALTESTDATAのCSVを作成 : Finished.');
                async_callback();
              });
            }
          });
        },


        // Custom classifier でテストする
        function(async_callback) {
          console.log('=======================================================')
          console.log('Custom classifier でテスト : ');
          testResultSummary.result[2] = {
            "classifier_name": learningOptimizationSettings.classifier_name.Modified,
            "classifier_id": "-",
            "num_ans": "-",
            "num_correctAns": "-",
            "rate_correctAns": "-",
            "num_traindata" : num_traindata,
            "status": "最終テスト中",
            "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
          };
          fs.writeFile(comFuncLO.datapath + 'testResultSummary.json', JSON.stringify(testResultSummary, null, 2));
          comFuncLO.finaltest_classifier(finaltestdata_num, 2, "traindata_modified", function(test_result) {
            customtrain_result = test_result;
            if(debugmode == 'true') console.log(customtrain_result);
            console.log('Custom classifier でテスト : Finished.');
            async_callback();
          });
        },

      ],function(err) {
        if (err) {
          console.log("err: " + JSON.stringify(err));
          runLOdata_callback(err, null);
        } else {
          console.log('=======================================================')
          console.log('テスト結果の作成　testResultSummary.json : ');
          if(debugmode == 'true') console.log("autotrain: " + autotrain_result);
          if(debugmode == 'true') console.log("prodtrain: " + prodtrain_result);

          testResultSummary.result[2] = {
            "classifier_name": learningOptimizationSettings.classifier_name.Modified,
            "classifier_id": customtrain_result.classifier_id,
            "num_ans": customtrain_result.total,
            "num_correctAns": customtrain_result.correct_total,
            "rate_correctAns": Math.round((customtrain_result.correct_total/customtrain_result.total)*10000)/100,
            "num_traindata" : num_traindata,
            "status": "完了",
            "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
          };

          console.log(testResultSummary);
          console.log('output: ' + comFuncLO.datapath + 'testResultSummary.json');
          fs.writeFile(comFuncLO.datapath + 'testResultSummary.json', JSON.stringify(testResultSummary, null, 2));
          console.log('テスト結果の作成　testResultSummary.json : Finished.');
          //runLOdata_forCustom_callback();
        }
      });
  });
});
*/
router.post('/manage/api/v1/updateNlcLOtestSumm' , function(req,res,next){
  //testResultSummary.jsonから、データを取得する
  //ただjsonを読み込んで、返すだけ
  //ファイル名は、testResultSummary.json
  console.log("テスト結果サマリを取得します。");
  try{
    fs.readFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json',"utf-8" ,function(err,data){
      if(err) {console.log(err)
        console.log("ファイルが存在しませんでした。");
        fs.readFile(comFuncLO.datapath + 'testResultSummary_default.json',"utf-8" ,function(err,data22){
          console.log("data22:"+data22);
          testResultSummary = JSON.parse(data22);
          console.log("更新しました:"+JSON.stringify(testResultSummary));
          getCreateDate(function(err){
            if(err) console.log(err);
            else {
              console.log(testResultSummary);
              res.json(testResultSummary);
            }
          });
        });
      }else{
        console.log("data:"+data);
        testResultSummary = JSON.parse(data);
        console.log("更新しました:"+JSON.stringify(testResultSummary));
        getCreateDate(function(err){
          if(err) console.log(err);
          else {
            console.log(testResultSummary);
            res.json(testResultSummary);
          }
        });
      }
    });
  }catch(e){
    console.log(e);
  }
});

router.post('/manage/api/v1/getLOproperty', function(req,res,next){
  if(learningOptimizationSettings) {
    console.log("learningOptimizationSettings:" + learningOptimizationSettings);
  } else {
    console.log("AA-else");
    learningOptimizationSettings = require('./learningOptimizationSettings.json');
    console.log("AA-finish")
  }
  getAutomaticExecMode();

  var learningOptimizationSettings_tmp = learningOptimizationSettings;
  var cronBatchSchedule = learningOptimizationSettings.cronBatchSchedule.split(" ");
  var second = cronBatchSchedule[0];
  var minute = cronBatchSchedule[1];
  var hour = cronBatchSchedule[2];
  var day = cronBatchSchedule[3];
  var month = cronBatchSchedule[4];
  var day_of_the_week = cronBatchSchedule[5];
  var time = hour + ":" + minute + ":" + second;

  learningOptimizationSettings_tmp.cronBatchTime = time;
  learningOptimizationSettings_tmp.cronBatchDay = day;
  learningOptimizationSettings_tmp.cronBatchMonth = month;
  learningOptimizationSettings_tmp.cronBatchDay_of_the_Week = day_of_the_week;
  res.json(learningOptimizationSettings_tmp);
});


router.post('/manage/api/v1/submitProdNlc' , function(req,res,next){
	//本番環境に適用したい学習データを送る ⇒最新版の入れ替え
console.log("submit req.body.train_type is " + JSON.stringify(req.body.train_type) );
  //①旧classifierの削除
  //②新classifierの作成
  //作成が正常に完了したことを受けて以下のメッセージ
  var old_classifier ;
  //var classifier_list ;
  var train_data_file;
  var train_data_path;
  switch (req.body.train_type){
    case learningOptimizationSettings.classifier_name.AutoLearn:
       console.log("自動トレーニング");
     //  FileName = "traindata_" + learningOptimizationSettings.classifier_name.AutoLearn +"_result.csv"
      train_data_file = traindata_autolearn+"_" +selectedNLC+".csv"; //cmark
       break;
    case learningOptimizationSettings.classifier_name.Modified:
       console.log("修正トレーニング");
     //  FileName = "traindata_" + learningOptimizationSettings.classifier_name.Custom +"_result.csv"
      train_data_file = traindata_modified+"_" +selectedNLC+".csv"; //cmark
       break;
    default :
     console.log("トレーニングデータが適切ではありません。");
  };
  train_data_path = comFuncLO.datapath + train_data_file;
  exchangeProductionNLC(train_data_path);
});


router.post('/manage/api/v1/downloadTestData' , function(req,res,next) {
	//最新のテストデータをダウンロードする
	//crtNewTestDataで作成されたファイルをダウンロードしてくる
  var FileName = 'testData.csv';   // 出力ファイルのパス
  //var FileName = traindata_production +"_result.csv";
  var FilePath = comFuncLO.datapath + FileName;
    try {
      fs.statSync(FilePath)
      console.log("File exists!");
      res.send("/data/" + FileName);
    } catch (err) {
      console.log("FileNotExists!")
      var writer = new csv.createCsvStreamWriter(fs.createWriteStream(FilePath)); // CSV Writerの定義
      var sql_feedback = "SELECT * FROM FINALTESTDATA ;";

      writer.addListener('error', function (err) {
        console.log('/manage/api/v1/downloadTestData Error : ' + FilePath);
        return next(err);
      });

      comFuncLO.executeSQL(sql_feedback, function(err, sqldata) {
        if (err) console.log(err);

        async.series([
          function(async_callback){
            for (var i=0;i<sqldata.length;i++) {
              var csvresult = [sqldata[i].TEXT, sqldata[i].CLASS];
              writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
            }
            async_callback();
          },
          function(async_callback){
            try {
              res.send("/data/" + FileName);    //ダウンロード機能
            } catch (err) { return next(err); }
            async_callback();
          }
        ],function(err){
          if(err) console.log(err);
          console.log("処理が完了しました。");
        }
      );

      });
    }
});

router.post('/manage/api/v1/allTraindataRetest',function(req,res,next){
  //classifierがトレーニング完了状態かどうかを確認する
  var finaltestdata_num = [];
  var prodtrain_result ;
  var autotrain_result ;
  var customtrain_result ;
  retestResult = {
    "result":"-",
    "execDate":"-",
  };
  if( selectedNLC == "" || selectedNLC!=pre_selectedNLC){　　　　//psn_mark
  	      // res.json("選択されたNLCはバッチ処理を完了しておりません");
    var mes={
      res:"選択されたNLCはバッチ処理を完了しておりません"
    } //psn_mark
    res.json(mes);
 }else{                                      //psn_mark
  async.series([

  function(async_callback) {
    console.log('=======================================================')
    console.log('classifierがトレーニング完了状態かどうかを確認 : ');
    async.each([1, 2], function(data, next) {
      comFuncLO.check_and_wait_nlc(data, next);
    }, function complete(err) {
      console.log('classifierがトレーニング完了状態かどうかを確認 : Finished.');
      async_callback();
    });
  },



  // FINALTESTDATAのCSVを作成する
  function(async_callback) {
    console.log('=======================================================')
    console.log('FINALTESTDATAのCSVを作成 : ');
    var sql = 'select count(*) as finaltestdata_num from finaltestdata;';
    comFuncLO.executeSQL(sql, function(err, sqldata) {
      if (err) console.log(err);
      else {
        if(debugmode == 'true') console.log('FINALTESTDATA_NUM: ' + sqldata[0].FINALTESTDATA_NUM);
        for (var k = 1; k <= Math.ceil(sqldata[0].FINALTESTDATA_NUM / 200); k++) {
          finaltestdata_num.push(k);
        }
        if(debugmode == 'true') console.log("finaltestdata_num: " + finaltestdata_num);
        async.each(finaltestdata_num, function(data, next) {
          comFuncLO.create_finaltestdata_csv(data, next);
        }, function complete(err) {
          console.log('FINALTESTDATAのCSVを作成 : Finished.');
          async_callback();
        });
        //async_callback();
      }
    });
  },


  // Production classifier でテストする
  function(async_callback) {
    console.log('=======================================================')
    console.log('Production classifier でテスト : ');
    if(testResultSummary.result[0].status == "完了"){
      comFuncLO.finaltest_classifier(finaltestdata_num, 1, traindata_production, selectedNLC,function(test_result) {
        prodtrain_result = test_result;
        if(debugmode == 'true') console.log(prodtrain_result);
        console.log('Production classifier でテスト : Finished.');
        var created_date = testResultSummary.result[0].created_date ;
        testResultSummary.num_feedback = prodtrain_result.total,
        testResultSummary.result[0]={
          "classifier_name": learningOptimizationSettings.classifier_name.Production,
          "classifier_id": prodtrain_result.classifier_id,
          "num_ans": prodtrain_result.total,
          "num_correctAns": prodtrain_result.correct_total,
          "rate_correctAns": Math.round((prodtrain_result.correct_total/prodtrain_result.total)*10000)/100,
          "num_traindata" : testResultSummary.result[0].num_traindata,
          "status": "完了",
          "created_date" : created_date ,
          "remark": "本番に適用した最新のトレーニングデータです。"
        };
        fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
        async_callback();
      });
    }else{
      console.log('Production classifier は未作成のためテストを実施しませんでした。');
      async_callback();
    }
  },

  // Autotrain classifier でテストする
  function(async_callback) {
    if(testResultSummary.result[1].status == "完了"){
      console.log('=======================================================')
      console.log('Autotrain classifier でテスト : ');
      comFuncLO.finaltest_classifier(finaltestdata_num, 1, traindata_autolearn,selectedNLC, function(test_result) {
        autotrain_result = test_result;
        if(debugmode == 'true') console.log(autotrain_result);
        console.log('Autotrain classifier でテスト : Finished.');
        testResultSummary.result[1] = {
          "classifier_name": learningOptimizationSettings.classifier_name.AutoLearn,
          "classifier_id": autotrain_result.classifier_id,
          "num_ans": autotrain_result.total,
          "num_correctAns": autotrain_result.correct_total,
          "rate_correctAns": Math.round((autotrain_result.correct_total/autotrain_result.total)*10000)/100,
          "num_traindata" : testResultSummary.result[1].num_traindata,
          "status": "完了",
          "remark": "初期トレーニングデータに、フィードバック結果から最適なクラスを付与したデータを追加したトレーニングデータです。"
        };
      　fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
        async_callback();
      });
    }else{
      console.log('Autotrain classifier は未作成のためテストを実施しませんでした。');
      async_callback();
    }
  },

  function(async_callback) {
    if(testResultSummary.result[2].status == "完了" || testResultSummary.result[2].status=="NLC作成完了"){　　　//bmark
      console.log('=======================================================')
      console.log('Custom classifier でテスト : ');
      //if(testResultSummary.result[2].num_traindata > 0){
        comFuncLO.finaltest_classifier(finaltestdata_num, 2, traindata_modified, selectedNLC,function(test_result) {
          customtrain_result = test_result;
          customtrain_result.rate = Math.round((customtrain_result.correct_total/customtrain_result.total)*10000)/100 ;
          if(debugmode == 'true') console.log(customtrain_result);
          console.log('Custom classifier でテスト : Finished.');
          testResultSummary.result[2] = {
            "classifier_name": learningOptimizationSettings.classifier_name.Modified,
            "classifier_id": customtrain_result.classifier_id,
            "num_ans": customtrain_result.total,
            "num_correctAns": customtrain_result.correct_total,
            "rate_correctAns": customtrain_result.rate,
            "num_traindata" : testResultSummary.result[2].num_traindata,
            "status": "完了",
            "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
          };
          fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
          async_callback();
        });
    }else{
      console.log('Modifiedtrain classifier は未作成のためテストを実施しませんでした。');
      async_callback();
    }
  },
],function(err) {
  if (err) {
    retestResult.result ="失敗";
    console.log("err: " + JSON.stringify(err));
    //runLOdata_callback(err, null);
  } else {
    console.log('=======================================================')
    console.log('テスト結果の作成　testResultSummary.json : ');
    if(debugmode == 'true') console.log("autotrain: " + autotrain_result);
    if(debugmode == 'true') console.log("prodtrain: " + prodtrain_result);

    var now = new Date();
    now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
    var y = now.getFullYear();
    var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
    var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
    var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
    var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
    var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;
    var created_date_tmp = y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second;
    retestResult.result ="成功";
    retestResult.execDate = created_date_tmp ;
    testResultSummary.execDate = created_date_tmp ;
    console.log(testResultSummary);
    console.log('output: ' + comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json');
    fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
    console.log('テスト結果の作成　testResultSummary.json : Finished.');
   // runLOdata_callback();
   res.json("　再テストが完了しました。");
   console.log("再テスト完了！");
  }
});
};   //else終了
});

router.post('/manage/api/v1/getRetestResult',function(req,res,next){
  console.log(retestResult);
  res.json(retestResult);
})

router.post('/manage/api/v1/uploadTestData' ,  upload.single('csv'), function(req,res,next){
	//テストデータをアップロードする
  console.log("テストデータをアップロードします。");
  console.log("req.file is " + JSON.stringify(req.file));
  var testDataPath = comFuncLO.datapath + "testData.csv"
  fs.rename(req.file.path , testDataPath, function(){
    //console.log("MOVED!!!!");
    comFunc.readSettings();

    var reqPath = testDataPath;  // 入力ファイルのパス
    var reader = csv.createCsvFileReader(testDataPath, {});  // CSV Readerの定義
    var sqlError;
    var i = 0;
    var j = 0;
    var finaltestdata_num = [];
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
      try {
        var result_delete = conn.querySync("DROP TABLE FINALTESTDATA;");
      } catch (e) {
        sqlError = e;
        console.log(sqlError.message);
      }
      try {
        var result_create = conn.querySync("CREATE TABLE FINALTESTDATA (TEXT VARCHAR(10240) , CLASS VARCHAR(512));");
      } catch (e) {
        sqlError = e;
        console.log(sqlError.message);
      }
      reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
        try {
          var result_insert = conn.querySync("INSERT INTO FINALTESTDATA(TEXT,CLASS) VALUES('" + data[0] + "','" + data[1] + "');");
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
                if (sqlError) next(sqlError);
                else res.json("テストデータを登録しました");
              }, 1000);
          }
        });
        i++;
      });
    });
  });
});

/************************************
bmark
api名　/manage/api/v1/listNLCforSelection
classifierの選択リストをクライアント側へ送る
**************************************/
//
// router.post('/manage/api/v1/listNLCforSelection',function(req,res,next){
//   var tmp=comFunc.classifiers_getParams();
//   var classifier_namelist=[];
//   classifiers=tmp.classifiers;
//   async.each(classifiers,function(each_classifier,async_callback){
//     classifier_namelist.push([each_classifier.id,each_classifier.name]);
//   },function(err){
//     if(err) throw err;
//     try {
//       res.json(classifier_namelist);
//     } catch (err) { return next(err); }
//     next();
//   });
// });

/****************************************
bmark
api名　/manage/api/v1/ClassifierInfo
選択されたclassifierをクライアント側から受け取る
*****************************************/
router.post('/manage/api/v1/ClassifierInfo',function(req,res,next){
  selectedNLC=req.body.selectClassifierName; //temporary
  learningOptimizationSettings.Production_classifier_name=selectedNLC;
  console.log(selectedNLC);
  fs.writeFile('learningOptimizationSettings.json',JSON.stringify(learningOptimizationSettings, null,2));
  console.log("Classifierを選択中です");
  var selected_path=comFuncLO.datapath + 'testResultSummary_'+selectedNLC+'.json';
  async.series([
    function(async_callback){
      if(isExistFile(selected_path)===true){
        console.log("既存のtestResultSummaryを読み込みます");
        //testResultSummary = require(selected_path);
        fs.readFile(selected_path,"utf-8" ,function(err,data0){
          console.log("data0:"+data0);
          testResultSummary = JSON.parse(data0);
          console.log("更新しました:"+JSON.stringify(testResultSummary));
          getCreateDate(function(err){
            if(err) console.log(err);
            else {
              console.log(testResultSummary);
              console.log("選択されたClassifier");
              console.log(selectedNLC);
              async_callback();
            }
          });
        });
      }else if(isExistFile(selected_path)===false){
        console.log("新規のtestResultSummaryを作成します");
        //var defaulttestResultSummary = require(comFuncLO.datapath + 'testResultSummary_default.json'); //デフォルトの要約を設定
        fs.readFile(comFuncLO.datapath + 'testResultSummary_default.json',"utf-8" ,function(err,data10){
          console.log("data10:"+data10);
          var defaulttestResultSummary = JSON.parse(data10);
          //console.log("更新しました:"+JSON.stringify(defaulttestResultSummary));
          getCreateDate(function(err){
            if(err) console.log(err);
            else {
              console.log("defaulttestResultSummary:"+defaulttestResultSummary);
              console.log("選択されたClassifier");
              console.log(selectedNLC);
              fs.writeFile(selected_path, JSON.stringify(defaulttestResultSummary, null, 2),function(err){
                if (err) console.log(err);
                console.log("新規のtestResultSummaryは作成されました！");
                fs.readFile(selected_path,"utf-8" ,function(err,data11){
                  console.log("data11:"+data11);
                  testResultSummary = JSON.parse(data11);
                  console.log("更新しました:"+JSON.stringify(testResultSummary));
                  getCreateDate(function(err){
                    if(err) console.log(err);
                    else {
                      console.log(testResultSummary);
                      console.log("選択されたClassifier");
                      console.log(selectedNLC);
                      async_callback();
                    }
                  });
                });
              });//ファイルを作る
            }
          });
        });
      };
    }],function(err){
      if(err) console.log(err);
      //psn_mark
      var delete_selectedNLC_sql="DELETE FROM CONFIG_TABLE WHERE PROPERTY = 'selectedNLC';";
      var renew_selectedNLC_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('selectedNLC' , '"+ selectedNLC +"');"
      renewSelectedNLC(delete_selectedNLC_sql,renew_selectedNLC_sql);
      //psn_mark
      console.log(testResultSummary);
      getCreateDate(function(err){
        if(err) console.log(err);
        res.json(testResultSummary);
      });
    }
  );
});
//ファイルが存在するかを判定する関数----emark
function isExistFile(selected_path){
  try{
    fs.statSync(selected_path);
    return true;
  }catch(err){
    if(err.code==="ENOENT") return false;
  }
};

//config_table selectedNLCを更新する関数 psn_mark
function renewSelectedNLC(delete_NLC_sql,renew_NLC_sql){
  comFuncLO.executeSQL(delete_NLC_sql, function(err,sqldata){
      if(err) console.log(err);
      comFuncLO.executeSQL(renew_NLC_sql, function(err,sqldata){
          if(err) console.log(err);
          console.log("dashDB:NLC名を更新いたしました。")
          });
  });
}
//psn_mark

//bmark

router.post('/manage/api/v1/downloadTrainData' , function(req,res,next){
	//現在のtrainbaseデータをダウンロードする
	//crtTrainbaseDataで作成されたCSVファイルをダウンロードしてくる
  console.log("download req.body.train_type is " + JSON.stringify(req.body.train_type) );
  var FileName;
  var FilePath;
  var category_filter = " WHERE CATEGORY = " ;
  switch (req.body.train_type){
    case learningOptimizationSettings.classifier_name.Production:
       console.log("本番トレーニング");
       FileName = traindata_production+"_"+selectedNLC+".csv"; //cmark
       category_filter += "'ORGTRAIN'";
       break;
    case learningOptimizationSettings.classifier_name.AutoLearn:
       console.log("自動トレーニング");
       FileName = traindata_autolearn +"_"+selectedNLC+".csv"; //cmark
       category_filter += "'ORGTRAIN' OR CATEGORY = 'MIDDLE'";
       break;
    case learningOptimizationSettings.classifier_name.Modified:
       console.log("修正トレーニング");
       FileName = traindata_modified +"_"+selectedNLC+".csv"; //cmark
       //category_filter += "CUSTOM"; //基本的にはファイルが存在するため、不要になるはず
       break;
    default :
       console.log("どのトレーニングにも当てはまりません");
  }
  FilePath = comFuncLO.datapath + FileName;
  console.log("FilePath is " + FilePath);
  console.log("FileName is " + FileName);

//  if(fs.statSync(FilePath)　== "true"){
//    console.log();
    try {
      fs.statSync(FilePath);
      console.log("File exists!");
      res.send("/data/" + FileName);
    } catch (err) {
      console.log("ファイルが存在しないので、DBから取り出します。");
      var writer = new csv.createCsvStreamWriter(fs.createWriteStream(FilePath)); // CSV Writerの定義
      writer.addListener('error', function (err) {
        console.log('/manage/api/v1/downloadTrainData Error : ' + FilePath);
        return next(err);
      });
      var select_sql = "SELECT TEXT,CLASS FROM NEWTRAIN_"+selectedNLC+" " + category_filter ;//cmark?
      console.log("select_sql:::" + select_sql);
      comFuncLO.executeSQL(select_sql, function(err, sqldata) {
        if (err) console.log(err);
        async.series([
          function(async_callback){
            for (var i=0;i<sqldata.length;i++) {
              var csvresult = [sqldata[i].TEXT, sqldata[i].CLASS];
              writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
            }
            async_callback();
          },
          function(async_callback){
            try {
              res.send("/data/" + FileName);    //ダウンロード機能
            } catch (err) { return next(err); }
            async_callback();
          }
        ],function(err){
          if(err) console.log(err);
          console.log("処理が完了しました。");
        }
      )
      });
    }
});


router.post('/manage/api/v1/downloadCustomTrain' , function(req,res,next){
  var FileName = "traindata_forCustom_"+selectedNLC+".csv"; //cmarkn
  var FilePath = comFuncLO.datapath + FileName;
  console.log("FilePath is " + FilePath);
    try {
      fs.statSync(FilePath);
      console.log("File exists!");
      res.send("/data/" + FileName);
    } catch (err) {
      console.log("テスト結果が存在しませんでした。");
      var writer = new csv.createCsvStreamWriter(fs.createWriteStream(FilePath)); // CSV Writerの定義
      writer.addListener('error', function (err) {
        console.log('/manage/api/v1/downloadCustomTrain Error : ' + FilePath);
        return next(err);
      });
      var select_sql = "SELECT TEXT,CLASS FROM NEWTRAIN_"+selectedNLC; // Badデータも取ってくるようにする cmark
      comFuncLO.executeSQL(select_sql, function(err, sqldata) {
        if (err) console.log(err);

        async.series([
          function(async_callback){
            for (var i=0;i<sqldata.length;i++) {
              var csvresult = [sqldata[i].TEXT, sqldata[i].CLASS];
              writer.writeRecord(csvresult);  // 出力ファイルに一行ずつCSVを追記
            }
            async_callback();
          },
          function(async_callback){
            try {
              res.send("/data/" + FileName);    //ダウンロード機能
            } catch (err) { return next(err); }
            async_callback();
          }
        ],function(err){
          if(err) console.log(err);
          console.log("処理が完了しました。");
        }
       )
      });
    }
});



/////////////////
router.post('/manage/api/v1/changeLOsetting' , function(req,res,next){
  learningOptimizationSettings.automatic = req.body.execMode ;
  comFuncLO.executeSQL("DELETE FROM CONFIG_TABLE WHERE PROPERTY = 'automatic'" , function(err,sqldata){
    if(err) console.log(err);
    comFuncLO.executeSQL("INSERT INTO CONFIG_TABLE ( PROPERTY , PROPERTY_VALUE ) VALUES ('automatic' , '" + req.body.execMode + "') ", function(err){
      if(err) console.log(err);
      res.json("実行モードを変更しました");
      console.log(learningOptimizationSettings);
      fs.writeFile('learningOptimizationSettings.json', JSON.stringify(learningOptimizationSettings, null, 2));
      console.log("書き込み完了しました。");
    });
  });
});


/*
router.post('/manage/api/v1/changeLOsetting', function(req,res,next){
  console.log("req.body.execMode is " + req.body.execMode);
//  console.log("req.body.execMode is...");

 res.json("実行モードを変更しました");
});
*/

/*****************************************************************************
Tableの初期化
initLOdata_forPeriod = function(フィードバック取得開始日, フィードバック取得終了日, callback(err))
例： initLOdata_forPeriod(2016-5-11 00:00:00,2016-9-6 23:59:59, callback)

テーブルの説明
trainbase:Productionの教育データIDを保持する
feedback:フィードバックから作成された教育データIDを保持する
randgroup: ランダムに教育データを選出する乱数を保持する
newtrain: 新しい教育データを保持する
logging_table_temp: logging_tableから、指定された期間のフィードバックをコピー
*****************************************************************************/
var initLOdata_forPeriod = function(periodBegin, periodEnd, initLOdata_forPeriod_callback) {
  console.log('initLOdata_forPeriod(' + periodBegin + ',' + periodEnd + ', callback) : ' + initLOdata_forPeriod_callback);

  var randgroup_num = learningOptimizationSettings.try_num;
  var split_num = learningOptimizationSettings.split_num;
  var sql = [
    'drop table trainbase;',
    'create table trainbase(data_id varchar(150) not null,repeat_num int not null, primary key(repeat_num,data_id)) organize by row;',
    'drop table feedback;',
    'create table feedback(data_id varchar(150) not null,repeat_num int not null, primary key(repeat_num,data_id)) organize by row;',
    'drop table randgroup;',
    'create table randgroup(data_id varchar(150) not null,group_id int not null,cycle int not null ,repeat_num int not null) organize by row;',
    'drop table newtrain_'+selectedNLC+';',
    'create table newtrain_'+selectedNLC+'(data_id varchar(150) not null, text varchar(1024),class varchar(512),category varchar(50));',
    'drop table logging_table_temp;',
    'CREATE TABLE logging_table_temp (CONVERSATIONID VARCHAR(64) , CLIENTID INT , XREF_ID VARCHAR(150), MESSAGEID INT , ANSWER_NUM INT , TEXT VARCHAR(1024), CLASS VARCHAR(512), ANSWER VARCHAR(10240), CONFIDENCE DECFLOAT, FEEDBACK VARCHAR(128) , EXPECTED_ANSWER VARCHAR(512), COMMENT VARCHAR(4096), INSERTION_TIME TIMESTAMP, LAST_UPDATE_TIME TIMESTAMP);',
    'drop table int_result;',
    'drop table logging_table_bad;', // bad分
    'CREATE TABLE logging_table_bad (CONVERSATIONID VARCHAR(64) , CLIENTID INT , XREF_ID VARCHAR(150), MESSAGEID INT , ANSWER_NUM INT , TEXT VARCHAR(1024), CLASS VARCHAR(512), ANSWER VARCHAR(10240), CONFIDENCE DECFLOAT, FEEDBACK VARCHAR(128) , EXPECTED_ANSWER VARCHAR(512), COMMENT VARCHAR(4096), INSERTION_TIME TIMESTAMP, LAST_UPDATE_TIME TIMESTAMP);',
    'create table int_result( repeat_num int not null, cycle int not null, group_id int not null, data_id varchar(150) not null, answer varchar(512), expected_answer varchar(512) );',
    'drop table finaltestresult;',
    'create table finaltestresult(text varchar(1024), answer varchar(512), expected_answer varchar(512), label varchar(32), correct varchar(8) );',
    'begin  declare i int default 1;  declare j int default 1;' +
    'insert into trainbase select data_id, i from train_data_'+selectedNLC+' where class is not null; commit; ' +  //bmark
    'insert into logging_table_temp with temp(XREF_ID , CONVERSATIONID , CLIENTID , MESSAGEID , INSERTION_TIME , TEXT , EXPECTED_ANSWER) as (select XREF_ID , CONVERSATIONID , CLIENTID , MESSAGEID,INSERTION_TIME ,TEXT ,CASE WHEN (FEEDBACK = 1) THEN CLASS WHEN (FEEDBACK = 9 AND (EXPECTED_ANSWER IS NOT NULL OR EXPECTED_ANSWER != \'\') ) THEN EXPECTED_ANSWER ELSE \'\' END from logging_table where FEEDBACK = 1 OR (FEEDBACK = 9 AND (EXPECTED_ANSWER IS NOT NULL OR EXPECTED_ANSWER != \'\') )) select L.CONVERSATIONID , L.CLIENTID , L.XREF_ID || \'_\' || L.CONVERSATIONID || \'_\' || L.CLIENTID || \'_\' || L.MESSAGEID || \'_\' || L.INSERTION_TIME XREF_ID, L.MESSAGEID,  L.ANSWER_NUM, L.TEXT, L.CLASS, L.ANSWER, L.CONFIDENCE, L.FEEDBACK, T.EXPECTED_ANSWER, L.COMMENT, L.INSERTION_TIME, L.LAST_UPDATE_TIME FROM LOGGING_TABLE L INNER JOIN (SELECT  MAX(INSERTION_TIME) AS INSERTION_TIME ,TEXT,EXPECTED_ANSWER FROM TEMP GROUP BY TEXT,EXPECTED_ANSWER) T ON T.INSERTION_TIME = L.INSERTION_TIME AND L.TEXT = T.TEXT AND L.EXPECTED_ANSWER = T.EXPECTED_ANSWER  ; ' +
    'insert into feedback select XREF_ID , i from logging_table_temp;' +
    'insert into logging_table_bad with temp(XREF_ID , CONVERSATIONID , CLIENTID , MESSAGEID , INSERTION_TIME , TEXT , CLASS) as (select XREF_ID , CONVERSATIONID , CLIENTID , MESSAGEID,INSERTION_TIME ,TEXT ,CLASS from logging_table where FEEDBACK = -1 ) select L.CONVERSATIONID , L.CLIENTID , L.XREF_ID || \'_\' || L.CONVERSATIONID || \'_\' || L.CLIENTID || \'_\' || L.MESSAGEID || \'_\' || L.INSERTION_TIME XREF_ID , L.MESSAGEID,  L.ANSWER_NUM, L.TEXT, L.CLASS, L.ANSWER, L.CONFIDENCE, L.FEEDBACK, L.EXPECTED_ANSWER, L.COMMENT, L.INSERTION_TIME, L.LAST_UPDATE_TIME FROM (SELECT MAX(INSERTION_TIME) AS INSERTION_TIME ,TEXT,CLASS FROM TEMP GROUP BY TEXT,CLASS) T INNER JOIN LOGGING_TABLE L ON T.INSERTION_TIME = L.INSERTION_TIME AND L.TEXT = T.TEXT AND L.CLASS = T.CLASS ;' +
    'while j <= ' + randgroup_num + ' do ' +
    'insert into randgroup(data_id,group_id,cycle,repeat_num) select data_id,mod(row_number() over(),3)+1,j,i from (select data_id from feedback where repeat_num = i order by rand()); ' +
    'insert into randgroup(data_id,group_id,cycle,repeat_num) select data_id,1,j,i from trainbase where repeat_num = i; ' +
    'insert into randgroup(data_id,group_id,cycle,repeat_num) select data_id,2,j,i from trainbase where repeat_num = i; ' +
    'insert into randgroup(data_id,group_id,cycle,repeat_num) select data_id,3,j,i from trainbase where repeat_num = i; ' +
    'set j = j + 1;  end while; ' +
    'end;'
  ];


  console.log("sql;" + sql); //ここまでは到達する
  async.eachSeries(sql, function(sql, next) {
          console.log("sql:" + sql); //ここまでは到達する（1回のみ）
    comFuncLO.executeSQL(sql, function(err, sqldata) {
      // Errorが発生しても、無視して次を実行する。 Drop table はテーブルが存在するとエラーになる。

      if (err) {
        console.log('initLOdata_forPeriod(' + periodBegin + ',' + periodEnd + ', callback) : ');
        console.log(err);
      }
      next();
    });
  }, function complete(err) {
    if(err) initLOdata_forPeriod_callback(err);
    else {
      console.log('initLOdata_forPeriod(' + periodBegin + ',' + periodEnd + ', callback) : All done.');
      initLOdata_forPeriod_callback(err);
    }
  });
}

/*****************************************************************************
initLOdata_forDays Function Definition
initLOdata_forPeriod を日数で呼び出す。
periodDays分だけ前に日付から、Feedbackデータを取り出す
例： initLOdata_forDays(30, callback) // 30日間のフィードバックデータを参考にする
*****************************************************************************/
//var initLOdata = function(initLOdata_callback) {
var initLOdata = function(initLOdata_callback) {
  //バッチが実行できる前提を満たしているかを確認する
  //最終テストデータが存在すること

  var traindata_count_sql = "select count(*) as traindata_num from train_data_"+selectedNLC+";" ; //bmark?
  var testdata_count_sql = 'select count(*) as finaltestdata_num from finaltestdata;';
  comFuncLO.executeSQL(testdata_count_sql, function(err, sqldata1) {
    if (err) console.log("SQLのエラー：：："+err);
    else {
      console.log(sqldata1);
      var finaltestdata_num_tmp = sqldata1[0].FINALTESTDATA_NUM;
      console.log("finaltestdata_num_tmp: " +  finaltestdata_num_tmp);
      comFuncLO.executeSQL(traindata_count_sql, function(err, sqldata2) {
        if (err) console.log("SQLのエラー：：："+err);
        else {
          var traindata_num_tmp = sqldata2[0].TRAINDATA_NUM;
          console.log("traindata_num_tmp: " + traindata_num_tmp );
          if(finaltestdata_num_tmp > 0 && traindata_num_tmp > 0){
            //バッチジョブの前提条件を満たしていたので、バッチを実行する。
            console.log('initLOdata(runLOdata_callback) : ' + initLOdata_callback);
            var interval_days = learningOptimizationSettings.interval_days;
            var today = new Date();
            var today_y = today.getFullYear();
            var today_m = today.getMonth() + 1;
            var today_d = today.getDate();
            var before = new Date();
            before.setTime(today.getTime() - interval_days * 86400000);
            var before_y = before.getFullYear();
            var before_m = before.getMonth() + 1;
            var before_d = before.getDate();
            console.log(before_y + "-" + before_m + "-" + before_d + " 00:00:00", today_y + "-" + today_m + "-" + today_d + " 23:59:59");
             initLOdata_forPeriod(before_y + "-" + before_m + "-" + before_d + " 00:00:00", today_y + "-" + today_m + "-" + today_d + " 23:59:59", initLOdata_callback);
          }else{
            console.log("最終テストデータと本番トレーニングデータが登録されていないため、バッチジョブは実行されませんでした。");
          }
        }
      });
    };
  });
};

/*****************************************************************************
学習データ最適化のバッチFunction
initLOdata_forPeriod Function Definition
*****************************************************************************/
var runLOdata = function(runLOdata_callback) {
  console.log('runLOdata(callback) : ' + runLOdata_callback);

  var automatic = learningOptimizationSettings.automatic;
  var randgroup_num = learningOptimizationSettings.try_num;  // 1-4 までのグループを作成
  var split_num = learningOptimizationSettings.split_num;    // 1つのグループを3つに分割してフィードバックデータを作成
  var inttestdata_num = [];                                  // 内部テストデータのファイル数
  var finaltestdata_num = [];                                // 最終テストデータのファイル数
  var cycle_group_num = [];                                  // グループ、分割を配列化する
  for (var i = 1; i <= randgroup_num; i++) {
    for (var j = 1; j <= split_num; j++) {
      cycle_group_num.push({
        cycle: i,
        group: j
      });
    }
  }
  var prodtrain_result;                                      // Production のトレーニングのテスト結果
  var autotrain_result;                                       // 自動トレーニングによるテスト結果
  var inttestdata_count;                                     //　内部テストデータ数
  var num_traindata =[];
  var temp_selectedNLC=selectedNLC;
  var created_date_tmp = testResultSummary.result[0].created_date;
  async.series([
    function(async_callback){
      testResultSummary = {
        "execDate": "-",
        "num_feedback": "-",
        "result": [{
          "classifier_name": learningOptimizationSettings.classifier_name.Production,
          "classifier_id": "-",
          "num_ans": "-",
          "num_correctAns": "-",
          "rate_correctAns": "-",
          "num_traindata" : "-",
          "status": "学習データ抽出中",
          "created_date": created_date_tmp,
          "remark": "本番に適用した最新のトレーニングデータです。"
        }, {
          "classifier_name": learningOptimizationSettings.classifier_name.AutoLearn,
          "classifier_id": "-",
          "num_ans": "-",
          "num_correctAns": "-",
          "rate_correctAns": "-",
          "num_traindata" : "-",
          "status": "学習データ抽出中",
          "remark": "初期トレーニングデータに、フィードバック結果から最適なクラスを付与したデータを追加したトレーニングデータです。"
        }, {
          "classifier_name": learningOptimizationSettings.classifier_name.Modified,
          "classifier_id": "-",
          "num_ans": "-",
          "num_correctAns": "-",
          "rate_correctAns": "-",
          "num_traindata" : "-",
          "status": "-",
          "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
        }]
      };
      fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
      //fs.unlink で既存のファイルを削除（しかし、ファイルはダウンロードできないようになっているため、不要・・・）
      async_callback();
    },

    // 内部用トレーニングデータを作成する   traindata_X_X.csv を作成
    function(async_callback) {
      console.log('=======================================================')
      console.log('内部用トレーニングデータの作成 : ')
      async.eachSeries(cycle_group_num, function(data, next) {
        comFuncLO.create_inttraindata_csv(data, function() { next(); });
      }, function complete(err) {
        console.log('内部用トレーニングデータの作成 : Finished.');
        async_callback();
      });
    },

    //内部テストデータを作成する このテストデータは、トレーニングデータと同一
    function(async_callback) {
      console.log('=======================================================')
      console.log('内部テストデータの作成 : ')
      var sql = 'select count(*) as inttestdata_count from logging_table_temp;';
      comFuncLO.executeSQL(sql, function(err, sqldata) {
        if (err) console.log(err);
        else {
          if(debugmode == 'true') console.log('inttestdata_count: ' + sqldata[0].INTTESTDATA_COUNT);
          for (var k = 1; k <= Math.ceil(sqldata[0].INTTESTDATA_COUNT / 200); k++) {
            inttestdata_num.push(k);
          }
          if(debugmode == 'true') console.log("inttestdata_num: " + inttestdata_num);
          async.eachSeries(inttestdata_num, function(data, next) {
            comFuncLO.create_inttestdata_csv(data, next);
          }, function complete(err) {
            console.log('内部テストデータの作成 : Finished.')
            async_callback();
          });
        }
      });
    },

    //既存のclassifierを削除する
    function(async_callback) {
      console.log('=======================================================')
      console.log('既存のClassifierを削除 : ');
      //psn_mark バッチ済みClassifier名を一度消す
      pre_selectedNLC=""; //psn_mark
      var delete_selectedNLC_sql="DELETE FROM CONFIG_TABLE WHERE PROPERTY = 'pre_selectedNLC';";
      var renew_selectedNLC_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('pre_selectedNLC' , '"+ pre_selectedNLC +"');"
      renewSelectedNLC(delete_selectedNLC_sql,renew_selectedNLC_sql);
      //psn_mark
          comFuncLO.deleteNLC1(function(err) {
            if (err) console.log(err);
          comFuncLO.deleteNLC2(function(err) {
            if (err) console.log(err);
            console.log('既存のClassifierを削除 : Finished.');
          async_callback();
        });
      });
    },

    // 内部テスト用Classifierを作成する
    function(async_callback) {
      console.log('=======================================================')
      console.log('内部テスト用Classifierの作成 : ');
      comFuncLO.createIntClassifier(cycle_group_num, function(err) {
        console.log('内部テスト用Classifierの作成 : Finished.');
        async_callback();
      });
    },

    //classifierがトレーニング完了状態かどうかを確認する
    function(async_callback) {
      console.log('=======================================================')
      console.log('classifierがトレーニング完了状態かどうかを確認 : ');
      async.each([1, 2], function(data, next) {
        comFuncLO.check_and_wait_nlc(data, next);
      }, function complete(err) {
        console.log('classifierがトレーニング完了状態かどうかを確認 : Finished.');
        async_callback();
      });
    },

    // 内部Classifierで、テストを行い、結果を保存する
    function(async_callback) {
      console.log('=======================================================')
      console.log('内部Classifierで、テストを行い、結果を保存 : ');
      async.eachSeries(cycle_group_num, function(data, next) {
        var classifier_name = 'inttraindata_' + data.cycle + '_' + data.group;
        if(debugmode == 'true') console.log(classifier_name);
        if (data.cycle <= 2) comFuncLO.inttest_classifier(inttestdata_num, 1, classifier_name, data.cycle, data.group, function() {
          setTimeout(function() {
            next();
          }, 20000);
        });
        else comFuncLO.inttest_classifier(inttestdata_num, 2, classifier_name, data.cycle, data.group, function() {
          setTimeout(function() {
            next();
          }, 20000);
        });
      }, function complete(err) {
        console.log('内部Classifierで、テストを行い、結果を保存 : Finished.');
        async_callback();
      });
    },

    // newtrainテーブルに新たなトレーニングデータを投入
    function(async_callback) {
      console.log('=======================================================')
      console.log('newtrain_'+temp_selectedNLC+'テーブルに新たなトレーニングデータを投入 : ');
      var gen_newdata_sql = [
          "insert into newtrain_"+temp_selectedNLC+" with temp(data_id,cnt) as (select data_id,count(*) from int_result where repeat_num = 1 group by data_id having count(*) > " + (learningOptimizationSettings.threshold.high) + ") select t.data_id, text,CONCAT('DUPLICATE_DATA:',expected_answer),'TOOHIGH' from temp t inner join logging_table_temp d on (t.data_id = d.XREF_ID) ;",
        "insert into newtrain_"+temp_selectedNLC+" with temp(data_id,cnt) as (select data_id,count(*) from int_result where repeat_num = 1 group by data_id having count(*) between " + (learningOptimizationSettings.threshold.middle + 1) + " and " + (learningOptimizationSettings.threshold.high) + ") select t.data_id, text,CONCAT('OUT_OF_DOMAIN:',expected_answer),'HIGH' from temp t inner join logging_table_temp d on (t.data_id = d.XREF_ID) ;",
        "insert into newtrain_"+temp_selectedNLC+" with temp(data_id,cnt) as (select data_id,count(*) from int_result where repeat_num = 1 group by data_id having count(*) between " + (learningOptimizationSettings.threshold.low + 1) + " and " + (learningOptimizationSettings.threshold.middle) + ") select t.data_id, text,expected_answer,'MIDDLE' from temp t inner join logging_table_temp d on (t.data_id = d.XREF_ID) ;",
        "insert into newtrain_"+temp_selectedNLC+" select tb.data_id, text,class,'ORGTRAIN'  from trainbase tb inner join train_data_"+selectedNLC+" t on (tb.data_id = t.data_id) where repeat_num = 1;", //bmark
       "insert into newtrain_"+temp_selectedNLC+" (select bt.XREF_ID, bt.text, CONCAT('BADFEEDBACK:',bt.class), 'BAD' from logging_table_bad bt left outer join logging_table_temp gt on (bt.text = gt.text and gt.expected_answer = null));"
      ];
      if(debugmode == 'true') console.log(gen_newdata_sql);
      async.eachSeries(gen_newdata_sql, function(sql, next) {
        comFuncLO.executeSQL(sql, function(err, sqldata) {
          if (err) console.log(err);
          else {
            console.log(sqldata);
            next();
          }
        });
      }, function complete(err) {
        console.log('newtrain_'+temp_selectedNLC+'テーブルに新たなトレーニングデータを投入 : Finished.');
        async_callback();
      });
    },

    // Productionトレーニングデータをcsvファイルに出力
    function(async_callback) {
      console.log('=======================================================')
      console.log('Productionトレーニングデータをcsvファイルに出力 : ');
      var sql = "select text,class from newtrain_"+temp_selectedNLC+" where CATEGORY = 'ORGTRAIN'";
      if(debugmode == 'true') console.log(sql);
      var filename = traindata_production+"_"+temp_selectedNLC+".csv"; //cmark
      if(debugmode == 'true') console.log(filename);
      comFuncLO.create_traindata_csv(sql, filename, function() {
        console.log('Productionトレーニングデータをcsvファイルに出力 : Finished.');
        var count_sql = "select count(*) as num_traindata from newtrain_"+temp_selectedNLC+" where CATEGORY = 'ORGTRAIN'";
        comFuncLO.executeSQL(count_sql, function(err, sqldata) {
          if (err) console.log(err);
          console.log(sqldata);
          console.log(JSON.stringify(sqldata));
          testResultSummary.result[0].num_traindata = sqldata[0].NUM_TRAINDATA;
          testResultSummary.result[0].status = "最終テスト開始前";
          fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
          async_callback();
        });
      });
    },

    //Autolearnトレーニングデータをcsvファイルに出力
    function(async_callback) {
      console.log('=======================================================')
      console.log('Autolearnトレーニングデータをcsvファイルに出力 : ');
      var sql = "select text,class from newtrain_"+temp_selectedNLC+" where (CATEGORY = 'ORGTRAIN' or CATEGORY = 'MIDDLE')";
      if(debugmode == 'true') console.log(sql);
      var filename = traindata_autolearn+"_"+temp_selectedNLC + ".csv";
      if(debugmode == 'true') console.log(filename);
      comFuncLO.create_traindata_csv(sql, filename, function() {
        console.log('Autolearnトレーニングデータをcsvファイルに出力 : Finished.');
        var count_sql = "select count(*) as num_traindata from newtrain_"+temp_selectedNLC+" where (CATEGORY = 'ORGTRAIN' or CATEGORY = 'MIDDLE')";
        comFuncLO.executeSQL(count_sql, function(err, sqldata) {
          if (err) console.log(err);
          testResultSummary.result[1].num_traindata = sqldata[0].NUM_TRAINDATA;
          testResultSummary.result[1].status = "最終テスト開始前";
          fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
          async_callback();
        });
      });
    },

    //Customトレーニングデータをcsvファイルに出力
    function(async_callback) {
      console.log('=======================================================')
      console.log('Customトレーニングデータをcsvファイルに出力 : ');
      var sql = "select text,class from newtrain_"+temp_selectedNLC;
      if(debugmode == 'true') console.log(sql);
      var filename = "traindata_forCustom_"+temp_selectedNLC+".csv";
      if(debugmode == 'true') console.log(filename);
      comFuncLO.create_traindata_csv(sql, filename, function() {
        console.log('Customトレーニングデータをcsvファイルに出力 : Finished.');
        async_callback();
      });
    },

    // Production classifier を作成する
    function(async_callback) {
      console.log('=======================================================')
      console.log('Production classifier を作成 : ');
      testResultSummary.result[0].status = "NLC学習中";
      comFuncLO.createClassifier1(traindata_production, traindata_production+"_"+temp_selectedNLC +".csv", function() { //cmark?
        console.log('Production classifier を作成 : Finished.');
        fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
        async_callback();
      });
    },

    // Autolearn classifier を作成する
    function(async_callback) {
      console.log('=======================================================')
      console.log('Autolearn classifier を作成 : ');
      testResultSummary.result[1].status = "NLC学習中";
      comFuncLO.createClassifier1(traindata_autolearn, traindata_autolearn+"_"+temp_selectedNLC + ".csv", function() { //cmark?
        console.log('Autolearn classifier を作成 : Finished.');
        fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
        async_callback();
      });
    },

    //classifierがトレーニング完了状態かどうかを確認する
    function(async_callback) {
      console.log('=======================================================')
      console.log('classifierがトレーニング完了状態かどうかを確認 : ');
      comFuncLO.check_and_wait_nlc(1, function() {
        console.log('classifierがトレーニング完了状態かどうかを確認 : Finished.');
        async_callback();
      });
    },

    // FINALTESTDATAのCSVを作成する
    function(async_callback) {
      console.log('=======================================================')
      console.log('FINALTESTDATAのCSVを作成 : ');
      var sql = 'select count(*) as finaltestdata_num from finaltestdata;';
      comFuncLO.executeSQL(sql, function(err, sqldata) {
        if (err) console.log(err);
        else {
          if(debugmode == 'true') console.log('FINALTESTDATA_NUM: ' + sqldata[0].FINALTESTDATA_NUM);
          for (var k = 1; k <= Math.ceil(sqldata[0].FINALTESTDATA_NUM / 200); k++) {
            finaltestdata_num.push(k);
          }
          if(debugmode == 'true') console.log("finaltestdata_num: " + finaltestdata_num);
          async.each(finaltestdata_num, function(data, next) {
            comFuncLO.create_finaltestdata_csv(data, next);
          }, function complete(err) {
            console.log('FINALTESTDATAのCSVを作成 : Finished.');
            async_callback();
          });
        }
      });
    },


    // Production classifier でテストする
    function(async_callback) {
      console.log('=======================================================')
      console.log('Production classifier でテスト : ');
      testResultSummary.result[0].status = "最終テスト中";
      fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
      comFuncLO.finaltest_classifier(finaltestdata_num, 1, traindata_production, temp_selectedNLC, function(test_result) {
        prodtrain_result = test_result;
        if(debugmode == 'true') console.log(prodtrain_result);
        console.log('Production classifier でテスト : Finished.');
        async_callback();
      });
    },

    // Autotrain classifier でテストする
    function(async_callback) {
      console.log('=======================================================')
      console.log('Autotrain classifier でテスト : ');
      testResultSummary.result[1].status = "最終テスト中";
      fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
      comFuncLO.finaltest_classifier(finaltestdata_num, 1, traindata_autolearn, temp_selectedNLC,function(test_result) {
        autotrain_result = test_result;
        if(debugmode == 'true') console.log(autotrain_result);
        console.log('Autotrain classifier でテスト : Finished.');
        async_callback();
      });
    },

    // 自動的にProductionのトレーニングデータを更新する Automaticモード
    function(async_callback) {
      console.log('=======================================================')
      console.log('自動的にProductionのトレーニングデータを更新する Automaticモード : ');
      console.log('Automaticモード：' + automatic);
      console.log('Production='+prodtrain_result.correct_total + ' Autotrain=' + autotrain_result.correct_total);
      if(automatic == 'true' && prodtrain_result.correct_total < autotrain_result.correct_total) {
        console.log('Autotrainが上回ったため、Productionの学習データを更新します。');

        // 本番NLCを入れ替える
        var train_data_path = comFuncLO.datapath + traindata_autolearn+"_"+temp_selectedNLC + ".csv" ;
        exchangeProductionNLC(train_data_path) ;

/*
        var now = new Date();
        now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
        var y = now.getFullYear();
        var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
        var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
        var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
        var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
        var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;
        var created_date_tmp = y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second;
        testResultSummary.result[0].created_date = created_date_tmp ;
        fs.writeFile(comFuncLO.datapath + 'testResultSummary.json', JSON.stringify(testResultSummary, null, 2));
*/
        setCreateDate();

        comFuncLO.insert_autolearn_data(temp_selectedNLC,function(err) { //cmark??
          if (err) console.log(err);
          else {
            console.log('自動的にProductionのトレーニングデータを更新する Automaticモード : Finished.');
            async_callback();
          }
        });
      }else {
        console.log('自動的にProductionのトレーニングデータを更新する Automaticモード : Finished.');
        async_callback();
      }
    }
  ],function(err) {
    if (err) {
      console.log("err: " + JSON.stringify(err));
      runLOdata_callback(err, null);
    } else {
      console.log('=======================================================')
      console.log('テスト結果の作成　testResultSummary.json : ');
      if(debugmode == 'true') console.log("autotrain: " + autotrain_result);
      if(debugmode == 'true') console.log("prodtrain: " + prodtrain_result);

      var now = new Date();
      now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
      var y = now.getFullYear();
      var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
      var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
      var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
      var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
      var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;

      var created_date_temp = testResultSummary.result[0].created_date ;
      var num_traindata_production = testResultSummary.result[0].num_traindata ;
      var num_traindata_autolearn = testResultSummary.result[1].num_traindata ;
      testResultSummary = {
        "execDate": y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second ,
        "num_feedback": prodtrain_result.total,
        "result": [{
          "classifier_name": learningOptimizationSettings.classifier_name.Production,
          "classifier_id": prodtrain_result.classifier_id,
          "num_ans": prodtrain_result.total,
          "num_correctAns": prodtrain_result.correct_total,
          "rate_correctAns": Math.round((prodtrain_result.correct_total/prodtrain_result.total)*10000)/100,
          "num_traindata" : num_traindata_production,
          "status": "完了",
          "created_date": created_date_temp,
          "remark": "本番に適用した最新のトレーニングデータです。"
        }, {
          "classifier_name": learningOptimizationSettings.classifier_name.AutoLearn,
          "classifier_id": autotrain_result.classifier_id,
          "num_ans": autotrain_result.total,
          "num_correctAns": autotrain_result.correct_total,
          "rate_correctAns": Math.round((autotrain_result.correct_total/autotrain_result.total)*10000)/100,
          "num_traindata" : num_traindata_autolearn,
          "status": "完了",
          "remark": "初期トレーニングデータに、フィードバック結果から最適なクラスを付与したデータを追加したトレーニングデータです。"
        }, {
          "classifier_name": learningOptimizationSettings.classifier_name.Modified,
          "classifier_id": "-",
          "num_ans": "-",
          "num_correctAns": "-",
          "rate_correctAns": "-",
          "num_traindata" : "-",
          "status": "-",
          "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
        }]
      };
      console.log(testResultSummary);
      console.log('output: ' + comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json');
      fs.writeFile(comFuncLO.datapath + 'testResultSummary_'+temp_selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
      console.log('最終テスト結果の作成　testResultSummary.json : Finished.');
      pre_selectedNLC=temp_selectedNLC; //psn_mark
      var delete_selectedNLC_sql="DELETE FROM CONFIG_TABLE WHERE PROPERTY = 'pre_selectedNLC';";
      var renew_selectedNLC_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('pre_selectedNLC' , '"+ pre_selectedNLC +"');"
      renewSelectedNLC(delete_selectedNLC_sql,renew_selectedNLC_sql)//関数にできるのではないか？
    //psn_mark
      //dashDBに入れる処理1executeSQL
      runLOdata_callback();
    }
  });
};

//バッチジョブの実行

var job = new CronJob(learningOptimizationSettings.cronBatchSchedule, function() {
  var d = new Date();
  console.log(d);
  if(selectedNLC !== ""){
    console.log("バッチ処理を開始しました！");
    initLOdata(function(err) {
      if(err) console.log(err);
      runLOdata(function(err) {
        if(err) console.log(err);
      });
    });
  }else{
  	console.log("NLCが選択されていないので、バッチ処理を中止しましたしました");
  }
}, function () {
  console.log("Cron Stop!");
},
true, /* Start the job right now */
'Asia/Tokyo'
);



exports.setCreateDate = function(){
  setCreateDate();
};

function setCreateDate(){
  var now = new Date();
  now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
  var y = now.getFullYear();
  var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
  var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
  var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
  var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
  var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;
  testResultSummary.result[0].created_date =  y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second ;
  fs.writeFile(comFunc.datapath + 'testResultSummary_'+selectedNLC+'.json', JSON.stringify(testResultSummary, null, 2));
};



function exchangeProductionNLC(train_data_path){
  var nlClassifier = comFuncLO.nlClassifierSetting();
  var old_classifier; //これは配列になるはず([classifierの情報],[classifierの情報])　amark
  async.series([
    function(async_callback){

       nlClassifier[0].list({
         options: {
           url: '/v1/classifiers',
           method: 'GET',
           json: true
         }
       }, function(err, result) {
         if (err) return callback(err);
        console.log("result.classifiers ::: "+result.classifiers);
        console.log("result.classifiers[0]:::::" + JSON.stringify(result.classifiers[0]));
      //console.log(result.classifiers.length);
        for(var i=0 ; i<result.classifiers.length ; i++){ //amark この処理は消す
          console.log("classifiers_" + i + ":" + JSON.stringify(result.classifiers[i])); //amark この処理は消す
          if (result.classifiers[i].name == selectedNLC ){ //amark この処理は消す
            console.log("classifier_id : "+result.classifiers[i].classifier_id);    //amark この処理は消す
            old_classifier  = result.classifiers[i] ; //old_classifier=result.classifiers amark
          }else{  //amark この処理は消す
            console.log("対応するclassifierではありません");　//amark この処理は消す
          }　//amark この処理は消す
        } //amark この処理は消す
        async_callback();
       });

    },
    function(async_callback){
      //本番NLCの削除
      console.log("本番NLCを削除します。");
      var params = {
        classifier_id : old_classifier.classifier_id
      };
      nlClassifier[0].remove(params,function(err, result){
        if (err) return next(err);
        console.log('/manage/api/v1/deleteNlc : result')
        console.log(result);
      });

      async_callback();
    },
    function(async_callback){
      //本番NLCの作成

  console.log("本番NLCを作成します。");
  var params = {
    language: old_classifier.language,
    name: old_classifier.name,
    training_data: fs.createReadStream(train_data_path)
  };
    nlClassifier[0].create(params, function(err, result){
      if(err) return next(err);
      console.log('/manage/api/v1/createNlc : result')
      console.log(result);
      setCreateDate();

      // テーブルのデータの入れ替え

      var product_DataPath = comFunc.datapath + traindata_production +".csv";
      console.log("トレーニングデータのファイルをコピーします。");
      fs.createReadStream(train_data_path).pipe(fs.createWriteStream(product_DataPath));
      console.log("テーブルのデータを入れ替えます。");
      comFunc.readSettings();

      var reqPath = train_data_path;  // 入力ファイルのパス
      var reader = csv.createCsvFileReader(train_data_path, {});  // CSV Readerの定義
      var sqlError;
      var i = 0;
      var j = 0;

      var now = new Date();
      now.setTime(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + 32400000 );
      var y = now.getFullYear();
      var m = now.getMonth() + 1;　 if (m < 10) {m = '0' + m;} ;
      var d = now.getDate();　 if (d < 10) {d = '0' + d;} ;
      var hour = now.getHours(); if (hour < 10) {hour = '0' + hour;} ;
      var minute = now.getMinutes(); if (minute < 10) {minute = '0' + minute;} ;
      var second = now.getSeconds(); if (second < 10) {second = '0' + second;} ;
      var created_date_tmp = "'" + y + "-" + m + "-" + d + " " + hour + ":" + minute + ":" + second + "'";

      var datetime_delete_sql = "DELETE FROM CONFIG_TABLE WHERE PROPERTY = 'created_date';"
      comFuncLO.executeSQL(datetime_delete_sql , function(err,sqldata){
        if(err) console.log(err);
        var datetime_insert_sql = "INSERT INTO CONFIG_TABLE (PROPERTY , PROPERTY_VALUE) VALUES ('created_date' , " + created_date_tmp + ");"
        comFuncLO.executeSQL(datetime_insert_sql, function(err,sqldata){
            if(err) console.log(err);
          });
       });

      var conn = ibmdb.openSync(constr);
      console.log("TRAIN_DATAテーブルへの挿入を開始します。");
      console.log("start connecting...");
      //begin transaction
      conn.beginTransaction(function(err){
        if (err) {
         next(err);
         return conn.closeSync();
        }
      // ya-csv reader error handling
       reader.addListener('error', function (err) {
        console.log('/manage/api/v1/createNlc Error : ' + train_data_path);
        return next(err);
       });
       console.log("dashDBへの接続が完了しました");
       try {
         console.log("DROP TABLE TRAIN_DATA_"+selectedNLC); //bmark
         var result_delete = conn.querySync("DROP TABLE TRAIN_DATA_"+selectedNLC+";"); //bmark
       } catch (e) {
         sqlError = e;
         console.log(sqlError.message);
       }

       try {
        var result_create = conn.querySync("CREATE TABLE TRAIN_DATA_"+selectedNLC+"(DATA_ID VARCHAR(150),TEXT VARCHAR(10240) , CLASS VARCHAR(512));"); //bmark
       } catch (e) {
        sqlError = e;
        console.log(sqlError.message);
       }

      var num=0 ;
      reader.addListener('data', function (data) { //csvファイルを1行ごとに読み込み
      num++;
      var data_id = "PRODUCT_TRAIN_DATA" + num ;
      try {
        var result_insert = conn.querySync("INSERT INTO TRAIN_DATA_"+selectedNLC+" VALUES('" + data_id + "','" + data[0] + "','" + data[1] + "');"); //bmark
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
            if (sqlError) next(sqlError);
            else{
             setCreateDate();
             res.json("NLC "+req.body.classifierName+"クラスを作成しました");
            }
            async_callback();
          }, 1000);
        }
      });
    });
  });

});

  }
  ],function(err){
    if(err) console.log(err);
    res.json("本番トレーニングデータを入れ替えしました"); //ページが遷移してしまうのが気になる
  })
};








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
