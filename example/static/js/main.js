'use strict';

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
    'mandatory': {
        'OfferToReceiveAudio':true,
        'OfferToReceiveVideo':true
    }
};

var socket = io.connect();
var room = location.pathname.substring(1);

if (room === '') {
    room = 'foo';
}

function updateCSS() {
    var videos = document.getElementsByTagName('video')
    for(var i = 0; i<videos.length; i++) {
        videos[i].style.width = ((100/videos.length) - 1) + "%";
    }
}

var handleRemoteStreamAdded = function(event, remoteIdentifier) {
    var video = document.createElement('video');
    video.autoplay = true;
    video.id = remoteIdentifier;
    video.src = window.URL.createObjectURL(event.stream);

    var videos = document.getElementById('videos');
    videos.appendChild(video);
    updateCSS();
}

var handleRemoteStreamRemoved = function(event, remoteIdentifier) {
    var video = document.getElementById(remoteIdentifier);
    video.parentNode.removeChild(video);
    updateCSS();
}

function extractSdp (sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec (mLine, payload) {
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

function handleUserMedia(stream) {
    var client = new HydraClient({
        remoteStreamAddedCallback: handleRemoteStreamAdded,
        remoteStreamDisconnectedCallback: handleRemoteStreamRemoved,
        room: room,
        localStream: stream,
        socket: socket,
        debug: true
    })
    localVideo.src = window.URL.createObjectURL(stream);
}

function handleUserMediaError(error){
    console.log('navigator.getUserMedia error: ', error);
}

var constraints = {video: true, audio: true};
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);