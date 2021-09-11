var redis = require('./redis')

module.exports = {
  cacheTargets,
  getCachedTargets,
  cacheTargetsRemainingAccepts,
  getCachedTargetsRemainingAccepts
}

function cacheTargets (targets) {
  return new Promise((resolve, reject) => {
    redis.SET('targets', targets, (error, data) => {
      if (error) return reject(error)

      return resolve(data)
    })
  })
}

function getCachedTargets () {
  return new Promise((resolve, reject) => {
    redis.GET('targets', (error, data) => {
      if (error) return reject(error)

      return resolve(JSON.parse(data))
    })
  })
}

function cacheTargetsRemainingAccepts (remainingAccepts) {
  var todayEnd = new Date().setHours(23, 59, 59, 999) - new Date()

  return new Promise((resolve, reject) => {
    redis.SETEX('targetsRemainingAccepts', parseInt(todayEnd / 1000), remainingAccepts, (error, data) => {
      if (error) return reject(error)

      return resolve(data)
    })
  })
}

function getCachedTargetsRemainingAccepts () {
  return new Promise((resolve, reject) => {
    redis.GET('targetsRemainingAccepts', (error, data) => {
      if (error) return reject(error)

      return resolve(JSON.parse(data))
    })
  })
}
