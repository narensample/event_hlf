'use strict';
var helper = require('./helper.js');
var logger = helper.getLogger('UserManager');
var userBuilder = require('./userBuilder');
var hfc = require('fabric-client');
var fs = require('fs');
var path = require('path');
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



  async getRegisteredUser(username, userOrg, isJson) {
    try {
      var client = await this.getClientForOrg(userOrg);

      if (client.error) {
        return client
      }

      logger.debug('Successfully initialized the credential stores');
      // client can now act as an agent for organization Org1
      // first check to see if the user is already enrolled
      var user = await client.getUserContext(username, true);
      if (user && user.isEnrolled()) {
        logger.info('Successfully loaded member from persistence');
      } else {
        // user was not enrolled, so we will need an admin user object to register
        logger.info('User %s was not enrolled, so we will need an admin user object to register', username);
        var admins = hfc.getConfigSetting('admins');
        let adminUserObj = await client.setUserContext({
          username: admins.username,
          password: admins.secret
        });
        let caClient = client.getCertificateAuthority();

        let affiliationService = caClient.newAffiliationService();
        // Check if organization exists
        let registeredAffiliations = await affiliationService.getAll(adminUserObj);
        if (!registeredAffiliations.result.affiliations.some(x => x.name == userOrg.toLowerCase())) {
          let affiliation = userOrg.toLowerCase() + '.department1';
          await affiliationService.create({
            name: affiliation,
            force: true
          }, adminUserObj);
        }

        var secret = await caClient.register({
          enrollmentID: username,
          affiliation: userOrg.toLowerCase(),
          maxEnrollments: -1,
          attrs: [{
            "admin": "true:ecert"
          }]
        }, adminUserObj);
        let request = {
          enrollmentID: username,
          enrollmentSecret: secret,
          profile: 'tls'
        };
        let enrollment = await caClient.enroll(request)
        // Successfully called the Certificate Authority to get the TLS material
        let key = enrollment.key.toBytes();
        let cert = enrollment.certificate;


        //////////////////////////////////orderer/peer with CLIENT TLS - TRUE ///////////////////////////
        client.setTlsClientCertAndKey(cert, key);
        //////////////////////////////////orderer/peer with CLIENT TLS - TRUE ///////////////////////////

        logger.debug('Successfully got the secret for user %s', username);
        user = await client.setUserContext({
          username: username,
          password: secret,
          profile: 'tls'
        });
        logger.debug('Successfully enrolled username %s  and setUserContext on the client object', username);
      }
      if (user && user.isEnrolled) {
        if (isJson && isJson === true) {
          var response = {
            secret: secret,
            message: username + ' has been enrolled Successfully to Org: ' + userOrg,
          };
          return response;
        }
      } else {
        return {
          error: 'User was not enrolled ',
          message: "Failed to register & enroll new User: " + username + " to Org:" + userOrg
        }
      }
    } catch (error) {
      logger.error('Failed to get registered user: %s with error: %s', username, error.toString());
      return {
        error: error.stack ? error.stack : error.toString(),
        message: "Failed to register & enroll new User:" + username + " to Org:" + userOrg
      }
    }

  };


}



module.exports = new UserManager()