var watson = require('watson-developer-cloud'); // watson developer cloud
var bluemix      = require('../config/bluemix');
var extend       = require('util')._extend;
var _ = require("underscore");  // アンダースコア
var fs = require('fs');  // ファイル操作用
var csv = require("ya-csv");  // csv 操作用
var credentials_NLC = [];  // NLC のクレデンシャル
var credentials_DB;  // SQL DB のクレデンシャル
var pre_classify_params;
var final_classify_params;
var classifiers = [];  // NLC クラシファイのリスト
var settingJson ={};  // classifierSettings.json のデータを格納
var ibmdb = require('ibm_db');
var nlClassifier = [] ;
var constr ;
var services// = require('../VCAP_SERVICES.json');
var async = require('async');
/*
define nlClassifierSetting function
*/
var datapath = __dirname + '/../public/data/';
exports.datapath = datapath;
//ar testResultSummary = require(datapath + 'testResultSummary.json');
var learningOptimizationSettings = require('../learningOptimizationSettings.json');

function nlClassifierSetting(){
  //console.log("Initialize!");
  // Define Credentials_NLC
  // if bluemix credentials exists, then override local
  if (typeof process.env.VCAP_SERVICES === 'undefined') {
  	services = require('../VCAP_SERVICES.json');
    credentials_NLC[0] = extend({version : 'v1'},
    services['natural_language_classifier'][0].credentials); // VCAP_SERVICES
    credentials_NLC[1] = extend({version : 'v1'},
    services['natural_language_classifier'][1].credentials); // VCAP_SERVICES
    credentials_NLC[2] = extend({version : 'v1'},
    services['natural_language_classifier'][2].credentials); // VCAP_SERVICES
  } else {
    credentials_NLC[0] = extend({version : 'v1'},
    bluemix.getServiceCreds('natural_language_classifier')); // VCAP_SERVICES
    credentials_NLC[1] = extend({version : 'v1'},
    bluemix.getSecondServiceCreds('natural_language_classifier')); // VCAP_SERVICES
    credentials_NLC[2] = extend({version : 'v1'},
    bluemix.getThirdServiceCreds('natural_language_classifier')); // VCAP_SERVICES
  };
  nlClassifier[0] = watson.natural_language_classifier(credentials_NLC[0]);  // Create the service wrrouterer
  nlClassifier[1] = watson.natural_language_classifier(credentials_NLC[1]);  // Create the service wrrouterer
  nlClassifier[2] = watson.natural_language_classifier(credentials_NLC[2]);  // Create the service wrrouterer
};

nlClassifierSetting();

exports.nlClassifierSetting = function(){
  nlClassifierSetting();
  return nlClassifier;
};



/*
define constrSetting function
*/

exports.constrSetting = function(){
  constrSetting(credentials_DB_Setting);
  return constr;
};
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

/*
difine executeSQL function
*/

constrSetting(credentials_DB_Setting);

//exports.executeSQL = function(sql,callback){
exports.executeSQL = function(sql,callback){
  executeSQL(sql,callback);
};
function executeSQL(sql,callback,try_num){
/*  if(constr){
    //console.log("constrがあります");
  }else{
      constrSetting(credentials_DB_Setting);
  }
*/

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

    nlClassifier[1].list({
      options: {
        url: '/v1/classifiers',
        method: 'GET',
        json: true
      }
    }, function(err, result1) {
      if (err) return callback(err);
      classifiers[1] = result1.classifiers;
      nlClassifier[2].list({
        options: {
          url: '/v1/classifiers',
          method: 'GET',
          json: true
        }
      }, function(err, result2) {
        if (err) return callback(err);
        classifiers[2] = result2.classifiers;
        callback();
      });
    });
  });
};

exports.classifiers_getlist = classifiers_getlist ;
exports.classifiers_getParams = function(){
  classifiers_getlist(function(err) {
    if (err) console.log(err);
  });
  var tmp = {
    "classifiers" : classifiers ,
    "pre_classify_params" : pre_classify_params,
    "final_classify_params" : final_classify_params
  };
  return tmp;
};


/******************
define deleteNLC function
既存のClassifierの削除
サービスの2,3,個目のClassifierは全削除する
***********/

