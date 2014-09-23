exports.start = (io) ->
    io.on 'connection', (socket) =>
        socket.on 'message', (packet) =>
            io.to(packet.room).emit 'message', packet

        socket.on 'joining', (packet) =>
            io.to(packet.room).emit 'join', packet
            socket.join packet.room