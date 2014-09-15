var nodeStatic = require('node-static');
var http = require('http');
var file = new(nodeStatic.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(3000);

var io = require('socket.io').listen(app);
var hydra = require('./src/hydra-server.coffee')
hydra.start(io)