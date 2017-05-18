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
//var router = express.Router();  // create a new express server
var credentials_NLC = [];  // NLC のクレデンシャル
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
var ibmdb = require('ibm_db');
var nlClassifier = [] ;
var constr ;
var credential_TTS ;
var services// = require('../VCAP_SERVICES.json');
var async = require('async');
/*
define nlClassifierSetting function
*/
//var testResultSummary = require('../public/data/testResultSummary.json');
//var learningOptimazationSettings = require('../learningOptimizationSettings.json');
//testResultSummary.automatic = learningOptimazationSettings.automatic ;
var datapath = __dirname + '/../public/data/';
exports.datapath = datapath;



function nlClassifierSetting(){
  if (process.env.DEBUG == '1') console.log('nlClassifierSetting:');
  if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('../VCAP_SERVICES.json');
    credentials_NLC = extend({version : 'v1'},
    services['natural_language_classifier'][0].credentials); // VCAP_SERVICES
  } else {
    credentials_NLC = extend({version : 'v1'},
    bluemix.getServiceCreds('natural_language_classifier')); // VCAP_SERVICES
  };
  console.log("credentials_NLC:");
  console.log(credentials_NLC);
  nlClassifier[0] = watson.natural_language_classifier(credentials_NLC);  // Create the service wrrouterer
};

nlClassifierSetting();

exports.nlClassifierSetting = function(){
  nlClassifierSetting();
  return nlClassifier;
};

/*
define constrSetting function
*/

function constrSetting(callback){
  if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('../VCAP_SERVICES.json');
    credentials_DB = services['dashDB'][0].credentials;
  } else {
    credentials_DB = bluemix.getServiceCreds('dashDB'); // VCAP_SERVICES
    credentials_DB.db = "BLUDB";  // Bluemix Deploy 時になぜか必要だったので、追加。
  };
  callback();
};

function credentials_DB_Setting(){
  constr ="DRIVER={DB2};DATABASE=" + credentials_DB.db +";"+
  "HOSTNAME="+credentials_DB.host+";"+
  "UID="+credentials_DB.username+";"+
  "PWD="+credentials_DB.password+";"+
  "PORT="+credentials_DB.port+";PROTOCOL=TCPIP";
  console.log("ibmdb constr:");
  console.log(constr);
};

exports.constrSetting = function(){
  constrSetting(credentials_DB_Setting);
  return constr;
};

/*
difine executeSQL function
*/

//exports.executeSQL = function(sql,callback){
function executeSQL(sql,callback,try_num){
  if (try_num == undefined) try_num = 1;
  ibmdb.open(constr, function (err,conn) {
    console.log('executeSQL try_num : ' + try_num);
    console.log(sql);
    if (err) {
      console.log('error:', err);
      if (try_num <= 5) {
        setTimeout(function() {
          executeSQL(sql,callback,try_num + 1);
        }, 10000);
      } else {
        callback(err);
        console.log("fail");
      }
    } else {
      conn.query(sql, function (err, sqldata) {
        callback(err, sqldata);
        conn.close(function () {
          console.log('executeSQL : done');
        });
      });
    }
  });
};

exports.executeSQL = function(sql,callback){
  executeSQL(sql,callback);
};


////////
function settingCredentials_TTS(){
  if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('../VCAP_SERVICES.json');
    credentials_TTS = extend({version : 'v1'},
    services['text_to_speech'][0].credentials); // VCAP_SERVICES
  } else {
    credentials_TTS = extend({version : 'v1'},
    bluemix.getServiceCreds('text_to_speech')); // VCAP_SERVICES
  };
};
exports.settingCredentials_TTS = function(){
  settingCredentials_TTS();
  return credentials_TTS;
};


