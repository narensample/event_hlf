'use strict';
var express = require('express');
var router = express.Router();
var helper = require('../app/helper.js');
const response = require('../utils/response');
const httpStatus = require('http-status');
var logger = helper.getLogger('Routes');
var User = require('../app/userManager.js');
var app = require('../app.js');
const ChannelManager = require('../app/channelManager.js');
const UpdateManager = require('../app/updateManager.js');
const ChaincodeManager = require('../app/chaincodeManager.js');
const FabOpsManager = require('../app/fabOpsManager.js');
var path = require('path');
const fs = require('fs');
var hfc = require('fabric-client');



function getErrorMessage(field, res) {
  return response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, field + ' field is missing or Invalid in the request', "1.2", {
    data: "got Error Message"
  })
}


// Register and enroll user
router.post('/createUser', async function(req, res) {
  var username = req.body.username;
  var orgName = req.body.orgName;
  logger.debug('End point : /createUser');
  logger.debug('User name : ' + username);
  if (!username) {
    res.json(getErroOMessage('\'username\'', res));
    return;
  }
  let message = await User.getRegisteredUser(username, orgName, true);
  logger.debug('-- returned from registering the username %s for organization %s', username, orgName);
  if (message.error) {
    logger.error('Failed to register the username %s for organization %s with::%s', username, orgName, message);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully registered the username %s for organization %s', username, orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }

});

////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////// -- ADMIN TASKS START--//////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

// Create Channel
router.post('/createChannel', async function(req, res) {

  logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
  logger.debug('End point : /channels');
  var channelName = req.body.channelName;
  var channelConfigPath = req.body.channelConfigPath;
  var userName = req.body.userName;
  var orgName = req.body.orgName;
  logger.debug('Channel name : ' + channelName);
  logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
  logger.debug('orgName : ' + orgName);
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }

  const channelOps = new ChannelManager(channelName, orgName);
  await channelOps.initializeClient();
  let message = await channelOps.createChannel();
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);
  if (message.error) {
    logger.error('Failed to create channel', channelName, message);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully created channel', channelName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }

});


// Join Channel
router.post('/joinPeers', async function(req, res) {

  logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
  logger.debug('End point : /joinPeers');
  var channelName = req.body.channelName;
  var peers = req.body.peers;
  var orgName = req.body.orgName;
  logger.debug('channelName : ' + channelName);
  logger.debug('peers : ' + peers);
  logger.debug('orgName:' + orgName);
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }
  if (!peers || peers.length == 0) {
    res.json(getErrorMessage('\'peers\'', res));
    return;
  }

  const channelOps = new ChannelManager(channelName, orgName);
  await channelOps.initialize();
  let message = await channelOps.joinChannel(peers);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to join peers channel', channelName, " ORG:: ", orgName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully joined peers in', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }


});

// Update Anchor Peers
router.post('/updateAnchorPeers', async function(req, res) {

  logger.info('<<<<<<<<<<<<<<<<< updateAnchorPeers >>>>>>>>>>>>>>>>>');
  logger.debug('End point : /updateAnchorPeers');
  var channelName = req.body.channelName;
  var orgName = req.body.orgName;
  logger.debug('Channel name : ' + channelName);
  logger.debug('orgName : ' + orgName);
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }

  const updateOps = new UpdateManager(channelName, orgName);
  await updateOps.initialize();
  let message = await updateOps.updateAnchorPeers();
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to update Anchor peers channel', channelName, " ORG:: ", orgName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully updated Anchor peers in', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }

});


