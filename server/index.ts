import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

interface RelayFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  path: string;
  uploadedAt: number;
  downloaded: boolean;
}

interface PeerInfo {
  ws?: WebSocket;
  device?: {
    name: string;
    platform: string;
    browser: string;
    isMobile: boolean;
  };
}

interface TransferSession {
  id: string;
  token: string;
  shortCode: string;
  createdAt: number;
  expiresAt: number;
  receiver: PeerInfo;
  sender: PeerInfo;
  relayFiles: Map<string, RelayFile>;
}

const PORT = Number(process.env.PORT) || 3001;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RELAY_DIR = path.join(os.tmpdir(), 'flux-relay');

if (!fs.existsSync(RELAY_DIR)) {
  fs.mkdirSync(RELAY_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, TransferSession>();
const shortCodeToSession = new Map<string, string>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      // Clean up relay files
      for (const file of session.relayFiles.values()) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error('Error deleting temp relay file:', e);
          }
        }
      }
      shortCodeToSession.delete(session.shortCode);
      sessions.delete(id);
    }
  }
}, 60 * 1000);

// Multer storage for relay fallback
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, RELAY_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB per file relay cap
});

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal && alias.address.startsWith('10.') || alias.address.startsWith('192.168.') || alias.address.startsWith('172.')) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

// REST Endpoints
app.get('/api/info', (_req, res) => {
  res.json({
    name: 'NoBarier Relay & Signaling Engine',
    version: '1.0.0',
    localIp: getLocalIp(),
    clientPort: 3000,
    serverPort: PORT,
  });
});

app.post('/api/session/create', (_req, res) => {
  const sessionId = crypto.randomUUID();
  const token = crypto.randomBytes(8).toString('hex');
  
  // Generate unique 6-digit code
  let shortCode = '';
  do {
    shortCode = Math.floor(100000 + Math.random() * 900000).toString();
  } while (shortCodeToSession.has(shortCode));

  const now = Date.now();
  const session: TransferSession = {
    id: sessionId,
    token,
    shortCode,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    receiver: {},
    sender: {},
    relayFiles: new Map(),
  };

  sessions.set(sessionId, session);
  shortCodeToSession.set(shortCode, sessionId);

  res.json({
    sessionId,
    token,
    shortCode,
    expiresAt: session.expiresAt,
    expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
  });
});