/*****************************************************************************
function answerstore_getlist
*****************************************************************************/
// get the list of answerstore
function answerstore_getlist() {
  //var sql = 'SELECT "CLASS","TEXT","TEXT4SPEECH" FROM '+answerstore_name;
  var sql = 'SELECT "CLASS","ANSWER","TEXT4SPEECH" FROM '+answerstore_name;
  ibmdb.open(constr, function (err,conn) {  // ibmdb Space
    if (err) return console.log(err);
    conn.query(sql, function (err, sqldata) {
      if (err) return console.log(err);
      answerstore_data = sqldata;
      //defaultのクラス（確信度が低いときに呼ぶ）を定義
      defaultArray = _.filter(answerstore_data, function(result){
        return result.CLASS.substr(0,7) == "default";
      });
      conn.close(function () {
        console.log('Answerstore getlist Done:');
      });
    });
  });
};

exports.answerstore_getlist = answerstore_getlist ;


/*****************************************************************************
Function readSettings
*****************************************************************************/
// classifierSettings ファイルを読み取り、初期変数をセット
//function readSettings(callback){


//exports.readSettings = function(callback){
function readSettings(callback){
  fs.readFile('./classifierSettings.json', 'utf8', function(err, text){
    if (err) {
      console.log(err);
    }else{
      settingJson = JSON.parse(text);
      classifierThresholdValue = settingJson.classifierThresholdValue;
      answerstore_name = settingJson.answerstore_name;
      console.log("しきい値は"+classifierThresholdValue+"です");
      console.log("アンサーストア名は" + answerstore_name +"です");

      callback();
    };
  });
};


/******************
define readSettings function
***********/

exports.readSettings = function(){
  readSettings(answerstore_getlist);
  return settingJson;
};


classifiers_getlist(function(err) {
  if (err) console.log(err);
});

function classifiers_getlist(callback) {
  nlClassifier[0].list({
    options: {
      url: '/v1/classifiers',
      method: 'GET',
      json: true
    }
  }, function(err, result) {
    if (err) return callback(err);
    classifiers = result.classifiers;
    // preclassify Section
    pre_classify_params = {"classifier" : (_.find(classifiers, function(classifier) {return classifier.name == 'PRECLASSIFY'}) != undefined ? _.find(classifiers, function(classifier) {return classifier.name == 'PRECLASSIFY'}).classifier_id : null)};
    final_classify_params = {"classifier" : (_.find(classifiers, function(classifier) {return classifier.name == 'FINALCLASSIFY'}) != undefined ? _.find(classifiers, function(classifier) {return classifier.name == 'FINALCLASSIFY'}).classifier_id : null)};
    callback();
  });
};

exports.classifiers_getlist =function(callback){
  classifiers_getlist(callback) ;
};


exports.classifiers_getParams = function(callback){
  if (process.env.DEBUG == '1') console.log('classifiers_getParams:');
  classifiers_getlist(function(err) {
    if (err) callback(err);
    var tmp = {
      "classifiers" : classifiers ,
      "pre_classify_params" : pre_classify_params,
      "final_classify_params" : final_classify_params
    };
    if (process.env.DEBUG == '1') console.log(tmp);
    callback(null, tmp);
  });
};






