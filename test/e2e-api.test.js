import assert from 'assert';
import crypto from 'crypto';
import WebSocket from 'ws';

async function runTests() {
  console.log('--- FLUX End-to-End API & Signaling Verification ---');

  // Test 1: GET /api/info
  console.log('[1/5] Testing GET /api/info...');
  const infoRes = await fetch('http://localhost:3001/api/info');
  assert.strictEqual(infoRes.status, 200);
  const info = await infoRes.json();
  console.log('  Server Info:', info);
  assert.ok(info.localIp, 'Local IP should be present');

  // Test 2: POST /api/session/create
  console.log('[2/5] Testing POST /api/session/create...');
  const createRes = await fetch('http://localhost:3001/api/session/create', { method: 'POST' });
  assert.strictEqual(createRes.status, 200);
  const session = await createRes.json();
  console.log('  Created Session:', session);
  assert.ok(session.sessionId, 'Session ID required');
  assert.ok(session.token, 'Token required');
  assert.strictEqual(session.shortCode.length, 6, 'Short code must be 6 digits');

  // Test 3: POST /api/session/lookup
  console.log('[3/5] Testing POST /api/session/lookup...');
  const lookupRes = await fetch('http://localhost:3001/api/session/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: session.shortCode }),
  });
  assert.strictEqual(lookupRes.status, 200);
  const lookup = await lookupRes.json();
  assert.strictEqual(lookup.sessionId, session.sessionId);
  assert.strictEqual(lookup.token, session.token);
  console.log('  Lookup Success by 6-digit code:', lookup);

  // Test 4: WebSocket Signaling Handshake
  console.log('[4/5] Testing WebSocket Signaling Handshake between Receiver & Sender...');
  const receiverWs = new WebSocket('ws://localhost:3001/ws');
  const senderWs = new WebSocket('ws://localhost:3001/ws');

  await Promise.all([
    new Promise((resolve) => receiverWs.on('open', resolve)),
    new Promise((resolve) => senderWs.on('open', resolve)),
  ]);

  let receiverGotOffer = false;

  const handshakePromise = new Promise((resolve, reject) => {
    receiverWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'REGISTERED_RECEIVER') {
        // Now connect sender
        senderWs.send(JSON.stringify({
          type: 'CONNECT_SENDER',
          sessionId: session.sessionId,
          token: session.token,
          device: { name: 'Sender Pixel 8', platform: 'Android', browser: 'Chrome', isMobile: true }
        }));
      } else if (msg.type === 'PEER_JOINED') {
        console.log('  Receiver notified: Sender joined!');
      } else if (msg.type === 'OFFER_FILES') {
        console.log('  Receiver got file offer:', msg.files);
        receiverGotOffer = true;
        // Approve
        receiverWs.send(JSON.stringify({
          type: 'APPROVE_FILES',
          approved: true
        }));
      }
    });

    senderWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CONNECTED_SENDER') {
        console.log('  Sender successfully connected to session!');
        // Sender offers files
        senderWs.send(JSON.stringify({
          type: 'OFFER_FILES',
          files: [{ id: 'f1', name: 'photo.jpg', size: 1024, type: 'image/jpeg', sha256: 'abc' }]
        }));
      } else if (msg.type === 'APPROVE_FILES') {
        console.log('  Sender got receiver approval status:', msg.approved);
        assert.strictEqual(msg.approved, true);
        resolve(true);
      }
    });

    setTimeout(() => reject(new Error('Signaling handshake timed out')), 5000);
  });

  // Register receiver
  receiverWs.send(JSON.stringify({
    type: 'REGISTER_RECEIVER',
    sessionId: session.sessionId,
    token: session.token,
    device: { name: 'Receiver iPhone 15', platform: 'iOS', browser: 'Safari', isMobile: true }
  }));

  await handshakePromise;
  assert.ok(receiverGotOffer, 'Receiver should have received file offer');
  receiverWs.close();
  senderWs.close();
  console.log('  Signaling verification passed!');

  // Test 5: Fallback Relay Upload & Download
  console.log('[5/5] Testing Fallback Relay Upload and Download with SHA-256 validation...');
  const testPayload = Buffer.from('FLUX-VERIFIED-DATA-' + Date.now());
  const expectedHash = crypto.createHash('sha256').update(testPayload).digest('hex');

  const formData = new FormData();
  formData.append('file', new Blob([testPayload]), 'test-document.txt');

  const uploadRes = await fetch(`http://localhost:3001/api/relay/upload/${session.sessionId}`, {
    method: 'POST',
    headers: { 'x-flux-token': session.token },
    body: formData,
  });

  assert.strictEqual(uploadRes.status, 200);
  const uploadData = await uploadRes.json();
  console.log('  Relay upload result:', uploadData);
  assert.ok(uploadData.fileId, 'fileId returned');

  // Download the relay file
  const downloadRes = await fetch(`http://localhost:3001${uploadData.downloadUrl}`);
  assert.strictEqual(downloadRes.status, 200);
  const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const downloadedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

  assert.strictEqual(downloadedHash, expectedHash, 'Downloaded file SHA-256 must match original payload!');
  console.log(`  Relay download verified! SHA-256 matches: ${downloadedHash}`);

  console.log('\n>>> ALL 5 END-TO-END TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
