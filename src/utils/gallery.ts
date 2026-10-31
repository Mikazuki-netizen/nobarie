/**
 * Gallery & Storage Bridge for NoBarier
 * Supports:
 * - Apple iOS Photos & Documents via native WKScriptMessageHandler ('nativeGallery')
 * - Android Gallery & MediaStore via @JavascriptInterface ('AndroidGallery')
 * - Web / Desktop Browser download fallback
 */

declare global {
  interface Window {
    AndroidGallery?: {
      isAvailable?: () => string;
      startFile: (transferId: string, fileName: string, mimeType: string) => string;
      appendChunk: (transferId: string, base64Chunk: string) => string;
      finishFile: (transferId: string) => string;
      deleteMedia: (uriOrPath: string, fileName: string) => string;
    };
    webkit?: {
      messageHandlers?: {
        nativeGallery?: {
          postMessage: (data: any) => void;
        };
      };
    };
    onNativeGalleryFinish?: (callbackId: string, success: boolean, localId: string, error: string) => void;
    onNativeGalleryDelete?: (callbackId: string, success: boolean, error: string) => void;
  }
}

const CHUNK_SIZE = 256 * 1024; // 256 KB chunks

/**
 * Convert ArrayBuffer to Base64 efficiently
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK = 8192;
  for (let i = 0; i < len; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + CHUNK, len))));
  }
  return btoa(binary);
}

/**
 * Checks if native device gallery bridge is active
 */
export function isNativeBridgeActive(): 'android' | 'ios' | 'web' {
  if (typeof window !== 'undefined') {
    if (window.AndroidGallery && typeof window.AndroidGallery.startFile === 'function') {
      return 'android';
    }
    if (window.webkit?.messageHandlers?.nativeGallery) {
      return 'ios';
    }
  }
  return 'web';
}

/**
 * Automatically saves received file directly to device Native Gallery (Apple Photos / Android MediaStore)
 */
export async function saveFileToNativeGallery(file: {
  name: string;
  blob?: Blob;
  downloadUrl?: string;
  type: string;
  onProgress?: (percent: number) => void;
}): Promise<{ success: boolean; localId?: string; error?: string }> {
  try {
    let blob = file.blob;
    if (!blob && file.downloadUrl) {
      const res = await fetch(file.downloadUrl);
      blob = await res.blob();
    }

    if (!blob) {
      return { success: false, error: 'No blob data available to save' };
    }

    const platform = isNativeBridgeActive();
    const transferId = crypto.randomUUID();
    const totalBytes = blob.size;

    // --- 1. ANDROID NATIVE MEDIASTORE BRIDGE ---
    if (platform === 'android' && window.AndroidGallery) {
      const startResStr = window.AndroidGallery.startFile(transferId, file.name, file.type);
      try {
        const startRes = JSON.parse(startResStr);
        if (!startRes.success) {
          throw new Error(startRes.error || 'Android startFile failed');
        }
      } catch (e: any) {
        throw new Error('Android bridge init failed: ' + e.message);
      }

      let offset = 0;
      while (offset < totalBytes) {
        const chunkBlob = blob.slice(offset, offset + CHUNK_SIZE);
        const arrayBuf = await chunkBlob.arrayBuffer();
        const b64 = bufferToBase64(arrayBuf);
        const appendResStr = window.AndroidGallery.appendChunk(transferId, b64);
        try {
          const appendRes = JSON.parse(appendResStr);
          if (!appendRes.success) {
            throw new Error(appendRes.error || 'Android appendChunk failed');
          }
        } catch (e: any) {
          throw new Error('Android chunk upload failed: ' + e.message);
        }

        offset += chunkBlob.size;
        if (file.onProgress) {
          file.onProgress(Math.min(100, Math.round((offset / totalBytes) * 100)));
        }
      }

      const finishResStr = window.AndroidGallery.finishFile(transferId);
      const finishRes = JSON.parse(finishResStr);
      if (!finishRes.success) {
        throw new Error(finishRes.error || 'Android finishFile failed');
      }

      return {
        success: true,
        localId: finishRes.uri || finishRes.path || transferId,
      };
    }

    // --- 2. APPLE IOS PHAsset / PHOTOS BRIDGE ---
    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      const callbackId = crypto.randomUUID();

      const finishPromise = new Promise<{ success: boolean; localId?: string; error?: string }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: 'iOS native gallery save timeout' });
          }, 60000);

          window.onNativeGalleryFinish = (cbId, success, localId, error) => {
            if (cbId === callbackId) {
              clearTimeout(timeout);
              resolve({ success, localId, error });
            }
          };
        }
      );

      // Start streaming to iOS temp cache
      window.webkit.messageHandlers.nativeGallery.postMessage({
        action: 'startFile',
        transferId,
        fileName: file.name,
        mimeType: file.type,
      });

      let offset = 0;
      while (offset < totalBytes) {
        const chunkBlob = blob.slice(offset, offset + CHUNK_SIZE);
        const arrayBuf = await chunkBlob.arrayBuffer();
        const b64 = bufferToBase64(arrayBuf);

        window.webkit.messageHandlers.nativeGallery.postMessage({
          action: 'appendChunk',
          transferId,
          base64Chunk: b64,
        });

        offset += chunkBlob.size;
        if (file.onProgress) {
          file.onProgress(Math.min(100, Math.round((offset / totalBytes) * 100)));
        }
      }

      // Finish streaming and write to PHPhotoLibrary / Documents
      window.webkit.messageHandlers.nativeGallery.postMessage({
        action: 'finishFile',
        transferId,
        callbackId,
      });

      return await finishPromise;
    }

    // --- 3. STANDARD BROWSER FALLBACK ---
    const url = file.downloadUrl || URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (!file.downloadUrl) {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    return { success: true, localId: 'browser-download' };
  } catch (err: any) {
    console.error('[GalleryBridge] save error:', err);
    return { success: false, error: err.message || 'Failed to save to gallery' };
  }
}

/**
 * Permanently deletes a saved media file from device storage/gallery
 */
export async function deleteFileFromDevice(
  localId?: string,
  fileName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = isNativeBridgeActive();

    // Android
    if (platform === 'android' && window.AndroidGallery) {
      const resStr = window.AndroidGallery.deleteMedia(localId || '', fileName || '');
      const res = JSON.parse(resStr);
      return { success: !!res.success, error: res.error };
    }

    // iOS
    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      const callbackId = crypto.randomUUID();
      const deletePromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'iOS delete timeout' });
        }, 15000);

        window.onNativeGalleryDelete = (cbId, success, error) => {
          if (cbId === callbackId) {
            clearTimeout(timeout);
            resolve({ success, error });
          }
        };
      });

      window.webkit.messageHandlers.nativeGallery.postMessage({
        action: 'deleteMedia',
        localId: localId || '',
        fileName: fileName || '',
        callbackId,
      });

      return await deletePromise;
    }

    // Web fallback
    return { success: true };
  } catch (err: any) {
    console.error('[GalleryBridge] delete error:', err);
    return { success: false, error: err.message || 'Failed to delete file' };
  }
}
