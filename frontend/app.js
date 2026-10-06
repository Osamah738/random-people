/**
 * OmeLive Vanilla Client - Real WebRTC + WebSocket Signaling Client
 */

let userId = localStorage.getItem('omelive_uid') || 'usr_' + Math.random().toString(36).substring(2, 10);
localStorage.setItem('omelive_uid', userId);

let localStream = null;
let remoteStream = null;
let peerConnection = null;
let socket = null;
let currentPeerId = null;
let currentMatchId = null;
let targetCountry = 'ALL';
let userCountry = 'United States';

const STUN_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const searchOverlay = document.getElementById('searchOverlay');
const searchStatusText = document.getElementById('searchStatusText');
const remoteBadge = document.getElementById('remoteBadge');
const remoteCountryText = document.getElementById('remoteCountryText');
const userCountryBadge = document.getElementById('userCountryBadge');
const countrySelect = document.getElementById('countrySelect');
const nextBtn = document.getElementById('nextBtn');
const stopBtn = document.getElementById('stopBtn');
const micToggleBtn = document.getElementById('micToggleBtn');
const camToggleBtn = document.getElementById('camToggleBtn');
const reportBtn = document.getElementById('reportBtn');

async function init() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    alert('Camera/Microphone permission denied: ' + err.message);
  }

  // Register in PHP API
  fetch('/api/create_user.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, country: userCountry })
  }).catch(() => {});

  initWebSocket();
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'register',
      userId,
      country: userCountry,
      countryCode: 'US',
      targetCountry
    }));
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'searching':
        searchOverlay.classList.remove('hidden');
        searchStatusText.innerText = 'Looking for someone...';
        remoteBadge.classList.add('hidden');
        break;

      case 'match_found':
        handleMatchFound(data);
        break;

      case 'offer':
        handleOffer(data);
        break;

      case 'answer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        break;

      case 'candidate':
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;

      case 'peer_left':
        handlePeerLeft();
        break;
    }
  };
}

async function handleMatchFound(data) {
  currentMatchId = data.matchId;
  currentPeerId = data.peerId;
  remoteCountryText.innerText = data.peerCountry || 'Stranger';
  remoteBadge.classList.remove('hidden');
  reportBtn.disabled = false;

  setupWebRTC(data.isInitiator);

  if (data.isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({
      type: 'offer',
      sdp: offer,
      targetUserId: currentPeerId
    }));
  }
}

function setupWebRTC(isInitiator) {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(STUN_CONFIG);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (e) => {
    if (e.streams && e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
    } else {
      remoteStream.addTrack(e.track);
    }
    searchOverlay.classList.add('hidden');
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate && socket && currentPeerId) {
      socket.send(JSON.stringify({
        type: 'candidate',
        candidate: e.candidate,
        targetUserId: currentPeerId
      }));
    }
  };
}

async function handleOffer(data) {
  setupWebRTC(false);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.send(JSON.stringify({
    type: 'answer',
    sdp: answer,
    targetUserId: data.fromUserId
  }));
}

function handlePeerLeft() {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  reportBtn.disabled = true;
  searchOverlay.classList.remove('hidden');
  searchStatusText.innerText = 'Partner skipped. Looking for next person...';
  triggerNext();
}

function triggerNext() {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  currentPeerId = null;
  currentMatchId = null;
  reportBtn.disabled = true;

  if (socket) {
    socket.send(JSON.stringify({
      type: 'next_partner',
      targetCountry
    }));
  }
}

nextBtn.addEventListener('click', triggerNext);
stopBtn.addEventListener('click', () => {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  if (socket) socket.send(JSON.stringify({ type: 'stop_search' }));
  searchOverlay.classList.remove('hidden');
  searchStatusText.innerText = 'Ready to start. Press NEXT';
});

countrySelect.addEventListener('change', (e) => {
  targetCountry = e.target.value;
  if (socket) {
    socket.send(JSON.stringify({
      type: 'update_preferences',
      targetCountry
    }));
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'ArrowRight') {
    e.preventDefault();
    triggerNext();
  }
});

init();
