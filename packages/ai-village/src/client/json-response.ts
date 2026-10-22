export class HostRequestError extends Error { constructor(message: string, readonly status = 0) { super(message) } }
/** Count wire bytes while reading, not UTF-16 characters after buffering an unbounded body. */
export async function readJsonResponse<T>(response: Response, limit = 64 * 1024): Promise<T> {
  if (!response.body) throw Error('RESPONSE_BODY_MISSING')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const row = await reader.read(); if (row.done) break
      size += row.value.byteLength
      if (size > limit) throw Error('RESPONSE_TOO_LARGE')
      chunks.push(row.value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(size); let at = 0
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!response.ok) throw new HostRequestError(typeof value?.error === 'string' && /^[A-Z_]+$/.test(value.error) ? value.error : 'REQUEST_FAILED', response.status)
  return value as T
}
