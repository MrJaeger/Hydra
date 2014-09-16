(function() {
  var HydraClient,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  HydraClient = (function() {
    var _extractSdp, _removeCN, _setDefaultCodec,
      _this = this;

    function HydraClient(options) {
      this.options = options;
      this._createPeerConnection = __bind(this._createPeerConnection, this);
      this._maybeStart = __bind(this._maybeStart, this);
      this._socketSetup = __bind(this._socketSetup, this);
      this._preferOpus = __bind(this._preferOpus, this);
      this._doCall = __bind(this._doCall, this);
      this._doAnswer = __bind(this._doAnswer, this);
      this._requestTurn = __bind(this._requestTurn, this);
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
      this.indentifier = Math.random().toString(36);
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
      return socket.emit(eventName, notice);
    };

    HydraClient.prototype.sendMessage = function(body, remoteIdentifier) {
      var message;
      message = {
        room: this.room,
        target: remoteIdentifier,
        remoteIdentifier: this.identifier
      };
      return socket.emit('message', message);
    };

    HydraClient.prototype._consoleLog = function() {
      if (this.debug) {
        return console.log(arguments);
      }
    };

    HydraClient.prototype._requestTurn = function() {
      var server, turnExists, turnReady, xhr, _i, _len, _ref;
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
            this._consoleLog('Got TURN server: ', turnServer);
            this.peerConnectionConfig.iceServers.push({
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
      var setLocalAndSendMessage,
        _this = this;
      this._consoleLog('Sending answer to peer.', remoteIdentifier);
      setLocalAndSendMessage = function(sessionDescription) {
        sessionDescription.sdp = _this._preferOpus(sessionDescription.sdp);
        _this.peerConnections[remoteIdentifier].setLocalDescription(sessionDescription);
        _this._consoleLog('setLocalAndSendMessage sending message', sessionDescription);
        return _this.sendMessage(sessionDescription, remoteIdentifier);
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
        _this._consoleLog('setLocalAndSendMessage sending message', sessionDescription);
        return _this.sendMessage(sessionDescription, remoteIdentifier);
      };
      handleCreateOfferError = function(error) {
        return _this._consoleLog('createOffer() error: ', error);
      };
      return this.peerConnections[remoteIdentifier].createOffer(setLocalAndSendMessage, handleCreateOfferError);
    };

    _extractSdp = function(sdpLine, pattern) {
      var firstOrNone, result;
      result = sdpLine.match(pattern);
      firstOrNone = result.length === 2 ? result[1] : null;
      return result && firstOrNone;
    };

    _setDefaultCodec = function(mLine, payload) {
      var element, elements, idx, index, newLine, _i, _len;
      elements = mLine.split(' ');
      newLine = [];
      index = 0;
      for (element = _i = 0, _len = elements.length; _i < _len; element = ++_i) {
        idx = elements[element];
        if (idx === 3) {
          index += 1;
          newLine[index] = payload;
        }
        if (element !== payload) {
          index += 1;
          newLine[index] = element;
        }
      }
      return newLine.join(' ');
    };

    _removeCN = function(sdpLines, mLineIndex) {
      var cnPos, idx, line, mLineElements, payload, reverseSdplines, _i, _len;
      mLineElements = sdpLines[mLineIndex].split(' ');
      reverseSdplines = sdpLines.slice(0).reverse();
      for (line = _i = 0, _len = reverseSdplines.length; _i < _len; line = ++_i) {
        idx = reverseSdplines[line];
        payload = HydraClient._extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
        if (payload) {
          cnPos = mLineElements.indexOf(payload);
          if (cnPos !== -1) {
            mLineElements.splice(cnPos, 1);
          }
          reverseSdpLines.splice(idx, 1);
        }
      }
      sdpLines = reverseSdplines.slice(0).reverse();
      sdpLines[mLineIndex] = mLineElements.join(' ');
      return sdpLines;
    };

    HydraClient.prototype._preferOpus = function(sdp) {
      var idx, line, mLineIndex, opusPayload, sdpLines, _i, _j, _len, _len1;
      sdpLines = sdp.split('\r\n');
      mLineIndex = null;
      for (line = _i = 0, _len = sdpLines.length; _i < _len; line = ++_i) {
        idx = sdpLines[line];
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
          opusPayload = this._extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
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

    HydraClient.prototype._socketSetup = function() {
      var _this = this;
      this.socket.on('join', function(notice) {
        _this._consoleLog("Peer " + notice.identifer + " made a request to join room " + notice.room);
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
                return notInitatorFor[remoteIdentifier] = true;
              }
              break;
            case 'offer':
              _this.peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(body));
              return _this._doAnswer(remoteIdentifier);
            case 'answer':
              return _this.peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(body));
            case 'candidate':
              candidate = new RTCIceCandidate({
                sdpMLineIndex: body.label,
                candidate: body.candidate
              });
              return _this.peerConnections[remoteIdentifier].addIceCandidate(candidate);
          }
        }
      });
    };

    HydraClient.prototype._maybeStart = function(remoteIdentifier) {
      if (!this.peerConnections[remoteIdentifier]) {
        this._createPeerConnection(remoteIdentifier);
        this.sendMessage({
          type: 'newpeer'
        }, remoteIdentifier);
        if (!notInitatorFor[remoteIdentifier]) {
          return this._doCall(remoteIdentifier);
        }
      }
    };

    HydraClient.prototype._createPeerConnection = function(remoteIdentifier) {
      var handleIceCandidate, handleIceConnectionStateChange, handleRemoteStreamAdded, handleRemoteStreamRemoved, peerConnection;
      handleIceCandidate = function(event) {
        var candidateMessage;
        if (event.candidate) {
          candidateMessage = {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
          };
          return this.sendMessage(candidateMessage, remoteIdentifier);
        } else {
          return this._consoleLog('End of candidates.');
        }
      };
      handleRemoteStreamAdded = function(event) {
        return this.remoteStreamAddedCallback(event);
      };
      handleIceConnectionStateChange = function(event) {
        switch (event.currentTarget.iceConnectionState) {
          case 'disconnected':
            return this.remoteSteamDisconnectedCallback(event);
        }
      };
      handleRemoteStreamRemoved = function(event) {
        return this._consoleLog("Remote stream removed", event);
      };
      peerConnection = new webkitRTCPeerConnection(null);
      peerConnection.onicecandidate = handleIceCandidate;
      peerConnection.onaddstream = handleRemoteStreamAdded;
      peerConnection.onremovestream = handleRemoteStreamRemoved;
      peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange;
      return this.peerConnections[remoteIdentifier].addStream(this.localStream);
    };

    return HydraClient;

  }).call(this);

}).call(this);
