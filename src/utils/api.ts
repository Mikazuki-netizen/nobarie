import { Capacitor } from '@capacitor/core';

let runtimeServerUrl: string | null = null;

export function setTargetServerUrl(url: string | null) {
  if (url) {
    const clean = url.trim().replace(/\/$/, '');
    runtimeServerUrl = clean;
    localStorage.setItem('flux_server_url', clean);
  } else {
    runtimeServerUrl = null;
    localStorage.removeItem('flux_server_url');
  }
}

export function getServerUrl(): string {
  if (runtimeServerUrl) {
    return runtimeServerUrl;
  }

  const custom = localStorage.getItem('flux_server_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }

  // When running natively on iOS device (via Xcode install)
  if (Capacitor.isNativePlatform()) {
    // Default to the active local IP for high-speed local transfer
    return 'http://10.0.10.20:3001';
  }

  // When running in standard web browser
  return window.location.origin;
}

export function getWsUrl(): string {
  const server = getServerUrl();
  const isSecure = server.startsWith('https:');
  const host = server.replace(/^https?:\/\//, '');
  return `${isSecure ? 'wss:' : 'ws:'}//${host}/ws`;
}

export function getApiEndpoint(path: string): string {
  const base = getServerUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

