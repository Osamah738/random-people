import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoArea } from './components/VideoArea';
import { Controls } from './components/Controls';
import { TextChatDrawer, ChatMessage } from './components/TextChatDrawer';
import { ReportModal } from './components/ReportModal';
import { AdminModal } from './components/AdminModal';
import { SettingsModal } from './components/SettingsModal';
import { COUNTRIES, Country, getCountryByName } from './data/countries';
import { detectUserCountry } from './utils/geo';
import { WebRTCManager } from './services/webrtc';
import { SignalingClient, SignalingMessage } from './services/signaling';

export function App() {
  // --- User Identity & Countries ---
  const [userId, setUserId] = useState<string>(() => {
    const saved = localStorage.getItem('omelive_uid');
    if (saved && saved.startsWith('usr_')) return saved;
    const newId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('omelive_uid', newId);
    return newId;
  });

  const [userCountry, setUserCountry] = useState<Country>(COUNTRIES[2]); // Default US
  const [targetCountry, setTargetCountry] = useState<Country>(COUNTRIES[0]); // Default Any Country

  // --- Media & Streams ---
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const [isAudioSpeaking, setIsAudioSpeaking] = useState(false);

  // --- Matchmaking & WebRTC Status ---
  const [matchStatus, setMatchStatus] = useState<
    'idle' | 'searching' | 'connecting' | 'connected' | 'skipped' | 'disconnected'
  >('idle');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [currentPeerId, setCurrentPeerId] = useState<string | null>(null);
  const [peerCountry, setPeerCountry] = useState<string | null>(null);
  const [peerCountryCode, setPeerCountryCode] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);

  // --- Platform Metrics ---
  const [onlineCount, setOnlineCount] = useState(1);
  const [inMatchCount, setInMatchCount] = useState(0);

  // --- Chat & Modals ---
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Refs ---
  const signalingRef = useRef<SignalingClient | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentPeerIdRef = useRef<string | null>(null);
  currentPeerIdRef.current = currentPeerId;

  // 1. Initial Geolocation Detection & Registration
  useEffect(() => {
    let isMounted = true;
    detectUserCountry().then((detected) => {
      if (isMounted) {
        setUserCountry(detected);
        // Register in backend database
        fetch('/api/create_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            country: detected.name,
            country_code: detected.code
          })
        }).catch(err => console.warn('Registration network notice:', err));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // 2. Periodic Database Heartbeat (every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  // 3. Initialize Camera & Microphone Stream
  const initMedia = useCallback(
    async (videoId?: string, audioId?: string): Promise<MediaStream | null> => {
      setPermissionError(null);
      try {
        // Stop previous tracks if replacing
        if (localStream) {
          localStream.getTracks().forEach((t) => t.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: videoId
            ? { deviceId: { exact: videoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: audioId ? { deviceId: { exact: audioId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);

        // Update WebRTC manager if active
        if (webrtcRef.current) {
          webrtcRef.current.setLocalStream(stream);
        }

        // Setup audio visualizer analyzer
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkVolume = () => {
              if (!analyser) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;
              setIsAudioSpeaking(average > 15);
              requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch {
          // Audio analyzer optional
        }

        return stream;
      } catch (err: any) {
        console.error('Camera/Mic permission error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError(
            'Camera and microphone permissions were denied. Please click the lock or camera icon in your browser address bar to allow access, then click Retry.'
          );
        } else if (err.name === 'NotFoundError') {
          setPermissionError('No camera or microphone device found. Please connect a webcam or headset.');
        } else {
          setPermissionError(`Failed to access media devices: ${err.message || 'Unknown error'}`);
        }
        return null;
      }
    },
    [localStream]
  );

  useEffect(() => {
    initMedia();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // 4. WebSocket Signaling Message Handling
  const handleSignalingMessage = useCallback(
    async (msg: SignalingMessage) => {
      switch (msg.type) {
        case 'registered':
          setOnlineCount(Math.max(msg.activeCount || 1, 1));
          break;

        case 'searching':
          setMatchStatus('searching');
          setRemoteStream(null);
          setCurrentPeerId(null);
          setCurrentMatchId(null);
          setMessages([]);
          break;

        case 'match_found': {
          const { matchId, peerId, peerCountry: pCountry, peerCountryCode: pCode, isInitiator: init } = msg;
          setCurrentMatchId(matchId);
          setCurrentPeerId(peerId);
          setPeerCountry(pCountry);
          setPeerCountryCode(pCode);
          setIsInitiator(init);
          setMatchStatus('connecting');

          setMessages([
            {
              id: 'sys_' + Date.now(),
              sender: 'system',
              text: `Connected with partner from ${pCountry}!`,
              timestamp: Date.now()
            }
          ]);

          // Initialize WebRTC
          if (!webrtcRef.current) {
            console.error('WebRTC manager not ready');
            return;
          }

          webrtcRef.current.initPeerConnection(init);

          if (init) {
            // Initiator creates and sends WebRTC Offer
            const offer = await webrtcRef.current.createOffer();
            if (offer && signalingRef.current) {
              signalingRef.current.send({
                type: 'offer',
                sdp: offer,
                targetUserId: peerId
              });
            }
          }
          break;
        }

        case 'offer': {
          if (webrtcRef.current && msg.fromUserId) {
            const answer = await webrtcRef.current.handleOffer(msg.sdp);
            if (answer && signalingRef.current) {
              signalingRef.current.send({
                type: 'answer',
                sdp: answer,
                targetUserId: msg.fromUserId
              });
            }
          }
          break;
        }

        case 'answer': {
          if (webrtcRef.current) {
            await webrtcRef.current.handleAnswer(msg.sdp);
          }
          break;
        }

        case 'candidate': {
          if (webrtcRef.current) {
            await webrtcRef.current.addIceCandidate(msg.candidate);
          }
          break;
        }

        case 'chat_message': {
          setMessages((prev) => [
            ...prev,
            {
              id: 'msg_' + Date.now() + Math.random(),
              sender: 'peer',
              text: msg.text,
              timestamp: msg.timestamp || Date.now()
            }
          ]);
          setUnreadCount((c) => (chatOpen ? 0 : c + 1));
          break;
        }

        case 'peer_left': {
          setMatchStatus('skipped');
          setRemoteStream(null);
          setCurrentPeerId(null);
          setCurrentMatchId(null);
          if (webrtcRef.current) {
            webrtcRef.current.close();
          }
          setMessages((prev) => [
            ...prev,
            {
              id: 'sys_' + Date.now(),
              sender: 'system',
              text: 'Partner left or skipped to next user.',
              timestamp: Date.now()
            }
          ]);
          break;
        }

        case 'stopped':
          setMatchStatus('idle');
          setRemoteStream(null);
          setCurrentPeerId(null);
          setCurrentMatchId(null);
          if (webrtcRef.current) {
            webrtcRef.current.close();
          }
          break;
      }
    },
    [chatOpen]
  );

  // 5. Connect WebRTC Manager and Signaling Client
  useEffect(() => {
    // Instantiate WebRTC Manager
    const rtc = new WebRTCManager(
      (stream) => {
        setRemoteStream(stream);
        setMatchStatus('connected');
      },
      (candidate) => {
        if (signalingRef.current && currentPeerIdRef.current) {
          signalingRef.current.send({
            type: 'candidate',
            candidate: candidate.toJSON(),
            targetUserId: currentPeerIdRef.current
          });
        }
      },
      (state) => {
        if (state === 'connected') {
          setMatchStatus('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          setMatchStatus('disconnected');
        }
      },
      (dataMsg) => {
        setMessages((prev) => [
          ...prev,
          {
            id: 'dc_' + Date.now(),
            sender: 'peer',
            text: dataMsg,
            timestamp: Date.now()
          }
        ]);
        setUnreadCount((c) => (chatOpen ? 0 : c + 1));
      }
    );

    if (localStream) {
      rtc.setLocalStream(localStream);
    }
    webrtcRef.current = rtc;

    // Instantiate Signaling Client
    const sig = new SignalingClient(
      userId,
      userCountry.name,
      userCountry.code,
      targetCountry.name,
      handleSignalingMessage,
      (connected) => {
        if (!connected) {
          // Socket disconnected
        }
      }
    );
    signalingRef.current = sig;

    return () => {
      rtc.close();
      sig.destroy();
    };
  }, [userId, userCountry, handleSignalingMessage]);

  // Keep local stream updated in WebRTC manager
  useEffect(() => {
    if (webrtcRef.current && localStream) {
      webrtcRef.current.setLocalStream(localStream);
    }
  }, [localStream]);

  // 6. Action: Start Matchmaking Search
  const handleStartSearch = async () => {
    let stream = localStream;
    if (!stream) {
      stream = await initMedia();
      if (!stream) return;
    }

    if (signalingRef.current) {
      setMatchStatus('searching');
      setRemoteStream(null);
      signalingRef.current.send({
        type: 'start_search',
        targetCountry: targetCountry.name
      });
    }
  };

  // 7. Action: Next Partner
  const handleNext = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setRemoteStream(null);
    setCurrentPeerId(null);
    setCurrentMatchId(null);
    setMatchStatus('searching');
    setMessages([]);

    if (signalingRef.current) {
      signalingRef.current.send({
        type: 'next_partner',
        targetCountry: targetCountry.name
      });
    }
  };

  // 8. Action: Stop Chat
  const handleStop = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setRemoteStream(null);
    setCurrentPeerId(null);
    setCurrentMatchId(null);
    setMatchStatus('idle');

    if (signalingRef.current) {
      signalingRef.current.send({
        type: 'stop_search'
      });
    }
  };

  // 9. Camera & Mic Toggles
  const handleToggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const nextState = !videoTrack.enabled;
      videoTrack.enabled = nextState;
      setCameraEnabled(nextState);
    }
  };

  const handleToggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const nextState = !audioTrack.enabled;
      audioTrack.enabled = nextState;
      setMicEnabled(nextState);
    }
  };

  // 10. Country Selector Change
  const handleSelectTargetCountry = (country: Country) => {
    setTargetCountry(country);
    if (signalingRef.current) {
      signalingRef.current.send({
        type: 'update_preferences',
        targetCountry: country.name
      });
    }

    // Update in MySQL backend
    fetch('/api/update_country', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        country: userCountry.name,
        country_code: userCountry.code
      })
    }).catch(() => {});

    // If currently searching, immediately re-queue with target country
    if (matchStatus === 'searching') {
      signalingRef.current?.send({
        type: 'start_search',
        targetCountry: country.name
      });
    }
  };

  // 11. Send Text Message
  const handleSendMessage = (text: string) => {
    if (!currentPeerId) return;

    // Send via WebRTC DataChannel first, fallback to signaling socket
    const sentViaDC = webrtcRef.current?.sendDataChatMessage(text);
    if (!sentViaDC && signalingRef.current) {
      signalingRef.current.send({
        type: 'chat_message',
        text,
        targetUserId: currentPeerId,
        timestamp: Date.now()
      });
    }

    setMessages((prev) => [
      ...prev,
      {
        id: 'me_' + Date.now(),
        sender: 'me',
        text,
        timestamp: Date.now()
      }
    ]);
  };

  // 12. Submit User Report
  const handleSubmitReport = async (reason: string, details: string, autoNext: boolean): Promise<boolean> => {
    if (!currentPeerId) return false;
    try {
      const res = await fetch('/api/report_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter_id: userId,
          reported_user_id: currentPeerId,
          match_id: currentMatchId,
          reason,
          details
        })
      });
      const data = await res.json();
      if (data.success && autoNext) {
        handleNext();
      }
      return data.success;
    } catch {
      return false;
    }
  };

  // 13. Hotkeys (Spacebar / Right Arrow for Next, M for Mute, V for Camera)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (matchStatus === 'idle') {
          handleStartSearch();
        } else {
          handleNext();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMic();
      } else if (e.key === 'v' || e.key === 'V') {
        handleToggleCamera();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [matchStatus, localStream]);

  // 14. Helper to Open 2nd Test Window
  const handleOpenTestWindow = () => {
    window.open(window.location.href, '_blank', 'width=1000,height=750');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation & Status Header */}
      <Header
        userCountry={userCountry}
        targetCountry={targetCountry}
        onSelectTargetCountry={handleSelectTargetCountry}
        onlineCount={onlineCount}
        inMatchCount={inMatchCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenTestWindow={handleOpenTestWindow}
      />

      {/* Main Interactive Stage */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <VideoArea
          localStream={localStream}
          remoteStream={remoteStream}
          cameraEnabled={cameraEnabled}
          micEnabled={micEnabled}
          matchStatus={matchStatus}
          peerCountry={peerCountry}
          peerCountryCode={peerCountryCode}
          userCountry={userCountry}
          targetCountry={targetCountry}
          permissionError={permissionError}
          onRetryPermissions={() => initMedia(selectedVideoDeviceId, selectedAudioDeviceId)}
          onStartSearch={handleStartSearch}
          isAudioSpeaking={isAudioSpeaking}
        />

        {/* Text Chat Drawer (collapsible or side panel) */}
        <TextChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          peerCountry={peerCountry}
          isConnected={matchStatus === 'connected'}
        />
      </main>

      {/* Bottom Controls Bar */}
      <Controls
        matchStatus={matchStatus}
        cameraEnabled={cameraEnabled}
        micEnabled={micEnabled}
        chatOpen={chatOpen}
        unreadCount={unreadCount}
        onNext={handleNext}
        onStart={handleStartSearch}
        onStop={handleStop}
        onToggleCamera={handleToggleCamera}
        onToggleMic={handleToggleMic}
        onToggleChat={() => {
          setChatOpen(!chatOpen);
          if (!chatOpen) setUnreadCount(0);
        }}
        onOpenReport={() => setIsReportOpen(true)}
      />

      {/* Modals */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onSubmitReport={handleSubmitReport}
        reportedPeerName={peerCountry || 'Stranger'}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={userId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedAudioDeviceId={selectedAudioDeviceId}
        onDeviceChange={(vid, aud) => {
          setSelectedVideoDeviceId(vid);
          setSelectedAudioDeviceId(aud);
          initMedia(vid, aud);
        }}
      />
    </div>
  );
}

export default App;
