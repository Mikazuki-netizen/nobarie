/**
 * Gallery & Storage Bridge for NoBarier
 * Supports:
 * - Apple iOS Photos & Custom Documents/NoBarier folder via native WKScriptMessageHandler ('nativeGallery')
 * - Android Gallery & MediaStore via @JavascriptInterface ('AndroidGallery')
 * - QuickLook preview / Document Interaction controller on iOS
 * - Native File Intent viewer on Android
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
      openFile: (uriOrPath: string, fileName: string, mimeType: string) => string;
      openFolder: () => string;
      listFolderFiles: () => string;
    };
    webkit?: {
      messageHandlers?: {
        nativeGallery?: {
          postMessage: (data: any) => void;
        };
      };
    };
    onNativeGalleryFinish?: (callbackId: string, success: boolean, localId: string, error: string, path?: string) => void;
    onNativeGalleryDelete?: (callbackId: string, success: boolean, error: string) => void;
    onNativeFileListResult?: (callbackId: string, jsonList: string) => void;
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
 * Automatically saves received file directly to device Native Gallery and custom NoBarier folder
 */
export async function saveFileToNativeGallery(file: {
  name: string;
  blob?: Blob;
  downloadUrl?: string;
  type: string;
  onProgress?: (percent: number) => void;
}): Promise<{ success: boolean; localId?: string; path?: string; error?: string }> {
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
        path: finishRes.path,
      };
    }

    // --- 2. APPLE IOS PHAsset / PHOTOS / DOCUMENTS BRIDGE ---
    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      const callbackId = crypto.randomUUID();

      const finishPromise = new Promise<{ success: boolean; localId?: string; path?: string; error?: string }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: 'iOS native gallery save timeout' });
          }, 60000);

          window.onNativeGalleryFinish = (cbId, success, localId, error, path) => {
            if (cbId === callbackId) {
              clearTimeout(timeout);
              resolve({ success, localId, path, error });
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

      // Finish streaming and write to Documents/NoBarier & Photos album
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
 * Opens and previews/plays a file on the device
 */
export async function openFileOnDevice(file: {
  name: string;
  localId?: string;
  path?: string;
  type?: string;
  downloadUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = isNativeBridgeActive();

    // Android
    if (platform === 'android' && window.AndroidGallery?.openFile) {
      const resStr = window.AndroidGallery.openFile(file.localId || file.path || '', file.name, file.type || '');
      const res = JSON.parse(resStr);
      return { success: !!res.success, error: res.error };
    }

    // iOS QuickLook Preview & Share Sheet
    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      window.webkit.messageHandlers.nativeGallery.postMessage({
        action: 'openFile',
        fileName: file.name,
        filePath: file.path || file.localId || '',
      });
      return { success: true };
    }

    // Web Fallback
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
      return { success: true };
    }

    return { success: false, error: 'Preview not supported in this browser' };
  } catch (err: any) {
    console.error('[GalleryBridge] openFile error:', err);
    return { success: false, error: err.message || 'Failed to open file' };
  }
}

/**
 * Opens the NoBarier folder in the device file manager
 */
export async function openNoBarierFolder(): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = isNativeBridgeActive();

    if (platform === 'android' && window.AndroidGallery?.openFolder) {
      window.AndroidGallery.openFolder();
      return { success: true };
    }

    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      window.webkit.messageHandlers.nativeGallery.postMessage({
        action: 'openFolder',
      });
      return { success: true };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Lists all files stored in the NoBarier directory on the device
 */
export async function listDeviceFiles(): Promise<Array<{ name: string; size: number; timestamp?: number; path?: string }>> {
  try {
    const platform = isNativeBridgeActive();

    if (platform === 'android' && window.AndroidGallery?.listFolderFiles) {
      const listStr = window.AndroidGallery.listFolderFiles();
      return JSON.parse(listStr);
    }

    if (platform === 'ios' && window.webkit?.messageHandlers?.nativeGallery) {
      const callbackId = crypto.randomUUID();
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve([]), 5000);
        window.onNativeFileListResult = (cbId, jsonList) => {
          if (cbId === callbackId) {
            clearTimeout(timeout);
            try {
              resolve(JSON.parse(jsonList));
            } catch {
              resolve([]);
            }
          }
        };
        window.webkit.messageHandlers.nativeGallery.postMessage({
          action: 'listFolderFiles',
          callbackId,
        });
      });
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Downloads a file locally to user storage
 */
export function downloadFileLocally(file: { name: string; blob?: Blob; downloadUrl?: string; type?: string }) {
  if (file.downloadUrl) {
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (file.blob) {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
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
