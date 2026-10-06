import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json());

// Persistent database file
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'omelive_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface UserRecord {
  id: number;
  unique_user_id: string;
  country: string;
  country_code: string;
  ip_hash: string;
  online_status: 'offline' | 'waiting' | 'matched';
  created_at: string;
  last_seen: string;
}

interface SessionRecord {
  id: number;
  session_token: string;
  unique_user_id: string;
  ip_hash: string;
  created_at: string;
  last_activity: string;
  is_active: number;
}

interface MatchRecord {
  id: number;
  match_id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_country: string;
  user_b_country: string;
  target_country_a: string;
  target_country_b: string;
  status: 'connecting' | 'active' | 'ended';
  created_at: string;
  ended_at: string | null;
  ended_by: string | null;
}

interface ReportRecord {
  id: number;
  report_id: string;
  reporter_id: string;
  reported_user_id: string;
  match_id: string | null;
  reason: string;
  details: string;
  status: 'pending' | 'resolved';
  created_at: string;
}

interface BanRecord {
  id: number;
  ban_id: string;
  unique_user_id: string;
  ip_hash: string | null;
  reason: string;
  banned_by: string;
  is_active: number;
  created_at: string;
  expires_at: string | null;
}

interface DatabaseSchema {
  users: UserRecord[];
  sessions: SessionRecord[];
  matches: MatchRecord[];
  reports: ReportRecord[];
  bans: BanRecord[];
  nextIds: {
    users: number;
    sessions: number;
    matches: number;
    reports: number;
    bans: number;
  };
}

const defaultDbState: DatabaseSchema = {
  users: [],
  sessions: [],
  matches: [],
  reports: [],
  bans: [],
  nextIds: {
    users: 1,
    sessions: 1,
    matches: 1,
    reports: 1,
    bans: 1
  }
};

function readDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading DB, reinitializing:', err);
  }
  writeDb(defaultDbState);
  return defaultDbState;
}

function writeDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

// IP anonymization helper
const APP_SECRET_SALT = process.env.APP_SECRET_SALT || 'omelive_production_salt_873617a';
function getIpHash(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = '127.0.0.1';
  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }
  return crypto.createHash('sha256').update(`${ip}_${APP_SECRET_SALT}`).digest('hex');
}

// Check active ban
function checkBan(db: DatabaseSchema, userId: string, ipHash: string): BanRecord | null {
  const now = new Date();
  const ban = db.bans.find(b => 
    b.is_active === 1 &&
    (b.unique_user_id === userId || (b.ip_hash && b.ip_hash === ipHash)) &&
    (!b.expires_at || new Date(b.expires_at) > now)
  );
  return ban || null;
}

// --- REST API Endpoints ---
const apiRouter = express.Router();

// CORS & JSON middleware for API
apiRouter.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1. Create or register user
const handleCreateUser = (req: express.Request, res: express.Response) => {
  const db = readDb();
  let { user_id, country = 'United States', country_code = 'US' } = req.body || {};
  const ipHash = getIpHash(req);

  if (!user_id || typeof user_id !== 'string') {
    user_id = 'usr_' + crypto.randomBytes(16).toString('hex');
  }

  // Check ban
  const ban = checkBan(db, user_id, ipHash);
  if (ban) {
    return res.status(403).json({
      success: false,
      banned: true,
      reason: ban.reason,
      expires_at: ban.expires_at
    });
  }

  const nowIso = new Date().toISOString();
  let existingUser = db.users.find(u => u.unique_user_id === user_id);

  if (existingUser) {
    existingUser.country = country;
    existingUser.country_code = country_code;
    existingUser.ip_hash = ipHash;
    existingUser.last_seen = nowIso;
    existingUser.online_status = 'waiting';
  } else {
    existingUser = {
      id: db.nextIds.users++,
      unique_user_id: user_id,
      country,
      country_code,
      ip_hash: ipHash,
      online_status: 'waiting',
      created_at: nowIso,
      last_seen: nowIso
    };
    db.users.push(existingUser);
  }

  // Create session
  const sessionToken = 'sess_' + crypto.randomBytes(24).toString('hex');
  db.sessions.push({
    id: db.nextIds.sessions++,
    session_token: sessionToken,
    unique_user_id: user_id,
    ip_hash: ipHash,
    created_at: nowIso,
    last_activity: nowIso,
    is_active: 1
  });

  writeDb(db);

  res.json({
    success: true,
    user_id,
    session_token: sessionToken,
    country,
    country_code
  });
};

apiRouter.post('/create_user', handleCreateUser);
apiRouter.post('/create_user.php', handleCreateUser);

