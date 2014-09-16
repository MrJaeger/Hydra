class HydraClient

    constructor: (@options) ->
        # Dont console.log unless debug is turned on
        @debug = @options.debug or false

        # We need a TURN server because NAT
        @turnServer = @options.turnServer or 'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'

        # Also need out ICE servers, should just work dont need to
        # provide an option for overide
        @peerConnectionConfig = 
            'iceServers': [
                {'url': 'stun:stun.l.google.com:19302'}
            ]

        if not @options.room
            throw new Error("A room is required")
        @room = @options.room

        if not @options.socket
            throw new Error("A socket is required")
        @socket = @options.socket

        if not @options.localStream
            throw new Error("We need a stream from the webcam")
        @localStream = @options.localStream

        @remoteStreamAddedCallback = @options.remoteStreamAddedCallback or ->
        @remoteStreamDisconnectedCallback = @options.remoteStreamDisconnectedCallback or ->

        # Generate an identifier for this client
        @indentifier = Math.random().toString 36

        # The other clients that you are connected to
        @peerConnections = {}

        # When joining a room we need some way of knowing if
        # we or the other client we are syncing with is the one
        # who initated the request.
        @notInitiatorFor = {}

        @_socketSetup()

        if location.hostname != "localhost"
            @_requestTurn()

    sendNotice: (eventName) =>
        notice =
            room: @room
            identifier: @identifier
        socket.emit(eventName, notice)

    sendMessage: (body, remoteIdentifier) =>
        message =
            room: @room
            target: remoteIdentifier
            remoteIdentifier: @identifier
        socket.emit('message', message)

    _consoleLog: =>
        if @debug
            console.log arguments

    # This is straight boilerplate, could probbaly look a bit prettier
    _requestTurn: =>
        turnExists = false
        for server in @peerConnectionConfig.iceServers
            if server.url.substr(0, 5) == 'turn:'
                turnExists = true
                turnReady = true
                break

        unless turnExists
            # No TURN server. Get one from computeengineondemand.appspot.com:
            xhr = new XMLHttpRequest()

            xhr.onreadystatechange = ->
                if xhr.readyState == 4 and xhr.status == 200
                    turnServer = JSON.parse xhr.responseText
                    @_consoleLog 'Got TURN server: ', turnServer
                    @peerConnectionConfig.iceServers.push
                        'url': "turn:#{turnServer.username}@#{turnServer.turn}"
                        'credential': turnServer.password
                    turnReady = true

            xhr.open 'GET', @turnServer, true
            xhr.send()

    _doAnswer: (remoteIdentifier) =>
        @_consoleLog 'Sending answer to peer.', remoteIdentifier

        setLocalAndSendMessage = (sessionDescription) =>
            sessionDescription.sdp = @_preferOpus sessionDescription.sdp
            @peerConnections[remoteIdentifier].setLocalDescription sessionDescription
            @_consoleLog 'setLocalAndSendMessage sending message' , sessionDescription
            @sendMessage sessionDescription, remoteIdentifier

        @peerConnections[remoteIdentifier].createAnswer setLocalAndSendMessage, null, sdpConstraints

    _doCall: (remoteIdentifier) =>
        @_consoleLog 'Sending offer to peer', remoteIdentifier

        setLocalAndSendMessage = (sessionDescription) =>
            sessionDescription.sdp = @_preferOpus sessionDescription.sdp
            @peerConnections[remoteIdentifier].setLocalDescription sessionDescription
            @_consoleLog 'setLocalAndSendMessage sending message' , sessionDescription
            @sendMessage sessionDescription, remoteIdentifier

        handleCreateOfferError = (error) =>
          @_consoleLog 'createOffer() error: ', error

        @peerConnections[remoteIdentifier].createOffer setLocalAndSendMessage, handleCreateOfferError

    _extractSdp = (sdpLine, pattern) =>
        result = sdpLine.match(pattern)
        firstOrNone = if result.length == 2 then result[1] else null
        result and firstOrNone

    # Set the selected codec to the first in m line.
    _setDefaultCodec = (mLine, payload) =>
        elements = mLine.split(' ')
        newLine = []
        index = 0

        for idx, element in elements
            if idx == 3 # Format of media starts from the fourth.
                index += 1
                newLine[index] = payload # Put target payload to the first.
            if element != payload
                index += 1
                newLine[index] = element
        
        newLine.join(' ')

    # Strip CN from sdp before CN constraints is ready.
    _removeCN = (sdpLines, mLineIndex) =>
        mLineElements = sdpLines[mLineIndex].split(' ')
        reverseSdplines = sdpLines.slice(0).reverse()
        # Scan from end for the convenience of removing an item.
        for idx, line in reverseSdplines
            payload = @_extractSdp sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i
            if payload
                cnPos = mLineElements.indexOf payload
                if cnPos != -1
                    # Remove CN payload from m line.
                    mLineElements.splice cnPos, 1
                reverseSdpLines.splice idx, 1

        sdpLines = reverseSdplines.slice(0).reverse()
        sdpLines[mLineIndex] = mLineElements.join(' ')
        sdpLines

    # Set Opus as the default audio codec if it's present.
    # Also straight boilerplate
    _preferOpus: (sdp) =>
        sdpLines = sdp.split('\r\n')
        mLineIndex = null

        for idx, line in sdpLines
            if line.search("m=audio") != -1
                mLineIndex = idx
                break

        unless mLineIndex
            return sdp

        # If Opus is available, set it as the default in m line.
        for line in sdpLines
            if line.search('opus/48000') != -1
                opusPayload = @_extractSdp sdpLines[i], /:(\d+) opus\/48000/i
                if opusPayload
                    sdpLines[mLineIndex] = @_setDefaultCodec sdpLines[mLineIndex], opusPayload
                break

        # Remove CN in m line and sdp.
        sdpLines = @_removeCN sdpLines, mLineIndex

        sdp = sdpLines.join('\r\n')
        sdp


    _socketSetup: =>
        @socket.on 'join', (notice) =>
            @_consoleLog "Peer #{notice.identifer} made a request to join room #{notice.room}"
            @_maybeStart notice.identifier

        @socket.on 'message', (message) =>
            remoteIdentifier = message.remoteIdentifier
            body = message.body
            target = message.target

            # Since we are spraying all our messages to every other client
            # we need to make sure this message was intended for this client
            if @identifier == target
                switch body.type
                    when 'newpeer'
                        # We havent already connected to with this client
                        unless @peerConnections[remoteIdentifier]
                            @_createPeerConnection remoteIdentifier
                            notInitatorFor[remoteIdentifier] = true
                    when 'offer'
                        @peerConnections[remoteIdentifier].setRemoteDescription (new RTCSessionDescription(body))
                        @_doAnswer remoteIdentifier
                    when 'answer'
                        @peerConnections[remoteIdentifier].setRemoteDescription (new RTCSessionDescription(body))
                    when 'candidate'
                        candidate = new RTCIceCandidate
                            sdpMLineIndex: body.label
                            candidate: body.candidate
                        @peerConnections[remoteIdentifier].addIceCandidate candidate

    _maybeStart: (remoteIdentifier) =>
        unless @peerConnections[remoteIdentifier]
            @_createPeerConnection remoteIdentifier
            @sendMessage {type: 'newpeer'}, remoteIdentifier

            unless notInitatorFor[remoteIdentifier]
                @_doCall remoteIdentifier

    _createPeerConnection: (remoteIdentifier) =>
        handleIceCandidate = (event) ->
            if event.candidate
                candidateMessage =
                    type: 'candidate'
                    label: event.candidate.sdpMLineIndex
                    id: event.candidate.sdpMid
                    candidate: event.candidate.candidate
                @sendMessage candidateMessage, remoteIdentifier
            else
                @_consoleLog 'End of candidates.'

        handleRemoteStreamAdded = (event) ->
            @remoteStreamAddedCallback event

        handleIceConnectionStateChange = (event) ->
            switch event.currentTarget.iceConnectionState
                when 'disconnected'
                    @remoteSteamDisconnectedCallback event

        # TODO: Figure out what this is supposed to do
        # and give a good interface around what the user
        # can do with it
        handleRemoteStreamRemoved = (event) ->
            @_consoleLog "Remote stream removed", event

        peerConnection = new webkitRTCPeerConnection null
        peerConnection.onicecandidate = handleIceCandidate
        peerConnection.onaddstream = handleRemoteStreamAdded
        peerConnection.onremovestream = handleRemoteStreamRemoved
        peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange
        # PUT AT END
        @peerConnections[remoteIdentifier].addStream @localStream

