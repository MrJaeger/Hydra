(function() {
  var HydraClient,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  HydraClient = (function() {
    function HydraClient(options) {
      this.options = options;
      this._preferOpus = __bind(this._preferOpus, this);
      this._removeCN = __bind(this._removeCN, this);
      this._setDefaultCodec = __bind(this._setDefaultCodec, this);
      this._extractSdp = __bind(this._extractSdp, this);
      this._doCall = __bind(this._doCall, this);
      this._doAnswer = __bind(this._doAnswer, this);
      this._requestTurn = __bind(this._requestTurn, this);
      this._createPeerConnection = __bind(this._createPeerConnection, this);
      this._maybeStart = __bind(this._maybeStart, this);
      this._socketSetup = __bind(this._socketSetup, this);
      this._consoleLog = __bind(this._consoleLog, this);
      this.sendMessage = __bind(this.sendMessage, this);
      this.sendNotice = __bind(this.sendNotice, this);
      this.debug = this.options.debug || false;
      this.turnServer = this.options.turnServer || 'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913';
      this.peerConnectionConfig = {
        'iceServers': [
          {
            'url': 'stun:stun.l.google.com:19302'
          }
        ]
      };
      if (!this.options.room) {
        throw new Error("A room is required");
      }
      this.room = this.options.room;
      if (!this.options.socket) {
        throw new Error("A socket is required");
      }
      this.socket = this.options.socket;
      if (!this.options.localStream) {
        throw new Error("We need a stream from the webcam");
      }
      this.localStream = this.options.localStream;
      this.remoteStreamAddedCallback = this.options.remoteStreamAddedCallback || function() {};
      this.remoteStreamDisconnectedCallback = this.options.remoteStreamDisconnectedCallback || function() {};
      this.identifier = Math.random().toString(36);
      this.peerConnections = {};
      this.notInitiatorFor = {};
      this._socketSetup();
      if (location.hostname !== "localhost") {
        this._requestTurn();
      }
    }

    HydraClient.prototype.sendNotice = function(eventName) {
      var notice;
      notice = {
        room: this.room,
        identifier: this.identifier
      };
      return this.socket.emit(eventName, notice);
    };

    HydraClient.prototype.sendMessage = function(body, remoteIdentifier) {
      var message;
      message = {
        target: remoteIdentifier,
        remoteIdentifier: this.identifier,
        body: body
      };
      this._consoleLog("Client sending message", message);
      return this.socket.emit('message', message);
    };

    HydraClient.prototype._consoleLog = function() {
      if (this.debug) {
        return console.log.apply(console, arguments);
      }
    };

    HydraClient.prototype._socketSetup = function() {
      var _this = this;
      this.sendNotice('joining');
      this.socket.on('join', function(notice) {
        _this._consoleLog("Peer " + notice.identifier + " made a request to join room " + notice.room);
        return _this._maybeStart(notice.identifier);
      });
      return this.socket.on('message', function(message) {
        var body, candidate, remoteIdentifier, target;
        remoteIdentifier = message.remoteIdentifier;
        body = message.body;
        target = message.target;
        if (_this.identifier === target) {
          switch (body.type) {
            case 'newpeer':
              if (!_this.peerConnections[remoteIdentifier]) {
                _this._createPeerConnection(remoteIdentifier);
                _this.peerConnections[remoteIdentifier].addStream(_this.localStream);
                _this.notInitiatorFor[remoteIdentifier] = true;
              }
              break;
            case 'offer':
              debugger;
              _this.peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(body));
              _this._doAnswer(remoteIdentifier);
              break;
            case 'answer':
              _this.peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(body));
              break;
            case 'candidate':
              candidate = new RTCIceCandidate({
                sdpMLineIndex: body.label,
                candidate: body.candidate
              });
              _this.peerConnections[remoteIdentifier].addIceCandidate(candidate);
              break;
          }
        }
      });
    };

    HydraClient.prototype._maybeStart = function(remoteIdentifier) {
      if (!this.peerConnections[remoteIdentifier]) {
        this._createPeerConnection(remoteIdentifier);
        this.peerConnections[remoteIdentifier].addStream(this.localStream);
        this.sendMessage({
          type: 'newpeer'
        }, remoteIdentifier);
        if (!this.notInitiatorFor[remoteIdentifier]) {
          return this._doCall(remoteIdentifier);
        }
      }
    };

    HydraClient.prototype._createPeerConnection = function(remoteIdentifier) {
      var handleIceCandidate, handleIceConnectionStateChange, handleRemoteStreamAdded, handleRemoteStreamRemoved, peerConnection,
        _this = this;
      handleIceCandidate = function(event) {
        var candidateMessage;
        if (event.candidate) {
          candidateMessage = {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
          };
          return _this.sendMessage(candidateMessage, remoteIdentifier);
        } else {
          return _this._consoleLog('End of candidates.');
        }
      };
      handleRemoteStreamAdded = function(event, remoteIdentifier) {
        return _this.remoteStreamAddedCallback(event, remoteIdentifier);
      };
      handleIceConnectionStateChange = function(event) {
        switch (event.currentTarget.iceConnectionState) {
          case 'disconnected':
            _this.remoteSteamDisconnectedCallback(event);
            break;
        }
      };
      handleRemoteStreamRemoved = function(event) {
        return _this._consoleLog("Remote stream removed", event);
      };
      peerConnection = new webkitRTCPeerConnection(null);
      peerConnection.onicecandidate = handleIceCandidate;
      peerConnection.onaddstream = handleRemoteStreamAdded;
      peerConnection.onremovestream = handleRemoteStreamRemoved;
      peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange;
      return this.peerConnections[remoteIdentifier] = peerConnection;
    };

    HydraClient.prototype._requestTurn = function() {
      var server, turnExists, turnReady, xhr, _i, _len, _ref,
        _this = this;
      turnExists = false;
      _ref = this.peerConnectionConfig.iceServers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        server = _ref[_i];
        if (server.url.substr(0, 5) === 'turn:') {
          turnExists = true;
          turnReady = true;
          break;
        }
      }
      if (!turnExists) {
        xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          var turnServer;
          if (xhr.readyState === 4 && xhr.status === 200) {
            turnServer = JSON.parse(xhr.responseText);
            _this._consoleLog('Got TURN server: ', turnServer);
            _this.peerConnectionConfig.iceServers.push({
              'url': "turn:" + turnServer.username + "@" + turnServer.turn,
              'credential': turnServer.password
            });
            return turnReady = true;
          }
        };
        xhr.open('GET', this.turnServer, true);
        return xhr.send();
      }
    };

    HydraClient.prototype._doAnswer = function(remoteIdentifier) {
      var sdpConstraints, setLocalAndSendMessage,
        _this = this;
      this._consoleLog('Sending answer to peer.', remoteIdentifier);
      setLocalAndSendMessage = function(sessionDescription) {
        sessionDescription.sdp = _this._preferOpus(sessionDescription.sdp);
        _this.peerConnections[remoteIdentifier].setLocalDescription(sessionDescription);
        _this._consoleLog('setLocalAndSendMessage from doAnswer and sending message', sessionDescription);
        return _this.sendMessage(sessionDescription, remoteIdentifier);
      };
      sdpConstraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      };
      return this.peerConnections[remoteIdentifier].createAnswer(setLocalAndSendMessage, null, sdpConstraints);
    };

    HydraClient.prototype._doCall = function(remoteIdentifier) {
      var handleCreateOfferError, setLocalAndSendMessage,
        _this = this;
      this._consoleLog('Sending offer to peer', remoteIdentifier);
      setLocalAndSendMessage = function(sessionDescription) {
        sessionDescription.sdp = _this._preferOpus(sessionDescription.sdp);
        _this.peerConnections[remoteIdentifier].setLocalDescription(sessionDescription);
        _this._consoleLog('setLocalAndSendMessage from doCall and sending message', sessionDescription);
        return _this.sendMessage(sessionDescription, remoteIdentifier);
      };
      handleCreateOfferError = function(error) {
        return _this._consoleLog('createOffer() error: ', error);
      };
      return this.peerConnections[remoteIdentifier].createOffer(setLocalAndSendMessage, handleCreateOfferError);
    };

    HydraClient.prototype._extractSdp = function(sdpLine, pattern) {
      var firstOrNone, result;
      result = sdpLine.match(pattern);
      return firstOrNone = result && result.length === 2 ? result[1] : null;
    };

    HydraClient.prototype._setDefaultCodec = function(mLine, payload) {
      var element, elements, idx, index, newLine, _i, _len;
      elements = mLine.split(' ');
      newLine = [];
      index = 0;
      for (idx = _i = 0, _len = elements.length; _i < _len; idx = ++_i) {
        element = elements[idx];
        if (idx === 3) {
          newLine[index] = payload;
          index += 1;
        }
        if (element !== payload) {
          newLine[index] = element;
          index += 1;
        }
      }
      return newLine.join(' ');
    };

    HydraClient.prototype._removeCN = function(sdpLines, mLineIndex) {
      var cnPos, idx, line, mLineElements, newSdpLines, payload, _i, _len;
      mLineElements = sdpLines[mLineIndex].split(' ');
      newSdpLines = [];
      for (idx = _i = 0, _len = sdpLines.length; _i < _len; idx = ++_i) {
        line = sdpLines[idx];
        payload = this._extractSdp(line, /a=rtpmap:(\d+) CN\/\d+/i);
        if (payload) {
          cnPos = mLineElements.indexOf(payload);
          if (cnPos !== -1) {
            mLineElements.splice(cnPos, 1);
          }
        } else {
          newSdpLines.push(line);
        }
      }
      sdpLines = newSdpLines;
      sdpLines[mLineIndex] = mLineElements.join(' ');
      return sdpLines;
    };

    HydraClient.prototype._preferOpus = function(sdp) {
      var idx, line, mLineIndex, opusPayload, sdpLines, _i, _j, _len, _len1;
      sdpLines = sdp.split('\r\n');
      mLineIndex = null;
      for (idx = _i = 0, _len = sdpLines.length; _i < _len; idx = ++_i) {
        line = sdpLines[idx];
        if (line.search("m=audio") !== -1) {
          mLineIndex = idx;
          break;
        }
      }
      if (!mLineIndex) {
        return sdp;
      }
      for (_j = 0, _len1 = sdpLines.length; _j < _len1; _j++) {
        line = sdpLines[_j];
        if (line.search('opus/48000') !== -1) {
          opusPayload = this._extractSdp(line, /:(\d+) opus\/48000/i);
          if (opusPayload) {
            sdpLines[mLineIndex] = this._setDefaultCodec(sdpLines[mLineIndex], opusPayload);
          }
          break;
        }
      }
      sdpLines = this._removeCN(sdpLines, mLineIndex);
      sdp = sdpLines.join('\r\n');
      return sdp;
    };

    return HydraClient;

  })();

  this.HydraClient = HydraClient;

}).call(this);
