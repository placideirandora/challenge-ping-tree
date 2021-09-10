process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('get targets endpoint - no targets', function (t) {
  var url = 'api/target/get'
  var options = { encoding: 'json', method: 'GET' }

  servertest(server(), url, options, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.data.length, 0, 'no targets')
    t.end()
  })
})

test.serial.cb('create target endpoint - first target', function (t) {
  var url = '/api/target/post'
  var options = { encoding: 'json', method: 'POST' }
  var newTarget = {
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: [
          'ca',
          'ny'
        ]
      },
      hour: {
        $in: [
          '13',
          '14',
          '15'
        ]
      }
    }
  }

  var expected = {
    message: 'Target created',
    data: {
      url: 'http://example.com',
      value: '0.50',
      maxAcceptsPerDay: '10',
      accept: {
        geoState: {
          $in: [
            'ca',
            'ny'
          ]
        },
        hour: {
          $in: [
            '13',
            '14',
            '15'
          ]
        }
      },
      id: 1
    }
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(newTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 201, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('create target endpoint - second target', function (t) {
  var url = '/api/target/post'
  var options = { encoding: 'json', method: 'POST' }
  var newTarget = {
    url: 'http://example.com',
    value: '1.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: [
          'il',
          'md'
        ]
      },
      hour: {
        $in: [
          '17',
          '18',
          '19'
        ]
      }
    }
  }

  var expected = {
    message: 'Target created',
    data: {
      url: 'http://example.com',
      value: '1.50',
      maxAcceptsPerDay: '10',
      accept: {
        geoState: {
          $in: [
            'il',
            'md'
          ]
        },
        hour: {
          $in: [
            '17',
            '18',
            '19'
          ]
        }
      },
      id: 2
    }
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(newTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 201, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('get target endpoint - target available', function (t) {
  var url = '/api/target/get/1'
  var options = { encoding: 'json', method: 'GET' }

  var expected = {
    message: 'Target retrieved',
    data: {
      url: 'http://example.com',
      value: '0.50',
      maxAcceptsPerDay: '10',
      accept: {
        geoState: {
          $in: [
            'ca',
            'ny'
          ]
        },
        hour: {
          $in: [
            '13',
            '14',
            '15'
          ]
        }
      },
      id: 1
    }
  }

  servertest(server(), url, options, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  })
})

test.serial.cb('get target endpoint - target not found', function (t) {
  var url = '/api/target/get/3'
  var options = { encoding: 'json', method: 'GET' }

  var expected = {
    message: 'Target not found'
  }

  servertest(server(), url, options, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 404, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  })
})

test.serial.cb('get targets endpoint - targets available', function (t) {
  var url = '/api/target/get'
  var options = { encoding: 'json', method: 'GET' }

  servertest(server(), url, options, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.data.length, 2, 'targets available')
    t.end()
  })
})

test.serial.cb('update target endpoint - target available', function (t) {
  var url = '/api/target/post/1'
  var options = { encoding: 'json', method: 'POST' }
  var updatedTarget = {
    url: 'http://hello.com',
    value: '2.50',
    maxAcceptsPerDay: '18',
    accept: {
      geoState: {
        $in: [
          'fl',
          'or'
        ]
      },
      hour: {
        $in: [
          '14',
          '15',
          '16'
        ]
      }
    },
    id: 1
  }

  var expected = {
    message: 'Target updated',
    data: updatedTarget
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(updatedTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('update target endpoint - target not available', function (t) {
  var url = '/api/target/post/3'
  var options = { encoding: 'json', method: 'POST' }
  var updatedTarget = {
    url: 'http://hello.com',
    value: '2.50',
    maxAcceptsPerDay: '18',
    accept: {
      geoState: {
        $in: [
          'fl',
          'or'
        ]
      },
      hour: {
        $in: [
          '14',
          '15',
          '16'
        ]
      }
    },
    id: 1
  }

  var expected = {
    message: 'Target not found'
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(updatedTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 404, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('visitor endpoint - first request accepted ', function (t) {
  var url = '/route/post'
  var options = { encoding: 'json', method: 'POST' }

  var expected = {
    url: 'http://hello.com'
  }
  var visitor = {
    geoState: 'fl',
    publisher: 'abc',
    timestamp: '2018-07-19T15:28:59.513Z'
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('visitor endpoint - second request accepted', function (t) {
  var url = '/route/post'
  var options = { encoding: 'json', method: 'POST' }

  var expected = {
    url: 'http://example.com'
  }
  var visitor = {
    geoState: 'md',
    publisher: 'abc',
    timestamp: '2018-07-19T18:28:59.513Z'
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})

test.serial.cb('visitor endpoint - request rejected', function (t) {
  var url = '/route/post'
  var options = { encoding: 'json', method: 'POST' }

  var expected = {
    decision: 'reject'
  }
  var visitor = {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2018-07-19T15:28:59.513Z'
  }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 404, 'correct statusCode')
    t.deepEqual(res.body, expected, 'values should match')
    t.end()
  }
})
