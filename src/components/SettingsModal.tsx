import React, { useState, useEffect } from 'react';
import { Settings, X, Video, Mic, Server, User, Copy, Check, Activity } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  selectedVideoDeviceId: string;
  selectedAudioDeviceId: string;
  onDeviceChange: (videoDeviceId: string, audioDeviceId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  onDeviceChange
}) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeVideoId, setActiveVideoId] = useState(selectedVideoDeviceId);
  const [activeAudioId, setActiveAudioId] = useState(selectedAudioDeviceId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      }).catch(err => {
        console.warn('Could not enumerate media devices:', err);
      });
    }
  }, [isOpen]);

  const handleApply = () => {
    onDeviceChange(activeVideoId, activeAudioId);
    onClose();
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2 text-indigo-400">
            <Settings className="w-5 h-5" />
            <h3 className="font-bold text-white text-sm">Media & WebRTC Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Device Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>Camera Device</span>
            </label>
            <select
              value={activeVideoId}
              onChange={(e) => setActiveVideoId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">Default Camera</option>
              {videoDevices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Microphone Device Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span>Microphone Device</span>
            </label>
            <select
              value={activeAudioId}
              onChange={(e) => setActiveAudioId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">Default Microphone</option>
              {audioDevices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* WebRTC STUN Info */}
          <div className="bg-slate-850 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>WebRTC STUN Configuration</span>
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Active: <code className="text-amber-300">stun:stun.l.google.com:19302</code> (UDP Direct P2P).
            </p>
          </div>

          {/* User ID Identifier */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Your Unique User ID (MySQL users.unique_user_id)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userId}
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={copyUserId}
                className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Copy User ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Saved in the backend database. Never exposes your IP address to other users.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
