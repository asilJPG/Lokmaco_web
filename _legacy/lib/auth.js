const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not defined!");
}

const encoder = new TextEncoder();

function base64urlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return decodeURIComponent(escape(atob(base64)));
}

async function signHmac(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function verifyHmac(message, signature, secret) {
  const expected = await signHmac(message, secret);
  return expected === signature;
}

export async function signSession(payload, expiresInSeconds = 7 * 24 * 3600) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const data = JSON.stringify({ ...payload, exp: expiresAt });
  
  const payloadBase64 = base64urlEncode(data);
  const signature = await signHmac(payloadBase64, JWT_SECRET);
  return `${payloadBase64}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  
  const [payloadBase64, signature] = parts;
  try {
    const isValid = await verifyHmac(payloadBase64, signature, JWT_SECRET);
    if (!isValid) return null;
    
    const dataStr = base64urlDecode(payloadBase64);
    const payload = JSON.parse(dataStr);
    
    if (payload.exp && payload.exp < Date.now()) {
      return null; // expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}