// Install chaincode on target peers
router.post('/installChaincode', async function(req, res) {
  logger.debug('==================== INSTALL CHAINCODE ==================');
  var peers = req.body.peers;
  var chaincodeName = req.body.chaincodeName;
  var chaincodePath = req.body.chaincodePath;
  var chaincodeVersion = req.body.chaincodeVersion;
  var chaincodeType = req.body.chaincodeType;
  var orgName = req.body.orgName;
  logger.debug('peers : ' + peers); // target peers list
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('chaincodePath  : ' + chaincodePath);
  logger.debug('chaincodeVersion  : ' + chaincodeVersion);
  logger.debug('chaincodeType  : ' + chaincodeType);
  if (!peers || peers.length == 0) {
    res.json(getErrorMessage('\'peers\'', res));
    return;
  }
  if (!chaincodeName) {
    res.json(getErrorMessage('\'chaincodeName\'', res));
    return;
  }
  if (!chaincodePath) {
    res.json(getErrorMessage('\'chaincodePath\'', res));
    return;
  }
  if (!chaincodeVersion) {
    res.json(getErrorMessage('\'chaincodeVersion\'', res));
    return;
  }
  if (!chaincodeType) {
    res.json(getErrorMessage('\'chaincodeType\'', res));
    return;
  }
  const codeOps = new ChaincodeManager(orgName, peers, chaincodeName, chaincodeVersion, chaincodeType);
  await codeOps.initialize();
  let message = await codeOps.installChaincode(chaincodePath);
  logger.debug('-- got results from fabric', message);

  if (message.error) {
    logger.error('Failed to install chaincode on peers ', peers);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully installed chaincode on peers', peers);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});

// Instantiate chaincode on target peers
router.post('/instantiateChaincode', async function(req, res) {
  logger.debug('==================== INSTANTIATE CHAINCODE ==================');
  var peers = req.body.peers;
  var chaincodeName = req.body.chaincodeName;
  var chaincodeVersion = req.body.chaincodeVersion;
  var channelName = req.body.channelName;
  var chaincodeType = req.body.chaincodeType;
  var fcn = req.body.fcn;
  var args = req.body.args;
  var orgName = req.body.orgName;
  logger.debug('peers  : ' + peers);
  logger.debug('channelName  : ' + channelName);
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('chaincodeVersion  : ' + chaincodeVersion);
  logger.debug('chaincodeType  : ' + chaincodeType);
  logger.debug('fcn  : ' + fcn);
  logger.debug('args  : ' + args);
  if (!chaincodeName) {
    res.json(getErrorMessage('\'chaincodeName\'', res));
    return;
  }
  if (!chaincodeVersion) {
    res.json(getErrorMessage('\'chaincodeVersion\'', res));
    return;
  }
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!chaincodeType) {
    res.json(getErrorMessage('\'chaincodeType\'', res));
    return;
  }
  if (!args) {
    res.json(getErrorMessage('\'args\'', res));
    return;
  }


  const codeOps = new ChaincodeManager(orgName, peers, chaincodeName, chaincodeVersion, chaincodeType);
  await codeOps.initialize(channelName);
  let message = await codeOps.instantiateChaincode(channelName, args, fcn);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to instantiate chaincode on ', " channel:: ", channelName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully instantiated chaincode on ', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});

// Invoke transaction on chaincode on target peers
router.post('/invoke', async function(req, res) {
  logger.debug('==================== INVOKE ON CHAINCODE ==================');
  var peers = req.body.peers;
  var chaincodeName = req.body.chaincodeName;
  var channelName = req.body.channelName;
  var fcn = req.body.fcn;
  var args = req.body.args;
  var userName = req.body.userName;
  var orgName = req.body.orgName;
  logger.debug('channelName  : ' + channelName);
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('fcn  : ' + fcn);
  logger.debug('args  : ' + args);
  logger.debug('orgName  : ' + orgName);
  logger.debug('peers  : ' + peers);
  if (!chaincodeName) {
    res.json(getErrorMessage('\'chaincodeName\'', res));
    return;
  }
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!fcn) {
    res.json(getErrorMessage('\'fcn\'', res));
    return;
  }
  if (!args) {
    res.json(getErrorMessage('\'args\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }

  const fabOps = new FabOpsManager(channelName, orgName, userName);
  await fabOps.initialize();
  let message = await fabOps.invokeChaincode(fcn, args, chaincodeName, peers);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to invoke chaincode on ', " channel:: ", channelName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully invoked chaincode on ', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});


router.post('/query', async function(req, res) {
  logger.debug('==================== QUERY ON CHAINCODE ==================');
  var peers = req.body.peers;
  var chaincodeName = req.body.chaincodeName;
  var channelName = req.body.channelName;
  var fcn = req.body.fcn;
  var args = req.body.args;
  var userName = req.body.userName;
  var orgName = req.body.orgName;
  logger.debug('channelName  : ' + channelName);
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('fcn  : ' + fcn);
  logger.debug('args  : ' + args);
  logger.debug('peers  : ' + peers);
  if (!chaincodeName) {
    res.json(getErrorMessage('\'chaincodeName\'', res));
    return;
  }
  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!fcn) {
    res.json(getErrorMessage('\'fcn\'', res));
    return;
  }
  if (!args) {
    res.json(getErrorMessage('\'args\'', res));
    return;
  }

  const fabOps = new FabOpsManager(channelName, orgName, userName);
  await fabOps.initialize();
  let message = await fabOps.queryChaincode(fcn, args, chaincodeName, peers);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to query chaincode on ', " channel:: ", channelName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully queried chaincode on ', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});


//Query for Channel instantiated chaincodes
router.post('/chaincodes', async function(req, res) {
  logger.debug('==================== Query ABOUT CHAINCODES ==================');
  var peer = req.body.peer;
  var chaincodeName = req.body.chaincodeName;
  var channelName = req.body.channelName;
  var userName = req.body.userName;
  var orgName = req.body.orgName;
  var type = req.body.type;
  logger.debug('channelName  : ' + channelName);
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('peer  : ' + peer);
  logger.debug('orgName  : ' + orgName);
  logger.debug('userName  : ' + userName);
  logger.debug('type  : ' + type);

  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!userName) {
    res.json(getErrorMessage('\'userName\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }
  if (!peer) {
    res.json(getErrorMessage('\'peer\'', res));
    return;
  }
  if (!type) {
    res.json(getErrorMessage('\'type\'', res));
    return;
  }

  const fabOps = new FabOpsManager(channelName, orgName, userName);
  await fabOps.initialize();
  let message = await fabOps.getChaincodeDetails(type, chaincodeName, peer);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to get chaincode details on ', " channel:: ", channelName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully queried chaincode details on ', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});

//Query for Channel instantiated chaincodes
router.post('/queryTX', async function(req, res) {
  logger.debug('==================== Query ABOUT TX ==================');
  var peer = req.body.peer;
  var chaincodeName = req.body.chaincodeName;
  var channelName = req.body.channelName;
  var userName = req.body.userName;
  var orgName = req.body.orgName;
  var trxnID = req.body.trxnID;
  logger.debug('channelName  : ' + channelName);
  logger.debug('chaincodeName : ' + chaincodeName);
  logger.debug('peer  : ' + peer);
  logger.debug('orgName  : ' + orgName);
  logger.debug('userName  : ' + userName);
  logger.debug('trxnID  : ' + trxnID);

  if (!channelName) {
    res.json(getErrorMessage('\'channelName\'', res));
    return;
  }
  if (!userName) {
    res.json(getErrorMessage('\'userName\'', res));
    return;
  }
  if (!orgName) {
    res.json(getErrorMessage('\'orgName\'', res));
    return;
  }
  if (!peer) {
    res.json(getErrorMessage('\'peer\'', res));
    return;
  }
  if (!trxnID) {
    res.json(getErrorMessage('\'trxnID\'', res));
    return;
  }

  const fabOps = new FabOpsManager(channelName, orgName, userName);
  await fabOps.initialize();
  let message = await fabOps.getTransactionByID(trxnID, peer);
  logger.debug('-- got results from fabric', message, "  from  ", channelName, " ORG:: ", orgName);

  if (message.error) {
    logger.error('Failed to get chaincode details on ', " channel:: ", channelName);
    response.setResponse(res, false, httpStatus.INTERNAL_SERVER_ERROR, message.message, "1.2", {
      data: message
    })
  } else {
    logger.info('Successfully queried chaincode details on ', channelName, " ORG:: ", orgName);
    response.setResponse(res, true, httpStatus.CREATED, 'success', "1.2", {
      data: message
    })
  }
});

////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////// --BPA ADMIN TASKS END--////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

module.exports = router;