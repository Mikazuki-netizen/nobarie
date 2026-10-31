export async function computeSHA256(data: ArrayBuffer | Blob): Promise<string> {
  try {
    if (data instanceof Blob) {
      // For large files (> 2MB), sample the header and trailer with byte length to avoid freezing main thread
      if (data.size > 2 * 1024 * 1024) {
        const header = await data.slice(0, 32 * 1024).arrayBuffer();
        const trailer = await data.slice(Math.max(0, data.size - 32 * 1024)).arrayBuffer();
        const combined = new Uint8Array(header.byteLength + trailer.byteLength);
        combined.set(new Uint8Array(header), 0);
        combined.set(new Uint8Array(trailer), header.byteLength);
        const digest = await crypto.subtle.digest('SHA-256', combined);
        const hashArray = Array.from(new Uint8Array(digest));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('') + `-${data.size}`;
      }
      const buffer = await data.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    const size = (data as any)?.size || (data as any)?.byteLength || 0;
    return `${size}-${Date.now()}`;
  }
}
