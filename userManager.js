'use strict';
var helper = require('./helper.js');
var logger = helper.getLogger('UserManager');
var hfc = require('fabric-client');
var util = require('util');



class UserManager {
  constructor() {}


  async getClientForOrg(userOrg, username) {
    try {
      logger.debug('getClientForOrg - ****** START %s %s', userOrg, username)
      // get a fabric client loaded with a connection profile for this org
      let config = '-connection-profile-path';

      let client = hfc.loadFromConfig(hfc.getConfigSetting('network' + config));

      await client.initCredentialStores();

      if (username) {
        let user = await client.getUserContext(username, true);
        if (!user) {
          return {
            error: util.format('User was not found :', username),
            message: "Please register new User First"
          }
        } else {
          logger.debug('User %s was found to be registered and enrolled', username);
        }
      }
      logger.debug('getClientForOrg - ****** END %s %s \n\n', userOrg, username)

      // let orgAdmin = hfc.getConfigSetting("orgAdmin");
      // const keyPEM2 = Buffer.from(fs.readFileSync(orgAdmin.keyAbsPath)).toString();
      // const certPEM2 = Buffer.from(fs.readFileSync(orgAdmin.certAbsPath)).toString();
      // client.setTlsClientCertAndKey(certPEM2, keyPEM2);
      return client;

    } catch (error) {
      logger.error('Failed to get ClientForOrg %s with error: %s', userOrg, error.toString());
      return {
        error: error.stack ? error.stack : error.toString(),
        message: "Failed to get Client For Org: " + userOrg
      }
    }
  }

}



module.exports = new UserManager()