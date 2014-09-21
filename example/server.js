var express = require('express')
    , app = express()
    , server = require('http').Server(app)
    , io = require('socket.io')(server)

var hydra = require('../dist/hydra-server.js')
hydra.start(io)

app.get('/', function(req, res){
    res.sendFile('index.html', {root: '.'});
});

app.use(express.static(__dirname + '/static'));

server.listen(3000, function(){
    console.log('listening on *:3000');
});