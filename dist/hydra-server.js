(function() {
  exports.start = function(io) {
    var _this = this;
    return io.on('connection', function(socket) {
      socket.on('message', function(packet) {
        console.log(packet.room);
        return io.to(packet.room).emit('message', packet);
      });
      return socket.on('joining', function(packet) {
        io.to(packet.room).emit('join', packet);
        return socket.join(packet.room);
      });
    });
  };

}).call(this);