// 2. Get user info
const handleGetUser = (req: express.Request, res: express.Response) => {
  const db = readDb();
  const userId = (req.query.user_id || req.body.user_id) as string;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  const ipHash = getIpHash(req);
  const ban = checkBan(db, userId, ipHash);
  if (ban) {
    return res.status(403).json({
      success: false,
      banned: true,
      reason: ban.reason,
      expires_at: ban.expires_at
    });
  }

  const user = db.users.find(u => u.unique_user_id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, user });
};

apiRouter.get('/get_user', handleGetUser);
apiRouter.get('/get_user.php', handleGetUser);

// 3. Update country
const handleUpdateCountry = (req: express.Request, res: express.Response) => {
  const db = readDb();
  const { user_id, country, country_code = 'US' } = req.body || {};

  if (!user_id || !country) {
    return res.status(400).json({ success: false, error: 'user_id and country are required' });
  }

  const user = db.users.find(u => u.unique_user_id === user_id);
  if (user) {
    user.country = country;
    user.country_code = country_code;
    user.last_seen = new Date().toISOString();
    writeDb(db);
  }

  res.json({ success: true, country, country_code });
};

apiRouter.post('/update_country', handleUpdateCountry);
apiRouter.post('/update_country.php', handleUpdateCountry);

// 4. Heartbeat
const handleHeartbeat = (req: express.Request, res: express.Response) => {
  const db = readDb();
  const { user_id } = req.body || {};

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  const now = new Date();
  const user = db.users.find(u => u.unique_user_id === user_id);
  if (user) {
    user.last_seen = now.toISOString();
  }

  // Garbage collection: mark users offline after 35 seconds of silence
  const cutoff = new Date(now.getTime() - 35000);
  for (const u of db.users) {
    if (new Date(u.last_seen) < cutoff && u.online_status !== 'offline') {
      u.online_status = 'offline';
    }
  }

  // Close matches if any user went offline
  for (const m of db.matches) {
    if (m.status === 'connecting' || m.status === 'active') {
      const uA = db.users.find(u => u.unique_user_id === m.user_a_id);
      const uB = db.users.find(u => u.unique_user_id === m.user_b_id);
      if ((uA && uA.online_status === 'offline') || (uB && uB.online_status === 'offline')) {
        m.status = 'ended';
        m.ended_at = now.toISOString();
        m.ended_by = 'system_timeout';
      }
    }
  }

  writeDb(db);

  // Check active match
  const activeMatch = db.matches.find(m => 
    (m.user_a_id === user_id || m.user_b_id === user_id) && 
    (m.status === 'connecting' || m.status === 'active')
  );

  res.json({
    success: true,
    in_match: !!activeMatch,
    match: activeMatch || null
  });
};

apiRouter.post('/heartbeat', handleHeartbeat);
apiRouter.post('/heartbeat.php', handleHeartbeat);

// 5. End Match
const handleEndMatch = (req: express.Request, res: express.Response) => {
  const db = readDb();
  const { user_id, match_id } = req.body || {};

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  const nowIso = new Date().toISOString();
  db.matches.forEach(m => {
    if (
      (m.match_id === match_id || m.user_a_id === user_id || m.user_b_id === user_id) &&
      (m.status === 'connecting' || m.status === 'active')
    ) {
      m.status = 'ended';
      m.ended_at = nowIso;
      m.ended_by = user_id;
    }
  });

  const user = db.users.find(u => u.unique_user_id === user_id);
  if (user) {
    user.online_status = 'waiting';
    user.last_seen = nowIso;
  }

  writeDb(db);
  res.json({ success: true, message: 'Match ended successfully.' });
};

apiRouter.post('/end_match', handleEndMatch);
apiRouter.post('/end_match.php', handleEndMatch);

