import { Capacitor } from '@capacitor/core';

export function getServerUrl(): string {
  const custom = localStorage.getItem('flux_server_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }

  // When running natively on iOS device (via Xcode install)
  if (Capacitor.isNativePlatform()) {
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
