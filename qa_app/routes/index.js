/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

'use strict';

// 使用モジュールの読み込み
var express = require('express');
var watson_qaRoute= require('./watson_qaRoute');
// ルーターの作成
var router = express.Router();


/*****************************************************************************
 Define Routes Section
 *****************************************************************************/
 // routes の定義を行う
 router.all('/api/v1/ipCheck', watson_qaRoute);  //

 router.all('/api/v1/question', watson_qaRoute);  //
 router.all('/api/v1/feedback', watson_qaRoute);  //
 router.all('/api/v1/dspAnswerstore', watson_qaRoute);  //

 router.all('/api/synthesize', watson_qaRoute);  //


// モジュールのエクスポート
module.exports = router;
