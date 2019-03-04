'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('tristar-blockchain-webserver');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var cors = require('cors');
var hfc = require('fabric-client');
var debug = require('debug')('secure:server');
var path = require('path');
var fs = require('fs');
var swaggerUi = require('swagger-ui-express'),
  swaggerDocument = require('./api/swagger/swagger.json');


//////////////////////////////// SET SDK CONFIGURATONS ////////////////////////////
var file = 'network-config%s.json';
file = util.format(file, '');


if (fs.existsSync(path.join(__dirname, file))) {
  hfc.setConfigSetting('network-connection-profile-path', path.join(__dirname, file));
}
if (fs.existsSync(path.join(__dirname, 'config.json'))) {
  hfc.addConfigFile(path.join(__dirname, 'config.json'));
}
//////////////////////////////// END CONFIGURATONS ////////////////////////////



require('./app/eventListner');


///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());

//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
  extended: false
}));


//swaggerUi
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var host = "localhost" || hfc.getConfigSetting('host');
var port = normalizePort(4003 || hfc.getConfigSetting('port'));
app.set('port', port);
var server = http.createServer(app).listen(port);
logger.info('@@@@@@@@@@@@@@@ SERVER STARTED @@@@@@@@@@@@@@@@@@');
logger.info('---------------  http://%s:%s  -----------------', host, port);
server.timeout = 240000;
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ?
    'Pipe ' + port :
    'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ?
    'pipe ' + addr :
    'port ' + addr.port;
  debug('Listening on ' + bind);
}
//////////////////////////////// END START SERVER /////////////////////////////////


//routes
var routes = require('./api/routes');
app.use('/', routes);

/*
Error Handlers
*/
app.use((req, res, next) => {
  const error = new Error("Requested Route is Not Found");
  error.status = 404;
  next(error);

})
app.use((error, req, res, next) => {
  res.status(error.ststus || 500);
  res.json({
    error: {
      message: error.message
    }
  })
})