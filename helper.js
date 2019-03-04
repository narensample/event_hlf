var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');
var hfc = require('fabric-client');

class Helper {
  constructor() {}

  getLogger(moduleName) {
    var logger = log4js.getLogger(moduleName);
    logger.setLevel('DEBUG');
    return logger;
  };
  setupChaincodeDeploy() {
    process.env.GOPATH = hfc.getConfigSetting('CC_SRC_PATH');
  };
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

}
module.exports = new Helper()