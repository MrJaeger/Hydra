exports.start = (io)->
    io.sockets.on 'connection', (socket) =>

        socket.on 'message', (packet)=>
            io.sockets.in(packet.room).emit('message', packet)

        socket.on 'joining', (packet)=>
            io.sockets.in(packet.room).emit('join', packet)
            socket.join(packet.room)