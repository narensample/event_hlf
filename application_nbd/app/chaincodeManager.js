'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('ChaincodeManager');
var User = require('./userManager.js');
var tx_id = null;
var hfc = require('fabric-client');


class ChaincodeManager {
  constructor(orgName, peers, chaincodeName, chaincodeVersion, chaincodeType) {
    this.orgName = orgName;
    this.peers = peers;
    this.chaincodeName = chaincodeName;
    this.chaincodeVersion = chaincodeVersion;
    this.chaincodeType = chaincodeType;
    var client = null;
    var channel = null;
  }


  async initialize(channelName) {
    try { // first setup the client for this org
      this.client = await User.getClientForOrg(this.orgName, this.userName);
      logger.debug('Successfully got the fabric client for the organization "%s"', this.orgName);
      this.channel = this.client.getChannel(channelName);
    } catch (error) {
      logger.error('Failed to initialize due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to initialize'
      }
    }
  }
  async installChaincode(chaincodePath) {
    logger.debug('\n\n============ Install chaincode on peers' + this.peers + ' ============\n');
    let error_message = null;
    var stackError = null;
    try {

      if (this.client.error) {
        return this.client;
      }

      helper.setupChaincodeDeploy();
      tx_id = this.client.newTransactionID(true); //get an admin transactionID
      var request = {
        targets: this.peers,
        chaincodePath: chaincodePath,
        chaincodeId: this.chaincodeName,
        chaincodeVersion: this.chaincodeVersion,
        chaincodeType: this.chaincodeType
      };
      let results = await this.client.installChaincode(request);
      // the returned object has both the endorsement results
      // and the actual proposal, the proposal will be needed
      // later when we send a transaction to the orederer
      var proposalResponses = results[0];
      var proposal = results[1];
      // lets have a look at the responses to see if they are
      // all good, if good they will also include signatures
      // required to be committed
      var all_good = true;
      for (var i in proposalResponses) {
        let one_good = false;
        if (proposalResponses && proposalResponses[i].response &&
          proposalResponses[i].response.status === 200) {
          one_good = true;
          logger.info('install proposal was good');
        } else {
          stackError = proposalResponses;
          logger.error('install proposal was bad %j', proposalResponses);
        }
        all_good = all_good & one_good;
      }
      if (all_good) {
        logger.info('Successfully sent install Proposal and received ProposalResponse');
      } else {
        error_message = 'Failed to send install Proposal or receive valid response. Response null or status is not 200'
        logger.error(error_message);
      }
    } catch (error) {
      logger.error('Failed to install due to error: ' + error.stack ? error.stack : error);
      stackError = error.stack ? error.stack : error
      error_message = error.toString();
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to install chaincode on peers :  \'' + this.peers + '\''
      }
    }

