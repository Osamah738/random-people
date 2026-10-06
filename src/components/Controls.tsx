import React from 'react';
import { Play, SkipForward, Square, Camera, CameraOff, Mic, MicOff, MessageSquare, Flag, Sparkles } from 'lucide-react';

interface ControlsProps {
  matchStatus: 'idle' | 'searching' | 'connecting' | 'connected' | 'skipped' | 'disconnected';
  cameraEnabled: boolean;
  micEnabled: boolean;
  chatOpen: boolean;
  unreadCount: number;
  onNext: () => void;
  onStart: () => void;
  onStop: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleChat: () => void;
  onOpenReport: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  matchStatus,
  cameraEnabled,
  micEnabled,
  chatOpen,
  unreadCount,
  onNext,
  onStart,
  onStop,
  onToggleCamera,
  onToggleMic,
  onToggleChat,
  onOpenReport
}) => {
  const isSearchingOrConnected = matchStatus === 'searching' || matchStatus === 'connecting' || matchStatus === 'connected';

  return (
    <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 md:py-4 flex flex-col md:flex-row items-center justify-between gap-3 z-20">
      {/* Left Action Buttons: Mic, Camera, Chat */}
      <div className="flex items-center gap-2">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-xl flex items-center justify-center transition cursor-pointer border ${
            micEnabled
              ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
          }`}
          title={micEnabled ? 'Mute microphone (M)' : 'Unmute microphone (M)'}
        >
          {micEnabled ? <Mic className="w-5 h-5 text-emerald-400" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-xl flex items-center justify-center transition cursor-pointer border ${
            cameraEnabled
              ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
          }`}
          title={cameraEnabled ? 'Turn camera off (V)' : 'Turn camera on (V)'}
        >
          {cameraEnabled ? <Camera className="w-5 h-5 text-emerald-400" /> : <CameraOff className="w-5 h-5" />}
        </button>

        {/* Text Chat Drawer Toggle */}
        <button
          onClick={onToggleChat}
          className={`relative p-3 rounded-xl flex items-center justify-center transition cursor-pointer border ${
            chatOpen
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
              : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
          }`}
          title="Toggle text chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Report Button */}
        <button
          onClick={onOpenReport}
          disabled={matchStatus !== 'connected' && matchStatus !== 'skipped'}
          className={`p-3 rounded-xl flex items-center justify-center transition border ${
            matchStatus === 'connected' || matchStatus === 'skipped'
              ? 'bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border-slate-700 cursor-pointer'
              : 'bg-slate-850 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
          }`}
          title="Report inappropriate behavior / violation"
        >
          <Flag className="w-5 h-5" />
        </button>
      </div>

      {/* Center Main Control: NEXT / START Button */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-center">
        {!isSearchingOrConnected ? (
          <button
            onClick={onStart}
            className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 active:scale-98 text-white font-black text-sm md:text-base rounded-xl shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>START CHAT</span>
            <span className="text-xs font-normal opacity-75">(Space)</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* NEXT Button */}
            <button
              onClick={onNext}
              className="flex-1 md:flex-initial px-8 py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 active:scale-98 text-white font-black text-sm md:text-base rounded-xl shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <SkipForward className="w-5 h-5 fill-white" />
              <span>NEXT</span>
              <span className="text-xs font-normal opacity-75">(Space / →)</span>
            </button>

            {/* STOP Button */}
            <button
              onClick={onStop}
              className="px-4 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition cursor-pointer font-bold text-sm flex items-center gap-1.5"
              title="Stop video chat session"
            >
              <Square className="w-4 h-4 fill-slate-300" />
              <span className="hidden sm:inline">STOP</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Guide Hint */}
      <div className="hidden lg:flex items-center text-xs text-slate-400 gap-3">
        <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
          <kbd className="font-mono text-slate-300 font-bold">Space</kbd> Next
        </span>
        <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
          <kbd className="font-mono text-slate-300 font-bold">M</kbd> Mute
        </span>
        <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
          <kbd className="font-mono text-slate-300 font-bold">V</kbd> Camera
        </span>
      </div>
    </div>
  );
};