// 6. Report User
const handleReportUser = (req: express.Request, res: express.Response) => {
  const db = readDb();
  const { reporter_id, reported_user_id, match_id, reason = 'Inappropriate behavior', details = '' } = req.body || {};

  if (!reporter_id || !reported_user_id) {
    return res.status(400).json({ success: false, error: 'reporter_id and reported_user_id required' });
  }

  const nowIso = new Date().toISOString();
  const reportId = 'rep_' + crypto.randomBytes(16).toString('hex');

  db.reports.push({
    id: db.nextIds.reports++,
    report_id: reportId,
    reporter_id,
    reported_user_id,
    match_id: match_id || null,
    reason,
    details: details.slice(0, 1000),
    status: 'pending',
    created_at: nowIso
  });

  // End active match
  if (match_id) {
    db.matches.forEach(m => {
      if (m.match_id === match_id) {
        m.status = 'ended';
        m.ended_at = nowIso;
        m.ended_by = reporter_id;
      }
    });
  }

  // Count rapid reports within 24h
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const recentReports = db.reports.filter(r => 
    r.reported_user_id === reported_user_id && new Date(r.created_at) >= oneDayAgo
  );

  if (recentReports.length >= 5) {
    // Auto suspension
    const banId = 'ban_auto_' + crypto.randomBytes(8).toString('hex');
    db.bans.push({
      id: db.nextIds.bans++,
      ban_id: banId,
      unique_user_id: reported_user_id,
      ip_hash: null,
      reason: 'Automated 24h suspension due to 5+ user reports',
      banned_by: 'system_moderation',
      is_active: 1,
      created_at: nowIso,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    });
  }

  writeDb(db);

  res.json({
    success: true,
    report_id: reportId,
    message: 'Report received and queued for moderator review.'
  });
};

apiRouter.post('/report_user', handleReportUser);
apiRouter.post('/report_user.php', handleReportUser);

// 7. Admin Moderation API
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'admin12345';

apiRouter.post('/admin/login', (req, res) => {
  const { key } = req.body || {};
  if (key === ADMIN_KEY) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Invalid secret key' });
});

apiRouter.post('/admin/data', (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const db = readDb();
  const now = new Date();
  const onlineUsers = db.users.filter(u => u.online_status !== 'offline' && (now.getTime() - new Date(u.last_seen).getTime()) < 35000);
  const activeMatches = db.matches.filter(m => m.status === 'connecting' || m.status === 'active');
  const pendingReports = db.reports.filter(r => r.status === 'pending');
  const activeBans = db.bans.filter(b => b.is_active === 1);

  res.json({
    success: true,
    stats: {
      totalUsers: db.users.length,
      onlineUsers: onlineUsers.length,
      activeMatches: activeMatches.length,
      totalReports: db.reports.length,
      pendingReports: pendingReports.length,
      activeBans: activeBans.length
    },
    users: db.users.slice(-50).reverse(),
    reports: db.reports.slice(-50).reverse(),
    bans: activeBans,
    matches: activeMatches
  });
});

apiRouter.post('/admin/ban', (req, res) => {
  const { key, user_id, reason = 'Administrative suspension', hours = 24 } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const db = readDb();
  const nowIso = new Date().toISOString();
  const banId = 'ban_' + crypto.randomBytes(8).toString('hex');
  const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null;

  db.bans.push({
    id: db.nextIds.bans++,
    ban_id: banId,
    unique_user_id: user_id,
    ip_hash: null,
    reason,
    banned_by: 'admin',
    is_active: 1,
    created_at: nowIso,
    expires_at: expiresAt
  });

  // Kick user from any active match
  db.matches.forEach(m => {
    if ((m.user_a_id === user_id || m.user_b_id === user_id) && (m.status === 'connecting' || m.status === 'active')) {
      m.status = 'ended';
      m.ended_at = nowIso;
      m.ended_by = 'admin_ban';
    }
  });

  writeDb(db);
  res.json({ success: true, message: `User ${user_id} banned successfully.` });
});

apiRouter.post('/admin/unban', (req, res) => {
  const { key, user_id } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const db = readDb();
  let count = 0;
  db.bans.forEach(b => {
    if (b.unique_user_id === user_id && b.is_active === 1) {
      b.is_active = 0;
      count++;
    }
  });
  writeDb(db);
  res.json({ success: true, message: `Unbanned ${count} ban record(s).` });
});

apiRouter.post('/admin/resolve_report', (req, res) => {
  const { key, report_id } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const db = readDb();
  const report = db.reports.find(r => r.report_id === report_id);
  if (report) {
    report.status = 'resolved';
    writeDb(db);
  }
  res.json({ success: true, message: 'Report resolved.' });
});

app.use('/api', apiRouter);

// --- HTTP and WebSocket Setup ---
const httpServer = createHttpServer(app);
const wss = new WebSocketServer({ server: httpServer });

interface ConnectedUser {
  ws: WebSocket;
  userId: string;
  country: string;
  countryCode: string;
  targetCountry: string;
  status: 'idle' | 'waiting' | 'matched';
  currentMatchId: string | null;
  currentPeerId: string | null;
  lastPeerId: string | null;
  joinedQueueAt: number;
}

const activeSockets = new Map<string, ConnectedUser>(); // userId -> ConnectedUser

