'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var helper = require('./helper.js');
var logger = helper.getLogger('FabOpsManager');
var User = require('./userManager.js');

class FabOpsManager {

  constructor(channelName, orgName, userName) {
    this.channelName = channelName;
    this.orgName = orgName;
    this.userName = userName;
    var client = null;
    var channel = null;
  }


  async initialize() {
    try { // first setup the client for this org
      this.client = await User.getClientForOrg(this.orgName, this.userName);
      if (this.client.error)
        return this.client;
      logger.debug('Successfully got the fabric client for the organization "%s"', this.orgName);
      this.channel = this.client.getChannel(this.channelName);
    } catch (error) {
      logger.error('Failed to initialize due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to initialize'
      }
    }
  }
  async invokeChaincode(fcn, args, chaincodeName, targets) {
    logger.debug(util.format('\n============ invoke transaction on channel %s ============\n', this.channelName));
    var error_message = null;
    var tx_id_string = null;
    var stackError = null;
    try {
      if (this.client.error) {
        return this.client;
      }
      var newArgs = JSON.stringify(args[0]);
      var tx_id = this.client.newTransactionID();
      // will need the transaction ID string for the event registration later
      tx_id_string = tx_id.getTransactionID();
      var request = {
        chaincodeId: chaincodeName,
        fcn: fcn,
        args: [newArgs],
        //args: args,
        chainId: this.channelName,
        txId: tx_id
      };
      if (targets)
        request.targets = targets;

      let results = await this.channel.sendTransactionProposal(request);
      var proposalResponses = results[0];
      var proposal = results[1];
      var all_good = true;
      for (var i in proposalResponses) {
        let one_good = false;
        if (proposalResponses && proposalResponses[i].response &&
          proposalResponses[i].response.status === 200) {
          one_good = true;
          logger.info('invoke chaincode proposal was good');
        } else {
          stackError = proposalResponses;
          logger.error('invoke chaincode proposal was bad');
        }
        all_good = all_good & one_good;
      }

      if (all_good) {
        logger.info(util.format(
          'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
          proposalResponses[0].response.status, proposalResponses[0].response.message,
          proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
        var promises = [];
        let event_hubs = this.channel.getChannelEventHubsForOrg();
        event_hubs.forEach((eh) => {
          logger.debug('invokeEventPromise - setting up event');
          let invokeEventPromise = new Promise((resolve, reject) => {
            let event_timeout = setTimeout(() => {
              let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
              logger.error(message);
              eh.disconnect();
            }, 3000);
            eh.registerTxEvent(tx_id_string, (tx, code, block_num) => {
              logger.info('The chaincode invoke chaincode transaction has been committed on peer %s', eh.getPeerAddr());
              logger.info('Transaction %s has status of %s in block %s', tx, code, block_num);
              clearTimeout(event_timeout);

              if (code !== 'VALID') {
                let message = util.format('The invoke chaincode transaction was invalid, code:%s', code);
                logger.error(message);
                reject(new Error(message));
              } else {
                let message = 'The invoke chaincode transaction was valid.';
                logger.info(message);
                resolve(message);
              }
            }, (err) => {
              clearTimeout(event_timeout);
              logger.error(err);
              reject(err);
            }, {
              unregister: true,
              disconnect: true
            });
            eh.connect();
          });
          promises.push(invokeEventPromise);
        });

        var orderer_request = {
          txId: tx_id,
          proposalResponses: proposalResponses,
          proposal: proposal
        };
        var sendPromise = this.channel.sendTransaction(orderer_request);
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
      logger.error('Failed to invoke due to error: ' + error.stack ? error.stack : error);
      stackError = error.stack ? error.stack : error
      error_message = error.toString();
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to invoke chaincode \'' + chaincodeName + '\''
      }
    }

    if (!error_message) {
      let message = util.format(
        'Successfully invoked the chaincode %s to the channel \'%s\' for transaction ID: %s',
        this.userName, this.channelName, tx_id_string);
      logger.info(message);

      return tx_id_string;
    } else {
      let message = util.format('Failed to invoke chaincode. cause:%s', error_message);
      logger.error(message);
      return {
        error: stackError.toString(),
        message: message
      }
    }
  }


  async queryChaincode(fcn, args, chaincodeName, targets) {

    try {
      if (this.client.error) {
        return this.client;
      }
      // send query
      var request = {
        chaincodeId: chaincodeName,
        fcn: fcn,
        args: args
      };

      if (targets)
        request.targets = targets;
      let response_payloads = await this.channel.queryByChaincode(request);
      //console.log(Object.keys(response_payloads).length == 0 && response_payloads.constructor == Object)
      if (response_payloads[0].toString('utf8') == '') {
        logger.error('response_payloads is null');
        return {
          error: 'Error has been occured in chaincode Please check ',
          message: response_payloads[0].toString('utf8')
        }
      } else if (response_payloads[0] instanceof Error) {
        return {
          error: 'Record does not exist  |  response_payload is null',
          message: 'No results from ledger'
        }
      } else {
        for (let i = 0; i < response_payloads.length; i++) {
          logger.info(response_payloads[i].toString('utf8'));
        }
        return response_payloads[0].toString('utf8');
      }
    } catch (error) {
      logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to query chaincode \'' + chaincodeName + '\''
      }
    }

  }
  async getChaincodeDetails(type, chaincodeName, peer) {
    try {
      if (this.client.error) {
        return this.client;
      }

      logger.debug('Successfully got the fabric client for the organization "%s"', this.orgName);

      let response = null
      if (type === 'installed') {
        response = await this.client.queryInstalledChaincodes(peer, true); //use the admin identity
      } else {
        response = await this.channel.queryInstantiatedChaincodes(peer, true); //use the admin identity
      }
      if (response) {
        if (type === 'installed') {
          logger.debug('<<< Installed Chaincodes >>>');
        } else {
          logger.debug('<<< Instantiated Chaincodes >>>');
        }
        if (chaincodeName) {
          var details = [];
          for (let i = 0; i < response.chaincodes.length; i++) {
            logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
              response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
            );
            details.push('name: ' + response.chaincodes[i].name + ', version: ' +
              response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
            );
            if (response.chaincodes[i].name == chaincodeName) {
              logger.info(details);
              return true
            }
          }
          logger.info(details);
          return false;
        } else {
          var details = [];
          for (let i = 0; i < response.chaincodes.length; i++) {
            logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
              response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
            );
            details.push('name: ' + response.chaincodes[i].name + ', version: ' +
              response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
            );
          }
          return details;
        }
      } else {
        logger.error('response is null');
        return 'response is null';
      }
    } catch (error) {
      logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to query chaincode details \'' + chaincodeName + '\''
      }
    }
  }

  async getTransactionByID(trxnID, peer) {
    try {
      if (this.client.error) {
        return this.client;
      }
      let response_payload = await this.channel.queryTransaction(trxnID, peer);
      if (response_payload) {
        logger.debug(response_payload);
        return response_payload;
      } else {
        logger.error('response_payload is null');
        return 'response_payload is null';
      }
    } catch (error) {
      logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to query trxnID \'' + trxnID + '\''
      }
    }
  }

}


module.exports = FabOpsManager;



// var check = {
//   InvoiceId: '1234',
//   Issuer: 'sam',
//   Owner: 'Naren',
//   IssueDate: 'fff',
//   MaturityDate: 'ffggg',
//   FaceValue: 1113333.3333,
//   CurrentState: 'issued'
// }
// var sam = [JSON.stringify(check)];