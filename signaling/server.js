/**
 * Standalone Node.js WebRTC Signaling Server
 * Usage: node signaling/server.js
 */

import { WebSocketServer } from 'ws';

const PORT = process.env.SIGNALING_PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const clients = new Map(); // userId => ws

wss.on('connection', (ws) => {
  let boundUserId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { type, userId, targetUserId } = data;

      if (type === 'register' && userId) {
        boundUserId = userId;
        clients.set(userId, ws);
        ws.send(JSON.stringify({ type: 'registered', userId }));
      } else if (['offer', 'answer', 'candidate', 'chat_message'].includes(type)) {
        if (targetUserId && clients.has(targetUserId)) {
          const targetWs = clients.get(targetUserId);
          if (targetWs.readyState === 1) {
            targetWs.send(JSON.stringify({ ...data, fromUserId: boundUserId }));
          }
        }
      } else if (type === 'leave_match') {
        const peer = data.peerId;
        if (peer && clients.has(peer)) {
          clients.get(peer).send(JSON.stringify({ type: 'peer_left', userId: boundUserId }));
        }
      }
    } catch (err) {
      console.error('Signaling error:', err);
    }
  });

  ws.on('close', () => {
    if (boundUserId) {
      clients.delete(boundUserId);
    }
  });
});

console.log(`[Standalone Signaling] WebSocket server listening on ws://localhost:${PORT}`);