/*
difine watsonquestion function
*/
exports.watsonquestion = function(params, callback) {
  var question = params.text;  // 質問のテキスト
  var output_num = (params.output_num == undefined) ? 3 :  params.output_num;  // 出力回答数
  var output_num = 4;
  var session_id = (params.session_id == undefined) ? 0 :  params.session_id;
  var client_id = (params.client_id == undefined) ? 'public' :  params.client_id; // クライアントのID　デフォルトは、publicとする
  var chat_num = (params.chat_num == undefined) ? 0 :  params.chat_num;
  var setting_multi_answer = (params.setting_multi_answer == undefined) ? 1 :  params.setting_multi_answer;
  var watson_response = {  // Response 用変数
    "text" : question,
    "session_id" : session_id,
    "client_id" : client_id,
    "chat_num" : chat_num,
    "setting_multi_answer" : setting_multi_answer,
    "answers" : []
  };

  // 確信度が低い場合のデフォルトのアンサーを取得する。
  var defaultNum = Math.floor(defaultArray.length * Math.random());
  //var defaultAnswer = (defaultArray[defaultNum] != undefined) ? defaultArray[defaultNum].TEXT : "信頼できる回答が見つかりませんでした。";
  var defaultAnswer = (defaultArray[defaultNum] != undefined) ? defaultArray[defaultNum].ANSWER : "信頼できる回答が見つかりませんでした。";
  var defaultAnswer4Speech = (defaultArray[defaultNum] != undefined) ? defaultArray[defaultNum].TEXT4SPEECH : "信頼できる回答が見つかりませんでした。";
  var nlcnotfoundAnswer = "対応するNLCがありません。"; // 対応するNLCが存在しなかった場合の応答テキスト

  if(final_classify_params.classifier === null) {
    // preclassify Section
    pre_classify_params = extend(pre_classify_params,{"text" : question});
    nlClassifier[0].classify(pre_classify_params, function(err, preclassify_results) {
      if (err) return callback(err);
      watson_response.preclassify = preclassify_results;
      //console.log('watsonquestion : Pre Classify: ');
      //console.log(preclassify_results);

      // preclassify の確信度がしきい値以下の場合、デフォルトのアンサーからランダムに回答する。
      if(preclassify_results.classes[0].confidence < classifierThresholdValue){
        watson_response.answers.push({
          "class" : preclassify_results.classes[0].class_name,
          "answer" : defaultAnswer,
          "answer4speech" : defaultAnswer4Speech,
          "confidence" : preclassify_results.classes[0].confidence
        });
        //console.log('watsonquestion : watson_response: ');
        //console.log(watson_response.answers);
        callback(null, watson_response); //Sends a JSON response composed of a stringified version of data
      }else{
        // get classifier_id by preclassified name
        var preclassify_result_class = _.find(classifiers, function(classifier) {return classifier.name == preclassify_results.top_class});
        // preclassify のNLCが存在しない場合の返答
        if(preclassify_result_class == undefined){
          watson_response.answers.push({
            "class" : preclassify_results.classes[0].class_name,
            "answer" : nlcnotfoundAnswer,
            "answer4speech" : "",
            "confidence" : preclassify_results.classes[0].confidence
          });
          //console.log('watsonquestion : watson_response: ');
          //console.log(watson_response.answers);
          callback(null, watson_response); //Sends a JSON response composed of a stringified version of data
        }else{
          // postclassify の結果を返す。
          var classifier_id = preclassify_result_class.classifier_id;
          var post_classify_params = {
            "classifier" : classifier_id,
            "text" : question,
          };
          nlClassifier[0].classify(post_classify_params, function(err, postclassify_results) {
            if (err) return callback(err);
            watson_response.postclassify = postclassify_results;
            //console.log('watsonquestion : Post Classify: ');
            //console.log(postclassify_results);

            if(postclassify_results.classes[0].confidence < classifierThresholdValue){
              watson_response.answers.push({
                "class" : postclassify_results.classes[0].class_name,
                "answer" : defaultAnswer,
                "answer4speech" : defaultAnswer4Speech,
                "confidence" : postclassify_results.classes[0].confidence
              });

            }else {
              for (var i=0;i<Math.min(output_num, postclassify_results.classes.length);i++) {
                //配列にPUSH
                var answer = _.find(answerstore_data, function(result) {
                  return result.CLASS == postclassify_results.classes[i].class_name;
                });
                watson_response.answers.push({
                  "class" : postclassify_results.classes[i].class_name,
                  //"answer" : (answer == undefined) ? "アンサーストアデータが見つかりませんでした。" : answer.TEXT,
                  "answer" : (answer == undefined) ? "アンサーストアデータが見つかりませんでした。" : answer.ANSWER,
                  "answer4speech" : (answer == undefined) ? "" : answer.TEXT4SPEECH,
                  "confidence" : postclassify_results.classes[i].confidence
                });
              };
            };
            //console.log('watsonquestion : watson_response: ');
            //console.log(watson_response.answers);
            callback(null, watson_response); //Sends a JSON response composed of a stringified version of data
          });
        };
      };
    });


    //preclassifierをつかわない場合
  }else {
    final_classify_params = extend(final_classify_params,{"text" : question});

    nlClassifier[0].classify(final_classify_params, function(err, postclassify_results) {
      if (err) return callback(err);
      watson_response.postclassify = postclassify_results;
      //console.log('watsonquestion : Final Classify: ');
      //console.log(postclassify_results);

      if(postclassify_results.classes[0].confidence < classifierThresholdValue){
        watson_response.answers.push({
          "class" : postclassify_results.classes[0].class_name,
          "answer" : defaultAnswer,
          "answer4speech" : defaultAnswer4Speech,
          "confidence" : postclassify_results.classes[0].confidence
        });

      }else {
        for (var i=0;i<Math.min(output_num, postclassify_results.classes.length);i++) {
          //配列にPUSH
          console.log(postclassify_results.classes[i].class_name);

          var answer = _.find(answerstore_data, function(result) {
            return result.CLASS == postclassify_results.classes[i].class_name;
          });
          console.log(answer);
          watson_response.answers.push({
            "class" : postclassify_results.classes[i].class_name,
            //"answer" : (answer == undefined) ? "アンサーストアデータが見つかりませんでした。" : answer.TEXT,
            "answer" : (answer == undefined) ? "アンサーストアデータが見つかりませんでした。" : answer.ANSWER,
            "answer4speech" : (answer == undefined) ? "" : answer.TEXT4SPEECH,
            "confidence" : postclassify_results.classes[i].confidence
          });
        };
      };
      //console.log('watsonquestion : watson_response: ');
      //console.log(watson_response.answers);
      callback(null, watson_response); //Sends a JSON response composed of a stringified version of data
    });
  };
};