app.post('/api/session/lookup', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Pairing code is required' });
    return;
  }
  const cleanCode = code.trim();
  const sessionId = shortCodeToSession.get(cleanCode);
  if (!sessionId) {
    res.status(404).json({ error: 'Pairing code not found or expired' });
    return;
  }
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    shortCodeToSession.delete(cleanCode);
    res.status(404).json({ error: 'Session has expired' });
    return;
  }
  res.json({
    sessionId: session.id,
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

app.post('/api/relay/upload/:sessionId', upload.single('file'), (req, res) => {
  const sessionId = req.params.sessionId as string;
  const token = req.headers['x-flux-token'] as string;
  const session = sessions.get(sessionId);

  if (!session || (token && session.token !== token) || session.expiresAt <= Date.now()) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(403).json({ error: 'Invalid or expired session' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const fileId = crypto.randomUUID();
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const relayFile: RelayFile = {
    id: fileId,
    name: originalName,
    size: req.file.size,
    mimeType: req.file.mimetype || 'application/octet-stream',
    path: req.file.path,
    uploadedAt: Date.now(),
    downloaded: false,
  };

  session.relayFiles.set(fileId, relayFile);

  // Notify receiver via WebSocket if connected
  if (session.receiver.ws && session.receiver.ws.readyState === WebSocket.OPEN) {
    session.receiver.ws.send(JSON.stringify({
      type: 'RELAY_FILE_READY',
      file: {
        id: fileId,
        name: relayFile.name,
        size: relayFile.size,
        mimeType: relayFile.mimeType,
        downloadUrl: `/api/relay/download/${sessionId}/${fileId}`,
      }
    }));
  }

  res.json({
    success: true,
    fileId,
    name: relayFile.name,
    size: relayFile.size,
    downloadUrl: `/api/relay/download/${sessionId}/${fileId}`,
  });
});

app.get('/api/relay/download/:sessionId/:fileId', (req, res) => {
  const sessionId = req.params.sessionId as string;
  const fileId = req.params.fileId as string;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const file = session.relayFiles.get(fileId);
  if (!file || !fs.existsSync(file.path)) {
    res.status(404).json({ error: 'File not found or already purged' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.size);

  const stream = fs.createReadStream(file.path);
  stream.pipe(res);

  stream.on('end', () => {
    file.downloaded = true;
    // Mark for delayed cleanup (give 30 seconds buffer for multi-stream/retries)
    setTimeout(() => {
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          session.relayFiles.delete(fileId);
        } catch {
          // Ignore unlink errors
        }
      }
    }, 30000);
  });
});

// WebSocket Signaling Handler
wss.on('connection', (ws) => {
  let boundSessionId: string | null = null;
  let boundRole: 'sender' | 'receiver' | null = null;

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      switch (msg.type) {
        case 'REGISTER_RECEIVER': {
          const { sessionId, token, device } = msg;
          const session = sessions.get(sessionId);

          if (!session || session.token !== token || session.expiresAt <= Date.now()) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Session invalid or expired' }));
            return;
          }

          boundSessionId = sessionId;
          boundRole = 'receiver';
          session.receiver = { ws, device };

          ws.send(JSON.stringify({
            type: 'REGISTERED_RECEIVER',
            sessionId,
            shortCode: session.shortCode,
            expiresAt: session.expiresAt,
          }));

          // If sender is already waiting, notify both
          if (session.sender.ws && session.sender.ws.readyState === WebSocket.OPEN) {
            session.sender.ws.send(JSON.stringify({
              type: 'PEER_JOINED',
              role: 'receiver',
              device: session.receiver.device,
            }));
            ws.send(JSON.stringify({
              type: 'PEER_JOINED',
              role: 'sender',
              device: session.sender.device,
            }));
          }
          break;
        }

        case 'CONNECT_SENDER': {
          const { sessionId, token, shortCode, device } = msg;
          let session: TransferSession | undefined;

          if (sessionId) {
            session = sessions.get(sessionId);
            if (session && session.token !== token) {
              session = undefined;
            }
          } else if (shortCode) {
            const sid = shortCodeToSession.get(shortCode.trim());
            if (sid) session = sessions.get(sid);
          }

          if (!session || session.expiresAt <= Date.now()) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid pairing details or session expired' }));
            return;
          }

          boundSessionId = session.id;
          boundRole = 'sender';
          session.sender = { ws, device };

          ws.send(JSON.stringify({
            type: 'CONNECTED_SENDER',
            sessionId: session.id,
            receiverDevice: session.receiver.device,
          }));

          // Also notify sender that peer (receiver) is joined
          ws.send(JSON.stringify({
            type: 'PEER_JOINED',
            role: 'receiver',
            device: session.receiver.device,
          }));

          // Notify receiver that sender joined
          if (session.receiver.ws && session.receiver.ws.readyState === WebSocket.OPEN) {
            session.receiver.ws.send(JSON.stringify({
              type: 'PEER_JOINED',
              role: 'sender',
              device: session.sender.device,
            }));
          }
          break;
        }

        case 'SIGNAL': {
          if (!boundSessionId) return;
          const session = sessions.get(boundSessionId);
          if (!session) return;

          const target = boundRole === 'sender' ? session.receiver.ws : session.sender.ws;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({
              type: 'SIGNAL',
              from: boundRole,
              signal: msg.signal,
            }));
          }
          break;
        }

        case 'OFFER_FILES': {
          if (!boundSessionId || boundRole !== 'sender') return;
          const session = sessions.get(boundSessionId);
          if (session && session.receiver.ws && session.receiver.ws.readyState === WebSocket.OPEN) {
            session.receiver.ws.send(JSON.stringify({
              type: 'OFFER_FILES',
              files: msg.files,
              senderDevice: session.sender.device,
            }));
          }
          break;
        }

        case 'APPROVE_FILES': {
          if (!boundSessionId || boundRole !== 'receiver') return;
          const session = sessions.get(boundSessionId);
          if (session && session.sender.ws && session.sender.ws.readyState === WebSocket.OPEN) {
            session.sender.ws.send(JSON.stringify({
              type: 'APPROVE_FILES',
              approved: Boolean(msg.approved),
            }));
          }
          break;
        }

        case 'RELAY_MODE_TRIGGER': {
          if (!boundSessionId) return;
          const session = sessions.get(boundSessionId);
          if (!session) return;

          const target = boundRole === 'sender' ? session.receiver.ws : session.sender.ws;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({
              type: 'RELAY_MODE_TRIGGER',
              reason: msg.reason || 'Direct P2P unreachable, switching to secure relay fallback.',
            }));
          }
          break;
        }

        case 'TRANSFER_PROGRESS': {
          if (!boundSessionId) return;
          const session = sessions.get(boundSessionId);
          if (!session) return;

          const target = boundRole === 'sender' ? session.receiver.ws : session.sender.ws;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({
              type: 'TRANSFER_PROGRESS',
              ...msg,
            }));
          }
          break;
        }

        case 'TRANSFER_COMPLETE': {
          if (!boundSessionId) return;
          const session = sessions.get(boundSessionId);
          if (!session) return;

          const target = boundRole === 'sender' ? session.receiver.ws : session.sender.ws;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({
              type: 'TRANSFER_COMPLETE',
              ...msg,
            }));
          }
          break;
        }

        case 'CANCEL_TRANSFER': {
          if (!boundSessionId) return;
          const session = sessions.get(boundSessionId);
          if (!session) return;

          const target = boundRole === 'sender' ? session.receiver.ws : session.sender.ws;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({
              type: 'TRANSFER_CANCELLED',
              reason: msg.reason || 'Transfer cancelled by peer',
            }));
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (boundSessionId) {
      const session = sessions.get(boundSessionId);
      if (session) {
        if (boundRole === 'sender') {
          session.sender.ws = undefined;
          if (session.receiver.ws && session.receiver.ws.readyState === WebSocket.OPEN) {
            session.receiver.ws.send(JSON.stringify({ type: 'PEER_DISCONNECTED', role: 'sender' }));
          }
        } else if (boundRole === 'receiver') {
          session.receiver.ws = undefined;
          if (session.sender.ws && session.sender.ws.readyState === WebSocket.OPEN) {
            session.sender.ws.send(JSON.stringify({ type: 'PEER_DISCONNECTED', role: 'receiver' }));
          }
        }
      }
    }
  });
});

// Serve frontend build if dist exists (production mode)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`[FLUX Server] Running on http://localhost:${PORT} and http://${localIp}:${PORT}`);
  console.log(`[FLUX Server] WebSocket signaling active on ws://localhost:${PORT}/ws`);
});
