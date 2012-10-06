#! /usr/bin/env node

// standard modules
var https = require('https')
  , http = require('http')
  , fs = require('fs')
  , url = require('url')
  , spawn = require('child_process').spawn;

// third party modules
var connect = require('connect')
  , io = require('socket.io')
  ;

// options
var target = process.argv[2]
  , port = process.argv[3] || 3000
  ;

if (target === '-v') {
  var v = require('./package').version;
  console.log(v);
  return;
}

var tsFile = fs.realpathSync(target);

var server = connect()
  .use(connect.static(__dirname + '/public'))
  .listen(port);

io = io.listen(server);

io.configure('development', function() {
  io.set('log level', 1);
  io.set('transports', ['websocket']);
});

io.sockets.on('connection', function(socket) {
  // read at the first access
  read(tsFile, function(err, data) {
    if (err) return socket.emit('err', { message: err.message });
    socket.emit('update', { file: tsFile, data: data });
  });
});

// watch the change of file
change(tsFile, function(err, data) {
  if (err) return io.sockets.emit('err', { message: err.message });
  io.sockets.emit('update', { file: tsFile, data: data });
});

function read(path, cb) {
  compile(path, function (err, jsFile) {
    if (err) return cb(err);

    fs.readFile(jsFile, 'utf8', function(err, data) {
      if (err) return cb(err);
      if (data.length === 0) return cb(new Error('length zero'));
      cb(null, data);
    });
  });
}

function change(path, cb) {
  fs.watchFile(path, { interval: 10 }, function(curr, prev) {
    read(path, cb);
  });
}

function compile(path, cb) {
  var out = '';
  var tsc = spawn('tsc', [ path ]);

  tsc.stdout.on('data', function (data) {
    out += data;
  });

  tsc.stderr.on('data', function (data) {
    out += data;
  });

  tsc.on('exit', function (code) {
    if (code === 0) {
      cb(null, path.replace(/.ts$/, '.js'));
    } else {
      cb(new Error(out));
    }
  });
}