////// createAuthList function////
function createAuthList(callback){
  if (process.env.DEBUG == '1') console.log('createAuthList:');

  fs.writeFile("user_password","",function(err){
    if (err) console.log(err);
    if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
      var auth = process.env.ADMIN_USER + ":" + process.env.ADMIN_PASS +"\n";
      if (process.env.DEBUG == '1') console.log("auth = "+auth);
      fs.appendFileSync("user_password",auth);
      if (process.env.DEBUG == '1') console.log(auth +"をappendしました");
    }
    executeSQL("SELECT USERID,PASSWORD FROM AUTH_LIST;" , function(err,sqldata){
      if (process.env.DEBUG == '1') console.log(sqldata);
      if(sqldata == undefined || sqldata.length==0){
        console.log("データがありませんでした");
        callback();
      } else {
        for (var i=0;i<sqldata.length;i++) {
          var auth = sqldata[i].USERID + ":" + sqldata[i].PASSWORD +"\n";
          if (process.env.DEBUG == '1') console.log("auth = "+auth);
          fs.appendFileSync("user_password",auth);
          if (process.env.DEBUG == '1') console.log(auth +"をappendしました");
        }
      }
      console.log('user_password created!')
      callback();
    });
  });
};
exports.createAuthList = function(callback){
  createAuthList(callback);
};

////// createIPList function////

function createIPList(callback){
  if (process.env.DEBUG == '1') console.log('createIPList:');
  fs.writeFile("IP_List.json","",function(err){
    if (err) console.log(err);
    executeSQL("SELECT IPADDRESS,LOCATIONNAME FROM IP_LIST;" , function(err,sqldata){
      if (process.env.DEBUG == '1') console.log(sqldata);
      if(sqldata == undefined || sqldata.length==0){
        console.log("フィルタリングのIPアドレスデータがありませんでした");
        callback();
      }else{
        fs.appendFileSync("IP_List.json",'{"iplist":');
        fs.appendFileSync("IP_List.json",JSON.stringify(sqldata));
        fs.appendFileSync("IP_List.json",'}');
        callback();
      }
    });
  });
};
exports.createIPList = function(callback){
  createIPList(callback);
};