// Matchmaker Engine
function tryMatchUsers() {
  const waitingUsers = Array.from(activeSockets.values()).filter(u => u.status === 'waiting');
  if (waitingUsers.length < 2) return;

  // Sort waiting users by wait duration (FIFO)
  waitingUsers.sort((a, b) => a.joinedQueueAt - b.joinedQueueAt);

  const matchedSet = new Set<string>();

  for (let i = 0; i < waitingUsers.length; i++) {
    const userA = waitingUsers[i];
    if (matchedSet.has(userA.userId)) continue;

    for (let j = i + 1; j < waitingUsers.length; j++) {
      const userB = waitingUsers[j];
      if (matchedSet.has(userB.userId)) continue;

      // 1. Never match with oneself
      if (userA.userId === userB.userId) continue;

      // 2. Country filter compatibility
      const aWantsAny = !userA.targetCountry || userA.targetCountry.toLowerCase() === 'any';
      const bWantsAny = !userB.targetCountry || userB.targetCountry.toLowerCase() === 'any';

      const aCompatible = aWantsAny || userA.targetCountry.toLowerCase() === userB.country.toLowerCase();
      const bCompatible = bWantsAny || userB.targetCountry.toLowerCase() === userA.country.toLowerCase();

      if (!aCompatible || !bCompatible) {
        continue;
      }

      // 3. Avoid immediate repeat matching if other candidates exist
      if (userA.lastPeerId === userB.userId && waitingUsers.length > 2) {
        continue;
      }

      // We have a match!
      matchedSet.add(userA.userId);
      matchedSet.add(userB.userId);

      const matchId = 'mat_' + crypto.randomBytes(16).toString('hex');
      const nowIso = new Date().toISOString();

      userA.status = 'matched';
      userA.currentMatchId = matchId;
      userA.currentPeerId = userB.userId;
      userA.lastPeerId = userB.userId;

      userB.status = 'matched';
      userB.currentMatchId = matchId;
      userB.currentPeerId = userA.userId;
      userB.lastPeerId = userA.userId;

      // Record in database
      const db = readDb();
      db.matches.push({
        id: db.nextIds.matches++,
        match_id: matchId,
        user_a_id: userA.userId,
        user_b_id: userB.userId,
        user_a_country: userA.country,
        user_b_country: userB.country,
        target_country_a: userA.targetCountry,
        target_country_b: userB.targetCountry,
        status: 'connecting',
        created_at: nowIso,
        ended_at: null,
        ended_by: null
      });

      // Update users online status
      const u1 = db.users.find(u => u.unique_user_id === userA.userId);
      if (u1) u1.online_status = 'matched';
      const u2 = db.users.find(u => u.unique_user_id === userB.userId);
      if (u2) u2.online_status = 'matched';
      writeDb(db);

      // Notify User A (initiator)
      if (userA.ws.readyState === WebSocket.OPEN) {
        userA.ws.send(JSON.stringify({
          type: 'match_found',
          matchId,
          peerId: userB.userId,
          peerCountry: userB.country,
          peerCountryCode: userB.countryCode,
          isInitiator: true
        }));
      }

      // Notify User B (receiver)
      if (userB.ws.readyState === WebSocket.OPEN) {
        userB.ws.send(JSON.stringify({
          type: 'match_found',
          matchId,
          peerId: userA.userId,
          peerCountry: userA.country,
          peerCountryCode: userA.countryCode,
          isInitiator: false
        }));
      }

      break;
    }
  }
}

