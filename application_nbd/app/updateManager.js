var util = require('util');
var fs = require('fs');
var path = require('path');
var User = require('./userManager.js');
var helper = require('./helper.js');
var logger = helper.getLogger('UpdateManager');
var hfc = require('fabric-client');
const utils = require('fabric-client/lib/utils.js');
const superagent = require('superagent');
const agent = require('superagent-promise')(require('superagent'), Promise);
const requester = require('request');



class UpdateManager {

  constructor(channelName, orgName) {
    this.channelName = channelName;
    this.orgName = orgName;
    var client = null;
    var channel = null;
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

  async updateAnchorPeers() {
    logger.debug('\n====== Update Anchor Peers for gossip communication  \'' + this.channelName + '\' ======\n');
    try {

      if (this.client.error) {
        return this.client;
      }

      // read in the channelConfig_envelop for the channel config raw bytes
      const channelConfig_envelop = fs.readFileSync(path.join(__dirname, "../crypto/" + this.orgName + "Anchors" + ".tx"));
      // extract the channel config bytes from the envelope to be signed
      var channelConfig = this.client.extractChannelConfig(channelConfig_envelop);

      //Acting as a client in the given organization provided with "orgName" param
      // sign the channel config bytes as "endorsement", this is required by
      // the orderer's channel creation policy
      // this will use the admin identity assigned to the client when the connection profile was loaded
      let signature = this.client.signChannelConfig(channelConfig);
      let request = {
        config: channelConfig,
        signatures: [signature],
        name: this.channelName,
        txId: this.client.newTransactionID(true) // get an admin based transactionID
      };

      console.log(request)

      // send to orderer
      var response = await this.client.updateChannel(request)
      logger.debug(' response ::%j', response);
      if (response && response.status === 'SUCCESS') {
        logger.debug('Successfully updateAnchorPeers.');
        let response = {
          success: true,
          message: 'updateAnchorPeers to the  \'' + this.channelName + '\'  has been updated Successfully'
        };
        return response;
      } else {
        logger.error('\n!!!!!!!!! Failed to update AnchorPeers \'' + this.channelName +
          '\' !!!!!!!!!\n\n');
        return {
          error: response,
          message: 'Failed to update AnchorPeers channel \'' + this.channelName + '\''
        }
      }
    } catch (err) {
      logger.error('Failed to update AnchorPeers to the channel: ' + err.stack ? err.stack : err);
      return {
        error: err.stack ? err.stack : err,
        message: 'Failed to update AnchorPeers channel: \'' + this.channelName + '\''
      }
    }
  }

}


module.exports = UpdateManager