    if (!error_message) {
      let message = util.format('Chaincode has been installed successfully');
      logger.info(message);
      // build a response to send back to the REST caller
      return message;
    } else {
      let message = util.format('Failed to install due to:%s', error_message);
      logger.error(message);
      return {
        error: stackError.toString(),
        message: message
      }
    }
  }

  async instantiateChaincode(channelName, args, fcn) {
    logger.debug('\n\n============ Instantiate chaincode on channel ${channelName} ' + channelName +
      ' ============\n');
    var error_message = null;
    var stackError = null;

    try {

      if (this.client.error) {
        return this.client;
      }

      var tx_id = this.client.newTransactionID(true); // Get an admin based transactionID
      // An admin based transactionID will
      // indicate that admin identity should
      // be used to sign the proposal request.
      // will need the transaction ID string for the event registration later
      var deployId = tx_id.getTransactionID();

      var request = {
        targets: this.peers,
        chaincodeId: this.chaincodeName,
        chaincodeType: this.chaincodeType,
        chaincodeVersion: this.chaincodeVersion,
        args: args,
        txId: tx_id
      };

      if (fcn)
        request.fcn = fcn;

      logger.debug("Chaincode Instantiate is in progress please wait...");
      // send proposal to endorser
      let results = await this.channel.sendInstantiateProposal(request, 6000000); //instantiate takes much longer
      console.log(request)
      console.log("proposalSent:" + results[1]);
      console.log("proposalResponses:" + results[0]);

      // the returned object has both the endorsement results
      // and the actual proposal, the proposal will be needed
      // later when we send a transaction to the orderer
      var proposalResponses = results[0];
      var proposal = results[1];

      // lets have a look at the responses to see if they are
      // all good, if good they will also include signatures
      // required to be committed
      var all_good = true;
      for (var i in proposalResponses) {
        let one_good = false;
        if (proposalResponses && proposalResponses[i].response &&
          proposalResponses[i].response.status === 200) {
          one_good = true;
          logger.info('instantiate proposal was good');
        } else {
          stackError = proposalResponses;
          logger.error('instantiate proposal was bad');
        }
        all_good = all_good & one_good;
      }

      if (all_good) {
        logger.info(util.format(
          'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
          proposalResponses[0].response.status, proposalResponses[0].response.message,
          proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));

        // wait for the channel-based event hub to tell us that the
        // instantiate transaction was committed on the peer
        var promises = [];
        let event_hubs = this.channel.getChannelEventHubsForOrg();
        logger.debug('found %s eventhubs for this organization %s', event_hubs.length, this.orgName);
        event_hubs.forEach((eh) => {
          let instantiateEventPromise = new Promise((resolve, reject) => {
            logger.debug('instantiateEventPromise - setting up event');
            let event_timeout = setTimeout(() => {
              let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
              logger.error(message);
              eh.disconnect();
            }, 600000);
            eh.registerTxEvent(deployId, (tx, code, block_num) => {
                logger.info('The chaincode instantiate transaction has been committed on peer %s', eh.getPeerAddr());
                logger.info('Transaction %s has status of %s in blocl %s', tx, code, block_num);
                clearTimeout(event_timeout);

                if (code !== 'VALID') {
                  let message = until.format('The chaincode instantiate transaction was invalid, code:%s', code);
                  logger.error(message);
                  reject(new Error(message));
                } else {
                  let message = 'The chaincode instantiate transaction was valid.';
                  logger.info(message);
                  resolve(message);
                }
              }, (err) => {
                clearTimeout(event_timeout);
                logger.error(err);
                reject(err);
              },
              // the default for 'unregister' is true for transaction listeners
              // so no real need to set here, however for 'disconnect'
              // the default is false as most event hubs are long running
              // in this use case we are using it only once
              {
                unregister: true,
                disconnect: true
              }
            );
            eh.connect();
          });
          promises.push(instantiateEventPromise);
        });

        var orderer_request = {
          txId: tx_id, // must include the transaction id so that the outbound
          // transaction to the orderer will be signed by the admin
          // id as was the proposal above, notice that transactionID
          // generated above was based on the admin id not the current
          // user assigned to the 'client' instance.
          proposalResponses: proposalResponses,
          proposal: proposal
        };
        var sendPromise = this.channel.sendTransaction(orderer_request);
        // put the send to the orderer last so that the events get registered and
        // are ready for the orderering and committing
        promises.push(sendPromise);
        let results = await Promise.all(promises);
        logger.debug(util.format('------->>> R E S P O N S E : %j', results));
        let response = results.pop(); //  orderer results are last in the results
        if (response.status === 'SUCCESS') {
          logger.info('Successfully sent transaction to the orderer.');
        } else {
          error_message = util.format('Failed to order the transaction. Error code: %s', response.status);
          logger.debug(error_message);
        }

        // now see what each of the event hubs reported
        for (let i in results) {
          let event_hub_result = results[i];
          let event_hub = event_hubs[i];
          logger.debug('Event results for event hub :%s', event_hub.getPeerAddr());
          if (typeof event_hub_result === 'string') {
            logger.debug(event_hub_result);
          } else {
            if (!error_message) error_message = event_hub_result.toString();
            logger.debug(event_hub_result.toString());
          }
        }
      } else {
        error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
        logger.debug(error_message);
      }
    } catch (error) {
      logger.error('Failed to send instantiate due to error: ' + error.stack ? error.stack : error);
      error_message = error.toString();
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to instantiate chaincode on peers :  \'' + this.peers + '\''
      }
    }

    if (!error_message) {
      let message = util.format(
        'Successfully instantiated chaincode in organization %s to the channel \'%s\'',
        this.orgName, channelName);
      logger.info(message);
      // build a response to send back to the REST caller
      return message;
    } else {
      let message = util.format('Failed to instantiate. cause:%s', error_message);
      logger.error(message);
      return {
        error: stackError.toString(),
        message: message
      }
    }
  }

}

module.exports = ChaincodeManager;