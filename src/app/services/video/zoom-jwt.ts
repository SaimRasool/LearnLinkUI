export interface ZoomVideoJwtClaims {
  sdkKey: string;
  sdkSecret: string;
  sessionName: string;
  role: 0 | 1;
  userIdentity?: string;
  ttlSeconds?: number;
}

export async function createZoomVideoJwt(claims: ZoomVideoJwtClaims): Promise<string> {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const ttl = Math.min(Math.max(claims.ttlSeconds ?? 7200, 1800), 172800);
  const exp = iat + ttl;
  const sessionName = String(claims.sessionName || '').trim();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    app_key: claims.sdkKey,
    role_type: claims.role,
    tpc: sessionName,
    version: 1,
    iat,
    exp,
    user_identity: claims.userIdentity || sessionName,
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(claims.sdkSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
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
