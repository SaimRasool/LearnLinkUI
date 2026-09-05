export interface JitsiJwtClaims {
  appId: string;
  apiKeyId: string;
  privateKeyPem: string;
  roomName: string;
  userId: string;
  displayName: string;
  ttlSeconds?: number;
}

export async function createJitsiJwt(claims: JitsiJwtClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = claims.ttlSeconds ?? 2 * 60 * 60;
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: claims.apiKeyId,
  };
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    iat: now,
    nbf: now - 10,
    exp: now + ttl,
    sub: claims.appId,
    room: '*',
    context: {
      user: {
        id: claims.userId,
        name: claims.displayName,
        moderator: 'true',
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
      },
    },
  };

  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(claims.privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.trim();
  if (normalized.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error(
      'Jitsi private key must be PKCS#8 (BEGIN PRIVATE KEY). Convert it or paste a JWT from the JaaS console.'
    );
  }
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function toBase64Url(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
