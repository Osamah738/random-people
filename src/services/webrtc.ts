export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export const DEFAULT_RTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export class WebRTCManager {
  public pc: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public dataChannel: RTCDataChannel | null = null;

  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onChatMessageCallback: ((msg: string) => void) | null = null;

  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    onChatMessage: (msg: string) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onIceCandidateCallback = onIceCandidate;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
    this.onChatMessageCallback = onChatMessage;
  }

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    if (this.pc) {
      // Replace or add tracks
      const senders = this.pc.getSenders();
      stream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          this.pc?.addTrack(track, stream);
        }
      });
    }
  }

  public initPeerConnection(isInitiator: boolean): RTCPeerConnection {
    this.close();

    this.remoteStream = new MediaStream();
    this.pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
    this.pendingCandidates = [];

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }

    // Remote track listener
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      } else {
        event.track.onunmute = () => {
          if (!this.remoteStream?.getTracks().includes(event.track)) {
            this.remoteStream?.addTrack(event.track);
          }
          if (this.onRemoteStreamCallback && this.remoteStream) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        };
      }
    };

    // ICE Candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc) {
        if (this.pc.iceConnectionState === 'failed') {
          this.pc.restartIce();
        }
      }
    };

    // Data Channel setup
    if (isInitiator) {
      try {
        this.dataChannel = this.pc.createDataChannel('chat', { ordered: true });
        this.setupDataChannel(this.dataChannel);
      } catch (err) {
        console.warn('Could not create data channel:', err);
      }
    } else {
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }

    return this.pc;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onmessage = (event) => {
      if (this.onChatMessageCallback) {
        this.onChatMessageCallback(event.data);
      }
    };
  }

  public sendDataChatMessage(text: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(text);
        return true;
      } catch (e) {
        console.warn('Failed to send on data channel:', e);
      }
    }
    return false;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('Error creating offer:', err);
      return null;
    }
  }

  public async handleOffer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      // Process any buffered candidates
      await this.flushPendingCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.error('Error handling offer:', err);
      return null;
    }
  }

  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      await this.flushPendingCandidates();
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) return;
    while (this.pendingCandidates.length > 0) {
      const c = this.pendingCandidates.shift();
      if (c) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          console.warn('Error applying queued candidate:', err);
        }
      }
    }
  }

  public close() {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.ontrack = null;
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
  }
}