exports.deleteNLC1 = function(callback) {
  deleteNLC1(callback);
};
function deleteNLC1(callback){
  console.log('deleteNLC1() : ')
  classifiers_getlist(function(){
    async.eachSeries(classifiers[1], function(data, next){
      nlClassifier[1].remove({
        classifier_id: data.classifier_id },
        function(err, response) {
          if (err) console.log('error:', err);
          else console.log('deleteNLC() : Deleted '+data.classifier_id);
          next();
        }
      );
    }, function complete(err) {
      console.log('deleteNLC1() : Finished.')
      callback(err);
    });
  });
};

exports.deleteNLC2 = function(callback) {
  deleteNLC2(callback);
};
function deleteNLC2(callback){
  console.log('deleteNLC2() : ')
  console.log(classifiers[2]);
  classifiers_getlist(function(){
    async.eachSeries(classifiers[2], function(data, next){
      nlClassifier[2].remove({
        classifier_id: data.classifier_id },
        function(err, response) {
          if (err) console.log('error:', err);
          else console.log('deleteNLC() : Deleted '+data.classifier_id);
          next();
        }
      );
    }, function complete(err) {
      console.log('deleteNLC1() : Finished.')
      callback(err);
    });
  });
}


/******************
define createIntClassifier function
Classifierを作成する　createClassifier1（NLCサービスの2つめ）、createClassifier2（NLCサービスの3つめ） を呼び出す
***********/
exports.createIntClassifier  = function(cycle_group_num, callback) {
  createIntClassifier(cycle_group_num, callback);
};
function createIntClassifier(cycle_group_num, callback) {
  console.log('createIntClassifier() : ')
  async.eachSeries(cycle_group_num, function(data, next) {
    var traindata_name = 'inttraindata_' + data.cycle + '_' + data.group;
    if (data.cycle <= 2) createClassifier1(traindata_name, traindata_name + '.csv', next);
    else createClassifier2(traindata_name, traindata_name + '.csv', next);
  }, function complete(err) {
    console.log('createIntClassifier() : Finished.')
    callback(err);
  });
};


/******************
define createClassifier1 function
Classifierを作成する　NLCサービスの2つめに作成する。
***********/
exports.createClassifier1  = function(classifier_name, training_file, next) {
  createClassifier1(classifier_name, training_file, next);
};
function createClassifier1(classifier_name, training_file, next) {
  console.log('createClassifier1() : ');
  var params = {
    language: 'ja',
    name: classifier_name,
    training_data: fs.createReadStream(datapath + '' + training_file)
  };

  nlClassifier[1].create(params, function(err, response) {
    if (err)
    console.log(err);
    else {
      console.log(JSON.stringify(response, null, 2));
      console.log('createClassifier1() : Finished.');
      next();
    }
  });
}

/******************
define createClassifier1 function
Classifierを作成する　NLCサービスの2つめに作成する。
***********/
exports.createClassifier2  = function(classifier_name, training_file, next) {
  createClassifier2(classifier_name, training_file, next);
};
function createClassifier2(classifier_name, training_file, next) {
  console.log('createClassifier2() : ');
  var params = {
    language: 'ja',
    name: classifier_name,
    training_data: fs.createReadStream(datapath + '' + training_file)
  };

  nlClassifier[2].create(params, function(err, response) {
    if (err)
    console.log(err);
    else {
      console.log(JSON.stringify(response, null, 2));
      console.log('createClassifier2() : Finished.');
      next();
    }
  });
}

/******************
define check_and_wait_nlc function
Classifierの作成済みをチェックする 100秒間隔でチェック
***********/
exports.check_and_wait_nlc  = function(num,callback) {
  check_and_wait_nlc(num,callback);
};
function check_and_wait_nlc(num,callback){
  console.log('check_and_wait_nlc('+num+',callback) : ');
  var nlc_status = function(e, callback_temp){
    nlClassifier[num].status({
      classifier_id: e.classifier_id },
      function(err, response) {
        if (err) console.log('error:', err);
        else{
          console.log('check_and_wait_nlc : ' + response.name + ' : ' + response.status + ' : ' + new Date());
          if(response.status == "Available"){
            callback_temp();
          }
        }
      }
    );
  }

  nlClassifier[num].list({},
    function(err, response) {
      if (err) console.log('error:', err);
      else {
        async.each(response.classifiers, function(data, next) {
          var timer = setInterval(function(){
            nlc_status(data, function(){clearInterval(timer); next();});
          }, 100000);
        }, function complete(err) {
          console.log('check_and_wait_nlc('+num+',callback) : Finished.');
          callback();
        });
      }
    }
  );
}



