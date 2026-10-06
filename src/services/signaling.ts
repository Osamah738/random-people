export type SignalingMessage =
  | { type: 'register'; userId: string; country: string; countryCode: string; targetCountry: string }
  | { type: 'registered'; userId: string; activeCount: number }
  | { type: 'update_preferences'; country?: string; countryCode?: string; targetCountry?: string }
  | { type: 'start_search'; targetCountry: string }
  | { type: 'searching'; targetCountry: string }
  | { type: 'next_partner'; targetCountry: string }
  | { type: 'stop_search' }
  | { type: 'stopped' }
  | { type: 'match_found'; matchId: string; peerId: string; peerCountry: string; peerCountryCode: string; isInitiator: boolean }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; targetUserId: string; fromUserId?: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; targetUserId: string; fromUserId?: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit; targetUserId: string; fromUserId?: string }
  | { type: 'chat_message'; text: string; targetUserId: string; fromUserId?: string; timestamp?: number }
  | { type: 'peer_left'; userId: string; reason?: string }
  | { type: 'ping' }
  | { type: 'pong' };

export class SignalingClient {
  private ws: WebSocket | null = null;
  private userId: string;
  private country: string;
  private countryCode: string;
  private targetCountry: string;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private onMessageCallback: (msg: SignalingMessage) => void;
  private onStatusChangeCallback: (connected: boolean) => void;
  private isDestroyed = false;

  constructor(
    userId: string,
    country: string,
    countryCode: string,
    targetCountry: string,
    onMessage: (msg: SignalingMessage) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.userId = userId;
    this.country = country;
    this.countryCode = countryCode;
    this.targetCountry = targetCountry;
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
    this.connect();
  }

  public connect() {
    if (this.isDestroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChangeCallback(true);
        // Register client immediately
        this.send({
          type: 'register',
          userId: this.userId,
          country: this.country,
          countryCode: this.countryCode,
          targetCountry: this.targetCountry
        });

        // Start ping interval
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' });
          }
        }, 12000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.onMessageCallback(msg);
        } catch (e) {
          console.error('Failed to parse signaling message:', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChangeCallback(false);
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (!this.isDestroyed) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Signaling socket error:', err);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      if (!this.isDestroyed) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    }
  }

  public updateIdentity(userId: string, country: string, countryCode: string, targetCountry: string) {
    this.userId = userId;
    this.country = country;
    this.countryCode = countryCode;
    this.targetCountry = targetCountry;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'update_preferences',
        country,
        countryCode,
        targetCountry
      });
    }
  }

  public send(msg: SignalingMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
