var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(3000);

var io = require('socket.io').listen(app);

io.sockets.on('connection', function (socket){
  
  // convenience function to log server messages on the client
  function log(){
    var array = [">>> Message from server: "];
    for (var i = 0; i < arguments.length; i++) {
      array.push(arguments[i]);
    }
    socket.emit('log', array);
  }

  socket.on('message', function (packet) {
    log('Got message:', packet);
    var room = packet.room;

    io.sockets.in(room).emit('message', packet);
  });

  socket.on('joining', function (packet) {
    var room = packet.room;

    log('joining room ' + packet.room)
    io.sockets.in(room).emit('join', packet);
    socket.join(room);
  });

});

