// Wave Crypto — AES-256-GCM + PBKDF2 (200,000 iterations)
// .ganuman format: magic(8) + salt(16) + iv(12) + ciphertext

const GM_PASS  = 'Ganu&Anu#1999! Love';
const GM_MAGIC = new Uint8Array([0x47,0x41,0x4E,0x55,0x4D,0x41,0x4E,0x21]); // "GANUMAN!"

async function deriveKey(salt, usage = ['encrypt']) {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(GM_PASS), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    raw, { name: 'AES-GCM', length: 256 }, false, usage
  );
}

export async function encryptFile(arrayBuffer) {
  const data  = new Uint8Array(arrayBuffer);
  const salt  = crypto.getRandomValues(new Uint8Array(16));
  const iv    = crypto.getRandomValues(new Uint8Array(12));
  const key   = await deriveKey(salt, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(GM_MAGIC.length + 16 + 12 + cipher.length);
  let off = 0;
  out.set(GM_MAGIC, off); off += GM_MAGIC.length;
  out.set(salt, off);     off += 16;
  out.set(iv, off);       off += 12;
  out.set(cipher, off);
  return out.buffer;
}

export async function decryptFile(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  // Verify magic
  for (let i = 0; i < GM_MAGIC.length; i++) {
    if (data[i] !== GM_MAGIC[i]) throw new Error('Invalid .ganuman file');
  }
  let off = GM_MAGIC.length;
  const salt   = data.slice(off, off + 16); off += 16;
  const iv     = data.slice(off, off + 12); off += 12;
  const cipher = data.slice(off);
  const key    = await deriveKey(salt, ['decrypt']);
  const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return plain;
}

export async function decryptToBlob(arrayBuffer, mimeType = 'audio/mpeg') {
  const plain = await decryptFile(arrayBuffer);
  return new Blob([plain], { type: mimeType });
}
