var nodeStatic = require('node-static')
    , http = require('http')
    , server = new(nodeStatic.Server)()

var app = http.createServer(function (req, res) {
    server.serve(req, res)
}).listen(3000)

var io = require('socket.io').listen(app)
var hydra = require('../dist/hydra-server.js')
hydra.start(io)