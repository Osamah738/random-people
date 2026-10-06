import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, Maximize, AlertCircle, RefreshCw, Radio, UserX, ShieldAlert, Sparkles } from 'lucide-react';
import { Country } from '../data/countries';

interface VideoAreaProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  matchStatus: 'idle' | 'searching' | 'connecting' | 'connected' | 'skipped' | 'disconnected';
  peerCountry: string | null;
  peerCountryCode: string | null;
  userCountry: Country;
  targetCountry: Country;
  permissionError: string | null;
  onRetryPermissions: () => void;
  onStartSearch: () => void;
  isAudioSpeaking: boolean;
}

export const VideoArea: React.FC<VideoAreaProps> = ({
  localStream,
  remoteStream,
  cameraEnabled,
  micEnabled,
  matchStatus,
  peerCountry,
  peerCountryCode,
  userCountry,
  targetCountry,
  permissionError,
  onRetryPermissions,
  onStartSearch,
  isAudioSpeaking
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraEnabled]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => {
        console.warn('Autoplay error for remote video:', e);
      });
    }
  }, [remoteStream, matchStatus]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full bg-slate-950 flex flex-col md:flex-row overflow-hidden p-3 md:p-4 gap-3 md:gap-4 select-none"
    >
      {/* 1. Main Remote Video Area (The Other Person) */}
      <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[260px] shadow-2xl">
        {/* Remote Video Stream Element */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            matchStatus === 'connected' && remoteStream ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* Remote Overlay Badges (When connected) */}
        {matchStatus === 'connected' && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/70 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{peerCountry || 'Stranger'}</span>
            </div>
            <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
              Live P2P
            </div>
          </div>
        )}

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/50 transition cursor-pointer"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* State: Searching / Looking for someone... */}
        {matchStatus === 'searching' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 text-center z-10">
            {/* Animated Radar Pulse */}
            <div className="relative flex items-center justify-center mb-6">
              <div className="w-32 h-32 rounded-full border border-rose-500/30 animate-ping opacity-75"></div>
              <div className="w-24 h-24 rounded-full border border-rose-500/50 absolute animate-pulse"></div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-xl shadow-rose-500/25">
                <Radio className="w-8 h-8 text-white animate-spin-slow" />
              </div>
            </div>

            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2">
              Looking for someone...
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mb-4">
              Searching waiting queue for partners{' '}
              {targetCountry.code !== 'ALL' ? (
                <span className="text-rose-400 font-semibold">
                  from {targetCountry.flag} {targetCountry.name}
                </span>
              ) : (
                <span className="text-amber-400 font-semibold">worldwide</span>
              )}
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Real users only • P2P WebRTC connection</span>
            </div>
          </div>
        )}

        {/* State: Connecting (WebRTC Handshake) */}
        {matchStatus === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6 text-center z-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Found a match!</h3>
            <p className="text-xs text-slate-400">
              Negotiating peer-to-peer WebRTC video stream with {peerCountry || 'Stranger'}...
            </p>
          </div>
        )}

        {/* State: Skipped / Partner Left */}
        {matchStatus === 'skipped' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 text-slate-400">
              <UserX className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Partner left the chat</h3>
            <p className="text-xs text-slate-400 mb-4">Click "NEXT" to immediately connect with someone else.</p>
          </div>
        )}

        {/* State: Idle / Welcome */}
        {matchStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950/90 p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4 shadow-inner">
              <Camera className="w-8 h-8 text-rose-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
              Ready to meet new people?
            </h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
              Enable your camera and microphone, select your preferred country filter, and start chatting with random real users worldwide instantly.
            </p>
            <button
              onClick={onStartSearch}
              className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-500/25 transition cursor-pointer flex items-center gap-2 transform active:scale-95"
            >
              <span>Start Video Chat</span>
              <span className="text-xs opacity-80">(Spacebar)</span>
            </button>
          </div>
        )}

        {/* State: Permission Error */}
        {permissionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/90 backdrop-blur-md p-6 text-center z-20">
            <div className="w-14 h-14 rounded-full bg-rose-900/50 border border-rose-500/50 flex items-center justify-center mb-4 text-rose-300">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Camera & Microphone Access Required</h3>
            <p className="text-xs text-rose-200/90 max-w-sm mb-6 leading-relaxed">
              {permissionError}
            </p>
            <button
              onClick={onRetryPermissions}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold px-5 py-2.5 rounded-lg text-xs transition cursor-pointer shadow-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Permission Request</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Local Video Area (You) */}
      <div className="relative w-full md:w-80 h-48 md:h-auto md:min-h-[220px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-2xl flex-shrink-0">
        {/* Local Video Stream */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            cameraEnabled && localStream ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* Camera Off Placeholder */}
        {(!cameraEnabled || !localStream) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-925 p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-2 text-slate-500">
              <CameraOff className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-400">Camera is off</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Toggle camera button below to enable</p>
          </div>
        )}

        {/* Local User Overlay Badges */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow">
            <span>You</span>
            <span className="text-[11px] text-slate-400">({userCountry.flag} {userCountry.code})</span>
          </div>
        </div>

        {/* Local Mic Status & Audio VU Indicator */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
          <div
            className={`px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition ${
              micEnabled
                ? isAudioSpeaking
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 ring-2 ring-emerald-500/20'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-700/60'
                : 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
            }`}
          >
            {micEnabled ? (
              <>
                <Mic className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px]">{isAudioSpeaking ? 'Speaking' : 'Mic On'}</span>
              </>
            ) : (
              <>
                <MicOff className="w-3 h-3 text-rose-400" />
                <span className="text-[10px]">Muted</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
