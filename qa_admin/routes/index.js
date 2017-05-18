/*
    IBM Confidential
    OCO Source Materials
    6949-63A
    (c) Copyright IBM Corp. 2016
*/

'use strict';

// 使用モジュールの読み込み
var express = require('express');
var watson_feedbackstoreRoute= require('./watson_feedbackstoreRoute');
var watson_testRoute= require('./watson_testRoute');
var watson_AnswerstoreRoute= require('./watson_AnswerstoreRoute');
var watson_manageRoute= require('./watson_manageRoute');
//var watson_autoLearnRoute= require('./watson_autoLearnRoute');



// ルーターの作成
var router = express.Router();


/*****************************************************************************
 Define Routes Section
 *****************************************************************************/
 // routes の定義を行う

 router.all('/manage/api/v1/createFeedbackstore', watson_feedbackstoreRoute);  //
 router.all('/manage/api/v1/dspFeedback', watson_feedbackstoreRoute);  //
 router.all('/manage/api/v1/downloadFeedback', watson_feedbackstoreRoute);  //
 router.all('/manage/api/v1/deleteFeedback', watson_feedbackstoreRoute);  //
 router.all('/manage/api/v1/downloadNlctest', watson_testRoute);  //
 router.all('/manage/api/v1/dspNlctest', watson_testRoute);  //
 router.all('/manage/api/v1/downloadQAtest', watson_testRoute);  //
 router.all('/manage/api/v1/dspQAtest', watson_testRoute);
 router.all('/manage/api/v1/createAnswerstore', watson_AnswerstoreRoute);  //
 router.all('/manage/api/v1/uploadAnswerstore', watson_AnswerstoreRoute);  //
 router.all('/manage/api/v1/dspAnswerstore', watson_AnswerstoreRoute);  //
 router.all('/manage/api/v1/listNlc', watson_manageRoute);  //
 router.all('/manage/api/v1/listNlcstatus', watson_manageRoute);  //
 router.all('/manage/api/v1/createNlc', watson_manageRoute);  //
 router.all('/manage/api/v1/setClassifierThreshold', watson_manageRoute);  //
 router.all('/manage/api/v1/showClassifierThreshold', watson_manageRoute);  //
 router.all('/manage/api/v1/deleteNlc', watson_manageRoute);  //


 try{
   var watson_learningOptimizationRoute= require('./watson_learningOptimizationRoute');
   router.all('/manage/api/v1/updateNlcLOtestSumm', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/downloadTestResult', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/downloadNewtrainData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/allTraindataTest', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/allTraindataRetest', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/submitProdNlc', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/downloadTestData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/updateTestData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/uploadModifiedData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/uploadTestData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/uploadTrainbaseData', watson_learningOptimizationRoute);  //
   router.all('/manage/api/v1/downloadTrainData', watson_learningOptimizationRoute); //
   router.all('/manage/api/v1/downloadCustomTrain', watson_learningOptimizationRoute); //
   router.all('/manage/api/v1/getLOproperty' , watson_learningOptimizationRoute);//
   router.all('/manage/api/v1/changeLOsetting' , watson_learningOptimizationRoute);//
   router.all('/manage/api/v1/getRetestResult' , watson_learningOptimizationRoute); //
   //router.all('/manage/api/v1/listNLCforSelection' , watson_learningOptimizationRoute); // bmark
   router.all('/manage/api/v1/ClassifierInfo' , watson_learningOptimizationRoute); // bmark
   router.all('/manage/api/v1/send_selectedNLC' , watson_learningOptimizationRoute); // bmark

 } catch (err){
   console.log("自動学習モードは実装されていません。");
 }


// モジュールのエクスポート
module.exports = router;
