// initiate a Class

class CustomResponse {
  constructor() {}

  // Getter
  get getResponse() {
    return this.makeResponse()
  }

  setResponse(res, successStatus, status, message, appVersion, result, platformstatus = 200) {
    this.res = res
    this.successStatus = successStatus
    this.status = status
    this.message = message
    this.appVersion = appVersion
    this.result = result
    this.platformstatus = platformstatus

    this.makeResponse()
  }

  // Method
  makeResponse() {
    this.res.set('Access-Control-Allow-Origin', '*')
    this.res.statusMessage = this.message
    this.res.status(this.status).send({
      'status': this.successStatus,
      'code': this.status,
      'platformstatus': this.platformstatus,
      'message': this.message,
      'appVersion': this.appVersion,
      'result': (this.result === null || this.result === 'null' || this.result === '') ? [] : this.result
    })
  }
}

// exporting all functions
module.exports = new CustomResponse()