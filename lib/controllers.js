var sendJson = require('send-data/json')

var redisHelpers = require('./redis.helpers')
var generalHelpers = require('./general.helpers')

module.exports = {
  getTargetsController,
  getTargetController,
  createTargetController,
  updateTargetController,
  makeDecisionController
}

async function getTargetsController (req, res) {
  var targets = await redisHelpers.getCachedTargets()
  res.statusCode = 200

  if (targets && targets.length) {
    return sendJson(req, res, {
      message: 'Targets retrieved',
      data: targets
    })
  }

  return sendJson(req, res, {
    message: 'No targets',
    data: []
  })
}

async function getTargetController (req, res, opts) {
  var targets = await redisHelpers.getCachedTargets()

  if (targets && targets.length) {
    var target = targets.filter(target => target.id === Number(opts.params.id))

    if (target.length) {
      return sendJson(req, res, {
        message: 'Target retrieved',
        data: target[0]
      })
    }
  }

  res.statusCode = 404
  return sendJson(req, res, {
    message: 'Target not found'
  })
}

function createTargetController (req, res) {
  var payload = ''

  req.on('data', chunk => {
    payload += chunk
  })

  req.on('end', async () => {
    res.statusCode = 201
    var parsedTarget = JSON.parse(payload)
    var targets = await redisHelpers.getCachedTargets()

    if (targets) {
      parsedTarget.id = targets.length + 1
      targets.push(parsedTarget)

      await redisHelpers.cacheTargets(JSON.stringify(targets))

      return sendJson(req, res, {
        message: 'Target created',
        data: parsedTarget
      })
    }

    parsedTarget.id = 1
    var newTargets = [parsedTarget]

    await redisHelpers.cacheTargets(JSON.stringify(newTargets))

    return sendJson(req, res, {
      message: 'Target created',
      data: parsedTarget
    })
  })
}

function updateTargetController (req, res, opts) {
  var payload = ''

  req.on('data', chunk => {
    payload += chunk
  })

  req.on('end', async () => {
    var updatedTarget = JSON.parse(payload)
    var targets = await redisHelpers.getCachedTargets()

    if (targets && targets.length) {
      var target = targets.filter(target => target.id === Number(opts.params.id))

      if (target.length) {
        var updatedTargets = targets.map(target => {
          if (target.id === Number(opts.params.id)) {
            target = updatedTarget
          }

          return target
        })

        await redisHelpers.cacheTargets(JSON.stringify(updatedTargets))

        res.statusCode = 200
        return sendJson(req, res, {
          message: 'Target updated',
          data: updatedTarget
        })
      }
    }

    res.statusCode = 404
    return sendJson(req, res, {
      message: 'Target not found'
    })
  })
}

function makeDecisionController (req, res) {
  var body = ''

  req.on('data', chunk => {
    body += chunk
  })

  req.on('end', async () => {
    var parsedVisitor = JSON.parse(body)
    var targets = await redisHelpers.getCachedTargets()
    var visitedHour = new Date(parsedVisitor.timestamp).getUTCHours().toString()
    var sortedTargets = generalHelpers.sortTargetsByHighestValue(targets, parsedVisitor, visitedHour)

    if (sortedTargets.length) {
      for (var target of sortedTargets) {
        var result = await generalHelpers.decreaseTargetRemainingAccepts(target)

        if (result === 'decreased') {
          res.statusCode = 200
          return sendJson(req, res, { url: target.url })
        }
      }
    }

    res.statusCode = 404
    return sendJson(req, res, { decision: 'reject' })
  })
}