// WebSocket Event Handling
wss.on('connection', (ws: WebSocket) => {
  let boundUserId: string | null = null;

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      const { type, userId } = data;

      switch (type) {
        case 'register': {
          boundUserId = userId;
          const { country = 'United States', countryCode = 'US', targetCountry = 'Any' } = data;
          
          activeSockets.set(userId, {
            ws,
            userId,
            country,
            countryCode,
            targetCountry,
            status: 'idle',
            currentMatchId: null,
            currentPeerId: null,
            lastPeerId: null,
            joinedQueueAt: Date.now()
          });

          // Mark user waiting in DB
          const db = readDb();
          const userRec = db.users.find(u => u.unique_user_id === userId);
          if (userRec) {
            userRec.online_status = 'waiting';
            userRec.last_seen = new Date().toISOString();
            writeDb(db);
          }

          ws.send(JSON.stringify({
            type: 'registered',
            userId,
            activeCount: activeSockets.size
          }));
          break;
        }

        case 'update_preferences': {
          if (!boundUserId) return;
          const client = activeSockets.get(boundUserId);
          if (client) {
            if (data.country) client.country = data.country;
            if (data.countryCode) client.countryCode = data.countryCode;
            if (data.targetCountry !== undefined) client.targetCountry = data.targetCountry;
          }
          break;
        }

        case 'start_search': {
          if (!boundUserId) return;
          const client = activeSockets.get(boundUserId);
          if (!client) return;

          // End previous match if any
          if (client.currentMatchId && client.currentPeerId) {
            const peer = activeSockets.get(client.currentPeerId);
            if (peer && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(JSON.stringify({
                type: 'peer_left',
                userId: boundUserId,
                reason: 'next'
              }));
              peer.status = 'idle';
              peer.currentMatchId = null;
              peer.currentPeerId = null;
            }
          }

          if (data.targetCountry !== undefined) {
            client.targetCountry = data.targetCountry;
          }

          client.status = 'waiting';
          client.currentMatchId = null;
          client.currentPeerId = null;
          client.joinedQueueAt = Date.now();

          ws.send(JSON.stringify({
            type: 'searching',
            targetCountry: client.targetCountry
          }));

          // Trigger match check
          tryMatchUsers();
          break;
        }

        case 'next_partner': {
          if (!boundUserId) return;
          const client = activeSockets.get(boundUserId);
          if (!client) return;

          // Notify existing peer
          if (client.currentPeerId) {
            const peer = activeSockets.get(client.currentPeerId);
            if (peer && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(JSON.stringify({
                type: 'peer_left',
                userId: boundUserId,
                reason: 'next'
              }));
              peer.status = 'idle';
              peer.currentMatchId = null;
              peer.currentPeerId = null;
            }
          }

          // End match in database
          if (client.currentMatchId) {
            const db = readDb();
            const m = db.matches.find(item => item.match_id === client.currentMatchId);
            if (m && (m.status === 'connecting' || m.status === 'active')) {
              m.status = 'ended';
              m.ended_at = new Date().toISOString();
              m.ended_by = boundUserId;
              writeDb(db);
            }
          }

          if (data.targetCountry !== undefined) {
            client.targetCountry = data.targetCountry;
          }

          client.status = 'waiting';
          client.currentMatchId = null;
          client.currentPeerId = null;
          client.joinedQueueAt = Date.now();

          ws.send(JSON.stringify({
            type: 'searching',
            targetCountry: client.targetCountry
          }));

          tryMatchUsers();
          break;
        }

        case 'stop_search': {
          if (!boundUserId) return;
          const client = activeSockets.get(boundUserId);
          if (client) {
            client.status = 'idle';
            if (client.currentPeerId) {
              const peer = activeSockets.get(client.currentPeerId);
              if (peer && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(JSON.stringify({
                  type: 'peer_left',
                  userId: boundUserId,
                  reason: 'stopped'
                }));
                peer.status = 'idle';
                peer.currentMatchId = null;
                peer.currentPeerId = null;
              }
            }
            client.currentMatchId = null;
            client.currentPeerId = null;
            ws.send(JSON.stringify({ type: 'stopped' }));
          }
          break;
        }

        // WebRTC Signaling Relay: offer, answer, ice candidate
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'chat_message': {
          const { targetUserId } = data;
          if (targetUserId) {
            const target = activeSockets.get(targetUserId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify({
                ...data,
                fromUserId: boundUserId
              }));
            }
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (boundUserId) {
      const client = activeSockets.get(boundUserId);
      if (client) {
        // Notify peer if in match
        if (client.currentPeerId) {
          const peer = activeSockets.get(client.currentPeerId);
          if (peer && peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(JSON.stringify({
              type: 'peer_left',
              userId: boundUserId,
              reason: 'disconnected'
            }));
            peer.status = 'idle';
            peer.currentMatchId = null;
            peer.currentPeerId = null;
          }
        }

        // End match in database
        if (client.currentMatchId) {
          const db = readDb();
          const m = db.matches.find(item => item.match_id === client.currentMatchId);
          if (m && (m.status === 'connecting' || m.status === 'active')) {
            m.status = 'ended';
            m.ended_at = new Date().toISOString();
            m.ended_by = 'disconnect';
            writeDb(db);
          }
        }
      }

      activeSockets.delete(boundUserId);

      // Mark offline in DB
      const db = readDb();
      const userRec = db.users.find(u => u.unique_user_id === boundUserId);
      if (userRec) {
        userRec.online_status = 'offline';
        userRec.last_seen = new Date().toISOString();
        writeDb(db);
      }
    }
  });
});

// Periodic matchmaker loop every 2 seconds
setInterval(() => {
  tryMatchUsers();
}, 2000);

// --- Vite Middleware or Static Production Serving ---
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[OmeLive Server] Running on http://localhost:${PORT}`);
    console.log(`[OmeLive Signaling] WebSockets attached to same port.`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
