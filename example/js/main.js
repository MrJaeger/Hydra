'use strict';

var localStream;
var turnReady;
var peerConnections = {};
var notInitatorFor = {};

var pc_config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio':true,
    'OfferToReceiveVideo':true
  }
};

var myIdentifier = Math.random().toString(36);
console.log("Your identifier is " + myIdentifier);

/////////////////////////////////////////////

var room = location.pathname.substring(1);
if (room === '') {
  room = 'foo';
}

var constraints = {video: true, audio: true};
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);

function updateCSS() {
  var videos = document.getElementsByTagName('video')
  for(var i = 0; i<videos.length; i++) {
    videos[i].style.width = ((100/videos.length) - 1) + "%";
  }
}

function socketSetup() {

  window.socket = io.connect();

  console.log('joining room', room);
  sendNotice('joining')

  socket.on('join', function (packet){
    console.log('Another peer made a request to join room ' + packet.room);
    maybeStart(packet.identifier);
  });

  socket.on('log', function (array){
    console.log.apply(console, array);
  });

  socket.on('message', function (packet){
    var remoteIdentifier = packet.identifier;
    var message = packet.message;
    var target = packet.target;

    if(myIdentifier !== target) {
      return;
    }

    console.log('Client received message:', packet);

    if (message.type === 'newpeer' && !peerConnections[remoteIdentifier]) {
      createPeerConnection(remoteIdentifier);
      peerConnections[remoteIdentifier].addStream(localStream);
      notInitatorFor[remoteIdentifier] = true;
    } else if (message.type === 'offer') {
      peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(message));
      doAnswer(remoteIdentifier);
    } else if (message.type === 'answer') {
      peerConnections[remoteIdentifier].setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate') {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });

      peerConnections[remoteIdentifier].addIceCandidate(candidate);
    }
  });
}

////////////////////////////////////////////////

var doAnswer = function(remoteIdentifier) {
  console.log('Sending answer to peer.');
  var setLocalAndSendMessage = function(sessionDescription) {
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    peerConnections[remoteIdentifier].setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message' , sessionDescription);
    sendMessage(sessionDescription, remoteIdentifier);
  }
  peerConnections[remoteIdentifier].createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}

var doCall = function(remoteIdentifier) {
  console.log('Sending offer to peer');
  var setLocalAndSendMessage = function(sessionDescription) {
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    peerConnections[remoteIdentifier].setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message' , sessionDescription);
    sendMessage(sessionDescription, remoteIdentifier);
  }
  peerConnections[remoteIdentifier].createOffer(setLocalAndSendMessage, handleCreateOfferError);
}


function sendMessage(message, target){
  var packet = {
    message: message,
    identifier: myIdentifier,
    target: target
  };
	console.log('Client sending message: ', packet);
  socket.emit('message', packet);
}

function sendNotice(eventName) {
  var packet = {
    room: room,
    identifier: myIdentifier
  }
  socket.emit(eventName, packet)
}


function maybeStart(remoteIdentifier) {
  if (!peerConnections[remoteIdentifier]) {
    createPeerConnection(remoteIdentifier);
    peerConnections[remoteIdentifier].addStream(localStream);
    sendMessage({type: 'newpeer'}, remoteIdentifier);

    if(!notInitatorFor[remoteIdentifier]) {
      doCall(remoteIdentifier);
    }
  }
}

////////////////////////////////////////////////////

function handleUserMedia(stream) {
  console.log('Adding local stream.');
  socketSetup();
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
}

function handleUserMediaError(error){
  console.log('navigator.getUserMedia error: ', error);
}

if (location.hostname !== "localhost") {
  requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
}

/////////////////////////////////////////////////////////

function createPeerConnection(remoteIdentifier) {
  var handleIceCandidate = function(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {
      var candidateMessage = {
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      }
      sendMessage(candidateMessage, remoteIdentifier);
    } else {
      console.log('End of candidates.');
    }
  }

  var handleRemoteStreamAdded = function(event) {
    var video = document.createElement('video');
    video.autoplay = true;
    video.id = remoteIdentifier;
    video.src = window.URL.createObjectURL(event.stream);

    var videos = document.getElementById('videos');
    videos.appendChild(video);
    updateCSS();
  }
  

  var handleIceConnectionStateChange = function(event) {
    if(event.currentTarget.iceConnectionState == "disconnected") {
      var video = document.getElementById(remoteIdentifier);
      video.parentNode.removeChild(video);
      pcs[remoteIdentifier] = null;
      updateCSS();
    }
  }

  // throw a try/catch around this if it doesnt work and you
  // need to see what the error is
  var pc = new webkitRTCPeerConnection(null);
  pc.onicecandidate = handleIceCandidate;
  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;
  pc.oniceconnectionstatechange = handleIceConnectionStateChange
  console.log('Created RTCPeerConnnection for: ', remoteIdentifier);
  peerConnections[remoteIdentifier] = pc;
}

function handleCreateOfferError(event){
  console.log('createOffer() error: ', e);
}

function requestTurn(turn_url) {
  var turnExists = false;
  for (var i in pc_config.iceServers) {
    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turn_url);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
      	console.log('Got TURN server: ', turnServer);
        pc_config.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turn_url, true);
    xhr.send();
  }
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

