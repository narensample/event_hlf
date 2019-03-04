var util = require('util');
var fs = require('fs');
var path = require('path');
var User = require('./userManager.js');
var helper = require('./helper.js');
var logger = helper.getLogger('ChannelManager');
var hfc = require('fabric-client');



class ChannelManager {
  constructor(channelName, orgName) {
    this.channelName = channelName;
    this.orgName = orgName;
    var client = null;
    var channel = null;
  }
  async initializeClient() {
    try { // first setup the client for this org
      this.client = await User.getClientForOrg(this.orgName, this.userName);
      logger.debug('Successfully got the fabric client for the organization "%s"', this.orgName);
    } catch (error) {
      logger.error('Failed to initialize due to error: ' + error.stack ? error.stack : error);
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to initializeClient'
      }
    }
  }
  async initialize() {
    try { // first setup the client for this org
      this.client = await User.getClientForOrg(this.orgName, this.userName);
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
  async createChannel() {
    logger.debug('\n====== Creating Channel \'' + this.channelName + '\' ======\n');
    try {
      if (this.client.error) {
        return this.client;
      }
      // read in the envelope for the channel config raw bytes
      var envelope = fs.readFileSync(path.join(__dirname, "../crypto/" + this.channelName + ".tx"));
      // extract the channel config bytes from the envelope to be signed
      var channelConfig = this.client.extractChannelConfig(envelope);
      logger.info("Extracted channelConfig from channel.tx  " + channelConfig);
      /*
      sign the channel config bytes as "endorsement", this is required by
      the orderer's channel creation policy
      this will use the admin identity assigned to the client when the connection profile was loaded
      */
      let signature = this.client.signChannelConfig(channelConfig);
      logger.info("successfully signed with admin Identityprovided in connection Profile " + signature);
      let request = {
        config: channelConfig,
        signatures: [signature],
        name: this.channelName,
        txId: this.client.newTransactionID(true) // get an admin based transactionID
      };
      logger.info("with complete request Object, we are going to request Orderer to create a channel " + request);
      // send to orderer
      var response = await this.client.createChannel(request)
      logger.debug(' response ::%j', response);
      if (response && response.status === 'SUCCESS') {
        logger.info('Successfully created the channel.');
        let response = {
          success: true,
          message: 'Channel \'' + this.channelName + '\' has been created Successfully'
        };
        return response;
      } else {
        logger.error('\n!!----- Failed to create the channel ------ \'' + this.channelName +
          '\' !!\n\n');
        return {
          error: response,
          message: 'Failed to create the channel \'' + this.channelName + '\''
        }
      }
    } catch (err) {
      logger.error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
      return {
        error: err.stack ? err.stack : err,
        message: 'Failed to create the channel:  \'' + this.channelName + '\''
      }
    }
  }
  async joinChannel(peers) {
    logger.debug('\n\n============ Join Channel start ============\n')
    var error_message = null;
    var all_eventhubs = [];
    var stackError = null;
    try {

      if (this.client.error) {
        return this.client;
      }

      logger.info('Calling peers in organization "%s" to join the channel', this.orgName);

      if (peers.length == 1) {
        peers = peers[0];
      }
      /*
      next step is to get the genesis_block from the orderer,
      the starting point for the channel that we want to join
      */
      let request = {
        txId: this.client.newTransactionID(true) //get an admin based transactionID
      };
      let genesis_block = await this.channel.getGenesisBlock(request);
      /*
      tell each peer to join and wait for the event hub of each peer to tell us
      that the channel has been created on each peer
      */
      var promises = [];
      promises.push(new Promise(resolve => setTimeout(resolve, 10000)));
      let join_request = {
        targets: peers, //using the peer names which only is allowed when a connection profile is loaded
        txId: this.client.newTransactionID(true), //get an admin based transactionID
        block: genesis_block
      };
      let join_promise = this.channel.joinChannel(join_request, 30000);
      promises.push(join_promise);
      let results = await Promise.all(promises);
      logger.debug(util.format('Join Channel R E S P O N S E : %j', results));

      // lets check the results of sending to the peers which is last in the results array
      let peers_results = results.pop();
      // then each peer results
      for (let i in peers_results) {
        let peer_result = peers_results[i];
        if (peer_result.response && peer_result.response.status == 200) {
          logger.info('Successfully joined peer to the channel %s', this.channelName);
        } else {
          stackError = peer_result;
          let message = util.format('Failed to joined peer to the channel %s', this.channelName);
          error_message = message;
          logger.error(message);
        }
      }

    } catch (error) {
      logger.error('Failed to join channel due to error: ' + error.stack ? error.stack : error);
      error_message = error.toString();
      return {
        error: error.stack ? error.stack : error,
        message: 'Failed to join channel \'' + this.channelName + '\''
      }
    }

    // need to shutdown open event streams
    all_eventhubs.forEach((eh) => {
      eh.disconnect();
    });

    if (!error_message) {
      let message = util.format(
        'Successfully joined peers in organization %s to the channel:%s',
        this.orgName, this.channelName);
      logger.info(message);
      // build a response to send back to the REST caller
      let response = {
        success: true,
        message: message
      };
      return response;
    } else {
      let message = util.format('Failed to join all peers to channel. cause:%s', error_message);
      logger.error(message);
      return {
        error: stackError.toString(),
        message: message
      }
    }
  }

}


module.exports = ChannelManager