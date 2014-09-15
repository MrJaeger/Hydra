(function() {
  exports.start = function(io) {
    var _this = this;
    return io.sockets.on('connection', function(socket) {
      socket.on('message', function(packet) {
        return io.sockets["in"](packet.room).emit('message', packet);
      });
      return socket.on('joining', function(packet) {
        io.sockets["in"](packet.room).emit('join', packet);
        return socket.join(packet.room);
      });
    });
  };

}).call(this);
