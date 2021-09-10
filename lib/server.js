var URL = require('url')
var http = require('http')
var cuid = require('cuid')
var Corsify = require('corsify')
var sendJson = require('send-data/json')
var ReqLogger = require('req-logger')
var healthPoint = require('healthpoint')
var HttpHashRouter = require('http-hash-router')

var redis = require('./redis')
var version = require('../package.json').version

var router = HttpHashRouter()
var logger = ReqLogger({ version: version })
var health = healthPoint({ version: version }, redis.healthCheck)
var cors = Corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, accept, content-type'
})

router.set('/favicon.ico', empty)
router.set('/api/target/post', (req, res) => createTargetController(req, res))
router.set('/api/target/get', (req, res) => getTargetsController(req, res))
router.set('/api/target/get/:id', (req, res, opts) => getTargetController(req, res, opts))
router.set('/api/target/post/:id', (req, res, opts) => updateTargetController(req, res, opts))
router.set('/route/post', (req, res) => makeDecisionController(req, res))

module.exports = function createServer () {
  return http.createServer(cors(handler))
}

function handler (req, res) {
  if (req.url === '/health') return health(req, res)

  req.id = cuid()
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email
  })
  router(req, res, { query: getQuery(req.url) }, onError.bind(null, req, res))
}

function onError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  var logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function empty (req, res) {
  res.writeHead(204)
  res.end()
}

function getQuery (url) {
  return URL.parse(url, true).query // eslint-disable-line
}

// CONTROLLERS
async function getTargetsController (req, res) {
  var targets = await getCachedTargets()
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
  var targets = await getCachedTargets()

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
    var parsedTarget = JSON.parse(payload)
    var targets = await getCachedTargets()

    if (targets) {
      parsedTarget.id = targets.length + 1
      targets.push(parsedTarget)

      await cacheTargets(JSON.stringify(targets))
    } else {
      parsedTarget.id = 1
      var newTargets = [parsedTarget]

      await cacheTargets(JSON.stringify(newTargets))
    }

    res.statusCode = 201
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
    var targets = await getCachedTargets()

    if (targets && targets.length) {
      var target = targets.filter(target => target.id === Number(opts.params.id))

      if (target.length) {
        var updatedTargets = targets.map(target => {
          if (target.id === Number(opts.params.id)) {
            target = updatedTarget
          }

          return target
        })

        await cacheTargets(JSON.stringify(updatedTargets))

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
    var targets = await getCachedTargets()
    var visitedHour = new Date(parsedVisitor.timestamp).getUTCHours().toString()
    var sortedTargets = sortTargetsByHighestValue(targets, parsedVisitor, visitedHour)

    if (sortedTargets.length) {
      for (var target of sortedTargets) {
        var result = await decreaseTargetRemainingAccepts(target)

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

// REDIS HELPERS
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
  var todayEnd = new Date().setHours(23, 59, 59, 999)

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

// GENERAL HELPERS
function sortTargetsByHighestValue (targets, parsedVisitor, visitedHour) {
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
  } else {
    return []
  }
}

async function decreaseTargetRemainingAccepts (target) {
  var targets = await getCachedTargetsRemainingAccepts()

  if (!targets) {
    var newTargets = [{ targetId: target.id, remainingAccepts: Number(target.maxAcceptsPerDay) - 1 }]

    await cacheTargetsRemainingAccepts(JSON.stringify(newTargets))

    return 'decreased'
  }

  var targetExists = targets.filter(existingTarget => existingTarget.targetId === target.id)

  if (!targetExists.length) {
    var newTarget = { targetId: target.id, remainingAccepts: Number(target.maxAcceptsPerDay) - 1 }

    targets.push(newTarget)

    await cacheTargetsRemainingAccepts(JSON.stringify(targets))

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

    await cacheTargetsRemainingAccepts(JSON.stringify(updatedTargets))

    return 'decreased'
  }

  return 'expired'
}
