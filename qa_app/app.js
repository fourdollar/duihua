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
// app.js 内で利用する変数を定義する
var watson = require('watson-developer-cloud'); // watson developer cloud
var express = require('express'); // express
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var basicAuth = require('basic-auth-connect'); // 基本認証用
var cache = require('memory-cache');
var _ = require("underscore");  // アンダースコア
var extend       = require('util')._extend;
var routes = require('./routes');
var auth = require('http-auth'); //認証用
var comFunc = require('./common/commonFunctions.js');

/*****************************************************************************
Express の設定
*****************************************************************************/
comFunc.createAuthList(function(){
  console.log("Call: comFunc.createAuthList()");
  comFunc.createIPList(function(){
    console.log("CALL: comFunc.createIPList()");
  // アプリケーション作成
  var app = express();  // create a new express server
  // ミドルウェアの設定
  app.use(bodyParser.urlencoded({limit:'50mb', extended : true }));
  app.use(bodyParser.json());
  app.use(methodOverride('_method'));
  //  'trust proxy', true をセットすると、req.connection.remoteAddress, req.ipが、最初のプロキシのIPアドレスと同じにセットされる。 BluemixのIPフィルターに必要
  app.set('trust proxy', true);

  if (process.env.IPSECURITY === 'ON') {
    console.log('IPSECURITY:' + process.env.IPSECURITY);
    // アクセス可能なリスト　初期では、ローカルIPとIBM幕張はアクセス可能とする
    var allowips = ['127.0.0.1','203.141.91.'];  //203.141.91. はIBM幕張事業所のIP

    // ALLOW_IP 環境変数がセットされていたら、IPを通す
    if(typeof process.env.ALLOW_IP === 'undefined'){
      console.log("You want IP FILTER ALLOW_IP, Set ALLOW_IP Environment Valuable and restart application.");
    }else{
      console.log("IP FILTER ALLOW_IP IS:" + process.env.ALLOW_IP);
      allowips.push(process.env.ALLOW_IP);
    }

    // 管理画面で設定したIPリストを取得する
    try{
      var IPList = require('./IP_List.json');
      if (process.env.DEBUG == '1') console.log('IPList');
      if (process.env.DEBUG == '1') console.log(IPList);

      if (IPList.iplist != undefined) {
        _.each(IPList.iplist,function(iplist_temp,index){
          allowips.push(iplist_temp.IPADDRESS);
        });
      }
    }catch(err){
      console.log(err);
    }
    console.log('allowips : ' + allowips);

    //IP adress のフィルタリング
    app.use(function(req, res, next) {
      if (process.env.DEBUG == '1') console.log("IP Address");
      if (process.env.DEBUG == '1') console.log('x-forwarded-for: ' + req.header('x-forwarded-for'));
      if (process.env.DEBUG == '1') console.log('req.connection.remoteAddress: ' + req.connection.remoteAddress);
      if (process.env.DEBUG == '1') console.log('req.ip: ' + req.ip);   // 最初に検知されるIPアドレス
      if (process.env.DEBUG == '1') console.log(req.ips);  // 経由したProxyのIPアドレスの配列
      if (_.find(allowips, function(ip_temp){ return req.connection.remoteAddress.indexOf(ip_temp) >= 0}) || // Local IPがリストにある場合
      _.find(allowips, function(ip_temp){ return req.ip.indexOf(ip_temp) >= 0})) {  // Proxy IPがリストにある場合
        next();
      } else {
        var err = new Error('Filter Error');
        err.code = 404;
        err.message = 'IP Address Filter Error: Local: ' + req.connection.remoteAddress + ' or Proxy: ' + req.ip;
        next(err);
      }
    });
  } else console.log('IPSECURITY:' + process.env.IPSECURITY);

  // ベーシック認証
  var userauth = auth.basic({
    realm: 'please login',
    file: "user_password"
  });
  if (process.env.AUTHENTICATION == 'ON') app.use('/',auth.connect(userauth));
  app.use(express.static(__dirname + '/public')); //setup static public directory


  // ルーティングの設定
  app.use('/', routes);

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.code = 404;
    err.message = 'Not Found';
    next(err);
  });

  // error handler
  app.use(function(err, req, res, next) {
    var error = {
      code: err.code || 500,
      error: err.message || err.error
    };
    console.log('error:', error);
    res.status(error.code).json(error);
  });


  // リクエストの受け付け
  var server = app.listen(process.env.PORT || 5000, function() {
    console.log('Listening on port %d', server.address().port);
  });

  //例外処理
  process.on('uncaughtException', function(err) {
      console.log("Uncaught Exception: "+err);
  });
});
});