/*
difine create_inttraindata_csv function
*/
exports.create_inttraindata_csv = function(cycle_group,callback) {
  create_inttraindata_csv(cycle_group,callback);
};
function create_inttraindata_csv(cycle_group,callback){
  console.log('create_inttraindata_csv('+cycle_group+',callback) : ');
  var traindata_file = 'inttraindata_' + cycle_group.cycle + '_' + cycle_group.group + '.csv';
  var sql = 'with textdata(data_id,text,class) as (select data_id,text,class from train_data union all select XREF_ID,text,expected_answer from logging_table_temp) select text,class from textdata d inner join randgroup r on (d.data_id = r.data_id) where cycle = ' + cycle_group.cycle + ' and group_id = ' + cycle_group.group + ' and repeat_num = 1';
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream(datapath + traindata_file)); // CSV Writerの定義
  executeSQL(sql, function(err, sqldata) {
    if (err) console.log(err);
    else {
      for (var k=0;k<sqldata.length;k++) {
        var sqldata_temp = [sqldata[k].TEXT,sqldata[k].CLASS];
        writer.writeRecord(sqldata_temp);  // 出力ファイルに一行ずつCSVを追記
      }
      console.log('create_inttraindata_csv('+cycle_group+',callback) : Finished.');
      callback();
    }
  });
};

/*
difine create_traindata_csv function
*/
exports.create_traindata_csv = function(sql,filename,callback) {
  create_traindata_csv(sql,filename,callback);
};

function create_traindata_csv(sql,filename,callback){
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream(datapath + filename)); // CSV Writerの定義
  executeSQL(sql, function(err, sqldata) {
    if (err) console.log(err);
    else {
      for (var k=0;k<sqldata.length;k++) {
        // console.log(sqldata);
        var sqldata_temp = [sqldata[k].TEXT,sqldata[k].CLASS];
        writer.writeRecord(sqldata_temp);  // 出力ファイルに一行ずつCSVを追記
      }
      callback();
    }
  });
};

/*
difine create_inttestdata_csv function
*/
exports.create_inttestdata_csv = function(i,callback) {
  create_inttestdata_csv(i,callback);
};
function create_inttestdata_csv(i,callback){
  console.log('create_inttestdata_csv('+i+',callback)');
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream(datapath + 'inttestdata_'+i+'.csv')); // CSV Writerの定義
  var sql =
  'select data_id,text,expected_answer '+
  'from (select row_number() over(order by r.data_id) rownum,r.data_id,text,expected_answer '+
  'from logging_table_temp d inner join randgroup r '+
  'on (d.XREF_ID = r.data_id) '+
  'where cycle = 1) '+
  'where rownum between ('+i+' - 1)*200 + 1 and '+i+' * 200';
  executeSQL(sql, function(err, sqldata) {
    if (err) console.log(err);
    else {
      console.log(sqldata);
      for (var k=0;k<sqldata.length;k++) {
        var sqldata_temp = [sqldata[k].DATA_ID,sqldata[k].TEXT,sqldata[k].EXPECTED_ANSWER];
        console.log(sqldata_temp);
        writer.writeRecord(sqldata_temp);  // 出力ファイルに一行ずつCSVを追記
      }
      console.log('create_inttestdata_csv('+i+',callback) : Finished.');
      callback();
    }
  });
};

exports.create_finaltestdata_csv = function(i,callback) {
  create_finaltestdata_csv(i,callback);
};

function create_finaltestdata_csv(i,callback){
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream(datapath + 'finaltestdata_'+i+'.csv')); // CSV Writerの定義
  var sql =
  'select text,class '+
  'from (select row_number() over(order by text) rownum,text,class from finaltestdata) '+
  'where rownum between ('+i+' - 1)*200 + 1 and '+i+' * 200';
  executeSQL(sql, function(err, sqldata) {
    if (err) console.log(err);
    else {
      console.log(sqldata);
      for (var k=0;k<sqldata.length;k++) {
        var sqldata_temp = [sqldata[k].TEXT,sqldata[k].CLASS];
        console.log(sqldata_temp);
        writer.writeRecord(sqldata_temp);  // 出力ファイルに一行ずつCSVを追記
      }
      callback();
    }
  });
};


