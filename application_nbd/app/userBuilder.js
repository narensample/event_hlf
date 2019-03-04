var Fabric_Client = require('fabric-client');
var fabric_client = new Fabric_Client();
var path = require('path');
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
const Client = require('fabric-client');
const User = require('fabric-ca-client/lib/User');

// initiate a Class
class UserBuilder {
  constructor() {}
  //Create USer Object from provided certificates
  async create(enrollment, mspId, username) {
    return new Promise(async function(resolve, reject) {
      var store_path = path.join(__dirname, 'persistenceKeys');
      let state_store = await Fabric_Client.newDefaultKeyValueStore({
        path: store_path
      });
      fabric_client.setStateStore(state_store);
      //To store the certificates
      // var crypto_suite = Fabric_Client.newCryptoSuite();
      // var crypto_store = Fabric_Client.newCryptoKeyStore({
      //   path: store_path
      // });
      // crypto_suite.setCryptoKeyStore(crypto_store);
      // fabric_client.setCryptoSuite(crypto_suite);

      try {
        let result = await fabric_client.createUser({
          username: username,
          mspid: mspId,
          cryptoContent: {
            privateKeyPEM: enrollment.key,
            signedCertPEM: enrollment.certificate
          },
          skipPersistence: true //false create admin cert
        });
        return resolve(result);
      } catch (err) {
        return reject(err);
      }
    });

  }

  // Create User Object from certificate path
  async createUserFromCertificate(client, keyAbsPath, certAbsPath, storeLocation, username, mspId, userOrg) {
    var keyPEM = Buffer.from(fs.readFileSync(keyAbsPath)).toString();
    var certPEM = fs.readFileSync(certAbsPath);

    var cryptoSuite = Client.newCryptoSuite();
    if (userOrg) {
      cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({
        path: storeLocation
      }));
      client.setCryptoSuite(cryptoSuite);
    }

    return Promise.resolve(client.createUser({
      username: username,
      mspid: mspId,
      cryptoContent: {
        privateKeyPEM: keyPEM.toString(),
        signedCertPEM: certPEM.toString()
      }
    }));
  }
  readAllFiles(dir) {
    var files = fs.readdirSync(dir);
    var certs = [];
    files.forEach((file_name) => {
      let file_path = path.join(dir, file_name);
      let data = fs.readFileSync(file_path);
      certs.push(data);
    });
    return certs;
  }

  async createWithOutPersistance(enrollment, mspId, username) {

    return new Promise(async function(resolve, reject) {
      //validations
      if (!enrollment.key) throw new Error('Enrollment key not present');
      if (!enrollment.certificate) throw new Error('Enrollment certificate not present');
      if (!mspId) throw new Error('mspId not present');
      if (!username) throw new Error('username not present');

      try {
        const user = new User(username);
        await user.setEnrollment(enrollment.key, enrollment.certificate, mspId)
        return resolve(user);
      } catch (err) {
        return reject(err);
      }
    });
  }

}

// exporting all functions
module.exports = new UserBuilder()

//--- Another way working ---
//const User = require('fabric-ca-client/lib/User');
// return new Promise(async function(resolve, reject) {
//   //validations
//   if (!enrollment.key) throw new Error('Enrollment key not present');
//   if (!enrollment.certificate) throw new Error('Enrollment certificate not present');
//   if (!mspId) throw new Error('mspId not present');
//   if (!username) throw new Error('username not present');
//
//   try {
//     const user = new User(username);
//     await user.setEnrollment(enrollment.key, enrollment.certificate, mspId)
//     return resolve(user);
//   } catch (err) {
//     return reject(err);
//   }
// });
//--- Another way working ---