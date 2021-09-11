var sendJson = require('send-data/json')

var redisHelpers = require('./redis.helpers')

module.exports = {
  sortTargetsByHighestValue,
  decreaseTargetRemainingAccepts,
  sendErrorResponse
}

function sortTargetsByHighestValue (targets, parsedVisitor, visitedHour) {
  if (!targets) return []

  var validTargets = targets.filter(target => {
    if (target.accept.geoState.$in.includes(parsedVisitor.geoState) &&
      target.accept.hour.$in.includes(visitedHour)) {
      return target
    }
  })

  if (validTargets.length) {
    var sortedTargets = validTargets.sort((a, b) => {
      if (Number(a.value) > Number(b.value)) {
        return -1
      }
    })

    return sortedTargets
  }

  return []
}

async function decreaseTargetRemainingAccepts (target) {
  var targets = await redisHelpers.getCachedTargetsRemainingAccepts()

  if (!targets) {
    var newTargets = [{ targetId: target.id, remainingAccepts: Number(target.maxAcceptsPerDay) - 1 }]

    await redisHelpers.cacheTargetsRemainingAccepts(JSON.stringify(newTargets))

    return 'decreased'
  }

  var targetExists = targets.filter(existingTarget => existingTarget.targetId === target.id)

  if (!targetExists.length) {
    var newTarget = { targetId: target.id, remainingAccepts: Number(target.maxAcceptsPerDay) - 1 }

    targets.push(newTarget)

    await redisHelpers.cacheTargetsRemainingAccepts(JSON.stringify(targets))

    return 'decreased'
  }

  if (targetExists[0].remainingAccepts > 0) {
    targetExists[0].remainingAccepts = targetExists[0].remainingAccepts - 1

    var updatedTargets = targets.map(target => {
      if (target.id === Number(targetExists[0].targetId)) {
        target = targetExists[0]
      }

      return target
    })

    await redisHelpers.cacheTargetsRemainingAccepts(JSON.stringify(updatedTargets))

    return 'decreased'
  }

  return 'expired'
}

function sendErrorResponse (req, res, message) {
  res.statusCode = 500
  return sendJson(req, res, {
    message: 'Could not process the data',
    error: message
  })
}
