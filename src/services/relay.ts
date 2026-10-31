import { FileItem, TransferStats } from '../types/flux';
import { computeSHA256 } from '../utils/crypto';
import { getApiEndpoint } from '../utils/api';

export class RelayService {
  private isCancelled = false;

  cancel() {
    this.isCancelled = true;
  }

  async uploadFiles(
    sessionId: string,
    token: string,
    files: FileItem[],
    onProgress: (payload: { fileId: string; stats: TransferStats }) => void
  ): Promise<void> {
    this.isCancelled = false;
    const totalBytesAll = files.reduce((acc, f) => acc + f.size, 0);
    let bytesSentBeforeCurrent = 0;

    for (let i = 0; i < files.length; i++) {
      if (this.isCancelled) break;
      const fileItem = files[i];
      const rawFile = fileItem.file;
      if (!rawFile) continue;

      const fileSha256 = fileItem.sha256 || await computeSHA256(rawFile);
      fileItem.sha256 = fileSha256;

      await this.uploadSingleFile(
        sessionId,
        token,
        rawFile,
        fileItem.id,
        bytesSentBeforeCurrent,
        totalBytesAll,
        i + 1,
        files.length,
        onProgress
      );

      bytesSentBeforeCurrent += rawFile.size;
    }
  }

  private uploadSingleFile(
    sessionId: string,
    token: string,
    file: File,
    fileId: string,
    bytesSentBefore: number,
    totalBytesAll: number,
    fileIndex: number,
    totalFiles: number,
    onProgress: (payload: { fileId: string; stats: TransferStats }) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastSampleTime = startTime;
      let lastLoaded = 0;
      let currentSpeed = 0;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || this.isCancelled) return;

        const now = Date.now();
        const timeDiff = (now - lastSampleTime) / 1000;
        if (timeDiff >= 0.5) {
          const loadedDiff = event.loaded - lastLoaded;
          currentSpeed = loadedDiff / timeDiff;
          lastLoaded = event.loaded;
          lastSampleTime = now;
        }

        const totalTransferred = bytesSentBefore + event.loaded;
        const overallPercent = Math.min(100, Math.round((totalTransferred / totalBytesAll) * 1000) / 10);
        const remainingBytes = Math.max(0, totalBytesAll - totalTransferred);
        const etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

        onProgress({
          fileId,
          stats: {
            speed: currentSpeed,
            transferredBytes: totalTransferred,
            totalBytes: totalBytesAll,
            percent: overallPercent,
            etaSeconds,
            currentFileName: file.name,
            currentFileIndex: fileIndex,
            totalFiles,
            mode: 'relay',
          },
        });
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = JSON.parse(xhr.responseText);
            resolve(resp);
          } catch {
            resolve({});
          }
        } else {
          reject(new Error(`Relay upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during relay upload'));
      };

      xhr.onabort = () => {
        reject(new Error('Relay upload cancelled'));
      };

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', getApiEndpoint(`/api/relay/upload/${sessionId}`));
      xhr.setRequestHeader('x-flux-token', token);
      xhr.send(formData);
    });
  }

  async downloadFile(
    downloadUrl: string,
    fileMeta: { id: string; name: string; size: number; mimeType: string },
    onProgress: (payload: { fileId: string; stats: TransferStats }) => void
  ): Promise<FileItem> {
    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : getApiEndpoint(downloadUrl);
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    const contentLength = Number(response.headers.get('content-length')) || fileMeta.size;

    const chunks: BlobPart[] = [];
    let receivedBytes = 0;
    let lastSampleTime = Date.now();
    let bytesSinceLast = 0;
    let currentSpeed = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;
        bytesSinceLast += value.length;

        const now = Date.now();
        const duration = (now - lastSampleTime) / 1000;
        if (duration >= 0.5) {
          currentSpeed = bytesSinceLast / duration;
          bytesSinceLast = 0;
          lastSampleTime = now;
        }

        const percent = Math.min(100, Math.round((receivedBytes / contentLength) * 1000) / 10);
        const etaSeconds = currentSpeed > 0 ? (contentLength - receivedBytes) / currentSpeed : 0;

        onProgress({
          fileId: fileMeta.id,
          stats: {
            speed: currentSpeed,
            transferredBytes: receivedBytes,
            totalBytes: contentLength,
            percent,
            etaSeconds,
            currentFileName: fileMeta.name,
            currentFileIndex: 1,
            totalFiles: 1,
            mode: 'relay',
          },
        });
      }
    } else {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const sha256 = await computeSHA256(blob);
      return {
        id: fileMeta.id,
        name: fileMeta.name,
        size: blob.size,
        type: fileMeta.mimeType,
        sha256,
        progress: 100,
        status: 'completed',
        blob,
        downloadUrl: url,
      };
    }

    const completeBlob = new Blob(chunks, { type: fileMeta.mimeType || 'application/octet-stream' });
    const localUrl = URL.createObjectURL(completeBlob);
    const sha256 = await computeSHA256(completeBlob);

    return {
      id: fileMeta.id,
      name: fileMeta.name,
      size: completeBlob.size,
      type: fileMeta.mimeType,
      sha256,
      progress: 100,
      status: 'completed',
      blob: completeBlob,
      downloadUrl: localUrl,
    };
  }
}

export const relay = new RelayService();