/******************
define inttest_classifier
内部Classifierのテストを行い、結果をint_result テーブルに保管する
***********/
exports.inttest_classifier = function(file_num, classifier_num, classifier_name, cycle, group_id, callback) {
  console.log('inttest_classifier : ');

  var test_result = {
    classifier_name: classifier_name,
    total: 0,
    correct_total: 0,
    classify_results: []
  }
  var classifier_id;

  function insert_testresult(rows, try_num, callback_temp) {
    var sql_insert = "insert into int_result( repeat_num, cycle, group_id, data_id, answer, expected_answer) values (?,?,?,?,?,?)";
    var stmt;
    ibmdb.open(constr, function(err, conn) {
      if (err) {
        console.log('error:', err);
        if (try_num <= 3) {
          setTimeout(function() {
            insert_testresult(rows, try_num + 1, callback_temp);
          }, 60000);
          console.log("try" + try_num);
        } else {
          console.log("fail");
        }
      } else {
        stmt = conn.prepareSync(sql_insert);

        function insert_row(row, try_row_num, next) {
          var row_arr = [
            row.repeat_num,
            row.cycle,
            row.group_id,
            row.data_id,
            row.answer,
            row.expected_answer
          ];
          stmt.execute(row_arr, function(err, result) {
            if (err) {
              console.log('error:', err);
              if (try_row_num <= 3) {
                setTimeout(function() {
                  insert_testresult(rows, try_num + 1, next);
                }, 60000);
                console.log("try" + try_row_num);
              } else {
                console.log("fail");
              }
            } else {
              next();
            }
          });
        }

        async.eachSeries(rows, function(row, next) {
          insert_row(row, 1, next);
        }, function(err) {
          conn.close(function(err) {
            if (err) console.log(err);
            callback_temp();
          });
        });
      }
    });
  }

  function one_text_classify(data_id, question, expt_answer, try_num, next) {
    nlClassifier[classifier_num].classify({
      text: question,
      classifier_id: classifier_id
    },
    function(err, response) {
      if (err) {
        console.log('error:', err);
        if ((err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') && try_num <= 3) {
          setTimeout(function() {
            one_text_classify(data_id,question, expt_answer, try_num + 1, next);
          }, 20000);
          console.log("try" + try_num);
        } else {
          console.log("fail");
        }
      } else {
        var answer = response.classes[0].class_name;
        var correct = (expt_answer === answer) ? 1 : 0;
        // writer.writeRecord([correct == 1 ? '○' : '×', expt_answer, answer, question]);
        test_result.total++;
        test_result.correct_total += correct;
        if (correct == 0) test_result.classify_results.push({
          repeat_num : 1,
          cycle: cycle,
          group_id: group_id,
          data_id: data_id,
          text: question,
          answer: answer,
          expected_answer: expt_answer,
          label: classifier_name,
          correct: correct,
        });
        // console.log(' total: ' + test_result.total + ' correct: ' + test_result.correct_total + ' label: ' + classifier_name);
        next();
      }
    });
  };

  nlClassifier[classifier_num].list({},
    function(err, response) {
      if (err) console.log('error:', err);
      classifier_id = _.where(response.classifiers, { name: classifier_name})[0].classifier_id;
      async.eachSeries(file_num, function(num, next) {
        setTimeout(function() {
          var predataReader = csv.createCsvFileReader(datapath + 'inttestdata_' + num + '.csv', { columnsFromHeader: false });
          var nlc_classify_req = [];
          predataReader
          .on('data', function(data) {
            nlc_classify_req.push({
              data_id: data[0],
              question:data[1],
              expt_answer:data[2],
              classifier_id: classifier_id
            });
          })
          .on('end', function() {
            async.each(nlc_classify_req,  function(data, next) {
              one_text_classify(data.data_id, data.question, data.expt_answer, 1, next);
            }, function complete(err) {
              console.log(err);
              console.log('total_sum:' + test_result.total, 'correct_total_sum:' + test_result.correct_total);
              next();
            });
          });
        }, 20000);
      }, function complete(err) {
        console.log('classifier_name:' + classifier_name, 'total_sum:' + test_result.total,
        'correct_total_sum:' + test_result.correct_total, 'correct_rate:' + test_result.correct_total / test_result.total);
        insert_testresult(test_result.classify_results, 1, function(err) {
          if (err) console.log(err);
          callback(test_result);
        });
      });
    }
  );
};


/******************
define test_classifier
内部Classifierのテストを行い、結果をint_result テーブルに保管する
***********/
exports.finaltest_classifier = function(file_num, classifier_num, classifier_name,selectedNLC, callback) {
  console.log('test_classifier() : ');

  var test_result = {
    classifier_name: classifier_name,
    total: 0,
    correct_total: 0,
    classify_results: [],
  }

  var classifier_id;
  var writer = new csv.createCsvStreamWriter(fs.createWriteStream(datapath + classifier_name + '_result_'+selectedNLC+'.csv'));
  writer.writeRecord(["correct", "expected_answer", "answer", "question"]);

  function insert_testresult(rows, try_num, callback_temp) {
    var sql_insert = "insert into finaltestresult(text, answer, expected_answer, label, correct) values (?,?,?,?,?)";
    var stmt;
    ibmdb.open(constr, function(err, conn) {
      if (err) {
        console.log('error:', err);
        if (try_num <= 3) {
          setTimeout(function() {
            insert_testresult(rows, try_num + 1, callback_temp);
          }, 60000);
          console.log("try" + try_num);
        } else {
          console.log("fail");
        }
      } else {
        stmt = conn.prepareSync(sql_insert);

        function insert_row(row, try_row_num, next) {
          var row_arr = [
            row.text,
            row.answer,
            row.expected_answer,
            row.label,
            row.correct
          ];
          stmt.execute(row_arr, function(err, result) {
            if (err) {
              console.log('error:', err);
              if (try_row_num <= 3) {
                setTimeout(function() {
                  insert_testresult(rows, try_num + 1, next);
                }, 60000);
                console.log("try" + try_row_num);
              } else {
                console.log("fail");
              }
            } else {
              next();
            }
          });
        }

        async.eachSeries(rows, function(row, next) {
          insert_row(row, 1, next);
        }, function(err) {
          conn.close(function(err) {
            if (err) console.log(err);
            callback_temp();
          });
        });
      }
    });
  }


  function one_text_classify(question, expt_answer, try_num, next) {
    nlClassifier[classifier_num].classify({
      text: question,
      classifier_id: classifier_id
    },
    function(err, response) {
      if (err) {
        console.log('error:', err);
        if ((err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') && try_num <= 3) {
          setTimeout(function() {
            one_text_classify(question, expt_answer, try_num + 1, next);
          }, 20000);
          console.log("try" + try_num);
        } else {
          console.log("fail");
        }
      } else {
        var answer = response.classes[0].class_name;
        var correct = (expt_answer === answer) ? 1 : 0;
        writer.writeRecord([correct == 1 ? '○' : '×', expt_answer, answer, question]);
        test_result.total++;
        test_result.correct_total += correct;
        test_result.classify_results.push({
          text: question,
          answer: answer,
          expected_answer: expt_answer,
          label: classifier_name,
          correct: correct,
        });
        // console.log(' total: ' + test_result.total + ' correct: ' + test_result.correct_total + ' label: ' + classifier_name);
        next();
      }
    });
  };

  nlClassifier[classifier_num].list({},
    function(err, response) {
      if (err) console.log('error:', err);
      classifier_id = _.where(response.classifiers, { name: classifier_name})[0].classifier_id;
      test_result.classifier_id = classifier_id;
      async.eachSeries(file_num, function(num, next) {
        setTimeout(function() {
          var predataReader = csv.createCsvFileReader(datapath + 'finaltestdata_' + num + '.csv', { columnsFromHeader: false });
          var nlc_classify_req = [];
          predataReader
          .on('data', function(data) {
            nlc_classify_req.push({
              question:data[0],
              expt_answer:data[1],
              classifier_id: classifier_id
            });
          })
          .on('end', function() {
            async.each(nlc_classify_req,  function(data, next) {
              one_text_classify(data.question, data.expt_answer, 1, next);
            }, function complete(err) {
              console.log(err);
              console.log('total_sum:' + test_result.total, 'correct_total_sum:' + test_result.correct_total);
              next();
            });
          });
        }, 20000);
      }, function complete(err) {
        console.log('classifier_name:' + classifier_name, 'total_sum:' + test_result.total,
        'correct_total_sum:' + test_result.correct_total, 'correct_rate:' + test_result.correct_total / test_result.total);
        insert_testresult(test_result.classify_results, 1, function(err) {
          if (err) console.log(err);
          callback(test_result);
        });
      });
    }
  );
};

/******************
define insert_autolearn_data
自動学習で抽出されたトレーニングデータを、train_data テーブルに挿入する
***********/
exports.insert_autolearn_data = function(selectedNLC,callback) {//cmark??
  insert_autolearn_data(selectedNLC,callback);//cmark??
};
function insert_autolearn_data(selectedNLC,callback){ //cmark??
  var sql = "insert into train_data_"+selectedNLC+" select data_id, text, class from newtrain_"+selectedNLC+" where category = 'MIDDLE';"; //cmark
  executeSQL(sql, function(err, sqldata) {
    callback(err);
  });
}

/////////////////////////////////
//function testModified(){
/*
exports.testModified = function(modifiedFilePath){
  async.series([
    function(callback){

      testResultSummary = require('public/data/testResultSummary.json');
      //console.log("modifiedFilePath is " + modifiedFilePath);

      //fs.readFile(modifiedFilePath, 'utf8', function (err, text) {
      //  console.log('text file!');
      //  console.log(text);
      //  console.log('error!?');
      //  console.log(err);
      //});
      //console.log("testResultSummary is " + testResultSummary);
      callback();
    },
    function(callback){
      console.log("学習開始！");
      //comFunc.createClassifier2("modified",modifiedFilePath,callback);
      //ステータスを学習中に修正し、その他を"-"に置き換える
      //console.log("testResultSummary is " + testResultSummary);
      console.log("testResultSummary.result is " + JSON.stringify(testResultSummary.result));
      testResultSummary.result[3] = {
        "classifier_name": "修正Train",
        "classifier_id": "-",
        "num_ans": "-",
        "num_correctAns": "-",
        "rate_correctAns": "-",
        "num_duplicatedAns": "-",
        "num_noAns": "-",
        "status": "学習中"
      };

      callback();
    },
    function(callback) {
      //トレーニングが途中であるかを確認する
      //      check_and_wait_nlc(2, callback);
      console.log("学習中です！");
      callback();
    },

    function(callback){
      console.log("テスト開始！");
      testResultSummary.result[3].status = "テスト中"
      console.log("テスト中");
      //test_newclassifier(2, "modifiedData", function(test_result) {
      //modifiedData_result = test_result;
      //callback();
      //});
      callback();
    },
    function(callback){
      //テストを開始
      //ステータスをテスト中に修正
      console.log("テストが進んでいます");
      callback();
    },
    function(callback){

      var modifiedData_result=["-",800,720,"90%",0,1200];
      testResultSummary.result[3] = {
        "classifier_name": "修正Train",
        "classifier_id": "B003",
        "num_ans": modifiedData_result[1],
        "num_correctAns": modifiedData_result[2],
        "rate_correctAns": modifiedData_result[3],
        "num_duplicatedAns": "-",
        "num_noAns": modifiedData_result[4],
        "num_traindata": modifiedData_result[5],
        "status": "完了",
        "remark": "自動トレーニングデータをSMEが修正したトレーニングデータです。"
      };
      console.log(testResultSummary.result[3]);
      callback();
    }
  ]
  ,function(err){
    if (err) return console.log(err);
    console.log(JSON.stringify(testResultSummary));
    fs.writeFile('public/data/testResultSummary.json', JSON.stringify(testResultSummary, null, 2));
  });
};
*/



exports.showTestResultSummary = function (){
  return testResultSummary;
};


exports.countRecords = function(filename){
  console.log("filename is " + filename);
  var filepath = datapath + filename ;
  var count ;
  fs.readFile(filepath, 'utf8', function(err, data) {
    if(err) {
      console.log(err);
      throw err;
    }
    async.series([
    function(async_callback){
      console.log(data.split('\n').length);
      count = data.toString().split('\n').length;
      console.log("count is " + count);
      async_callback();
    } ,
    function(async_callback){
    //  return count;
      async_callback();
    }
    ],function(err){
      return count;
      console.log("count =" + count + "を返しました");
      if(err) console.log(err);
    })
  });
};





/////////////////////////
