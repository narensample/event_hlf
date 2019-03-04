const hfc = require('fabric-client');
const Promise = require("bluebird");
const helper = require('./helper.js');
const User = require('./userManager.js');
const peerName = hfc.getConfigSetting('peerName');
const orgName = hfc.getConfigSetting('orgName');
const channelName = hfc.getConfigSetting('channelName');
const logger = helper.getLogger('chaincodeEventHelper');
const EventEmitter = require("events").EventEmitter;
const ee = new EventEmitter();


class EventsManager {

  constructor() {}

  async chaincodeEventListner(orgName, peerName) {
    var client = await User.getClientForOrg(orgName)
    var channel = client.getChannel(channelName);
    var channel_event_hub = channel.newChannelEventHub(peerName);
    channel_event_hub.registerChaincodeEvent("invoice", '^invoice_approved*',
      (event, block_num, txnid, status) => {
        ee.emit("newEvent", event, block_num, txnid, status);

      }, (error) => {
        logger.error('\n [Event] Failed to receive the chaincode event ::' + error);
      });
    channel_event_hub.connect(true);
  }


}

const eventsManager = new EventsManager();

eventsManager.chaincodeEventListner(orgName, peerName);
ee.on("newEvent", function(event, block_num, txnid, status) {
  let event_payload = event.payload.toString('utf8');
  console.log('WE GOT AN EVENT HERE\n ' + event_payload)
});
