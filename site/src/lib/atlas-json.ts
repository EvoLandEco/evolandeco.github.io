import { JSONParser } from "@streamparser/json";

export async function verifiedBytes(response: Response, expected: { sha256: string; bytes: number }, onProgress?: (loaded: number) => void) {
  if (!response.ok) throw new Error(`ATLAS download failed (${response.status})`);
  let bytes: ArrayBuffer;
  if (response.body) {
    const buffer = new Uint8Array(expected.bytes);
    const reader = response.body.getReader();
    let loaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (loaded + value.byteLength > expected.bytes) {
          await reader.cancel();
          throw new Error("ATLAS download checksum mismatch");
        }
        buffer.set(value, loaded);
        loaded += value.byteLength;
        onProgress?.(loaded);
      }
    } finally { reader.releaseLock(); }
    if (loaded !== expected.bytes) throw new Error("ATLAS download checksum mismatch");
    bytes = buffer.buffer;
  } else bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== expected.bytes || hash !== expected.sha256) throw new Error("ATLAS download checksum mismatch");
  return bytes;
}

export async function parseAtlasJson(bytes: ArrayBuffer, signal?: AbortSignal) {
  // Bound decoded text allocations and let the browser handle input between chunks.
  const parser = new JSONParser({ paths: ["$"], stringBufferSize: 64 * 1024 });
  let result: unknown;
  parser.onValue = ({ value }) => { result = value; };
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    await new Promise(resolve => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    parser.write(new Uint8Array(bytes, offset, Math.min(chunkSize, bytes.byteLength - offset)));
  }
  signal?.throwIfAborted();
  if (!parser.isEnded) parser.end();
  if (result === undefined) throw new SyntaxError("ATLAS JSON contains no value");
  return result;
}
