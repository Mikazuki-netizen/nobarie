import { Capacitor } from '@capacitor/core';

// Candidate servers to probe on local Wi-Fi / Hotspot / USB bridge
export const CANDIDATE_SERVERS: string[] = [
  'http://10.0.10.20:3001',        // Local Wi-Fi router LAN
  'http://169.254.164.183:3001',   // USB link-local bridge to Mac
  'http://192.168.43.1:3001',      // Android Hotspot default gateway
  'http://172.20.10.1:3001',       // iOS Hotspot default gateway
  'http://localhost:3001',         // Simulator / Localhost
  'http://127.0.0.1:3001',
];

let runtimeServerUrl: string | null = null;
let isProbing = false;

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

  if (Capacitor.isNativePlatform()) {
    return CANDIDATE_SERVERS[0];
  }

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

/**
 * Probes all candidate server endpoints concurrently to discover the fastest reachable server.
 */
export async function discoverWorkingServer(): Promise<string> {
  if (isProbing) {
    return getServerUrl();
  }
  isProbing = true;

  try {
    const custom = localStorage.getItem('flux_server_url');
    const candidates = Array.from(
      new Set([
        ...(custom ? [custom] : []),
        ...(runtimeServerUrl ? [runtimeServerUrl] : []),
        ...CANDIDATE_SERVERS,
      ])
    );

    const probe = async (baseUrl: string): Promise<string> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      try {
        const cleanBase = baseUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanBase}/api/info`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && data.name && data.name.includes('NoBarier')) {
            return cleanBase;
          }
        }
      } catch {
        clearTimeout(timer);
      }
      throw new Error(`Unreachable: ${baseUrl}`);
    };

    // Race to find the fastest responding valid server
    try {
      const fastest = await Promise.any(candidates.map((url) => probe(url)));
      if (fastest) {
        runtimeServerUrl = fastest;
        localStorage.setItem('flux_server_url', fastest);
        console.log(`[NoBarier Discovery] Locked onto active server: ${fastest}`);
        return fastest;
      }
    } catch {
      // None answered immediately; fall back
    }
  } finally {
    isProbing = false;
  }

  return getServerUrl();
}

/**
 * Fetch wrapper that automatically retries across candidate servers if connection fails.
 */
export async function fetchWithFallback(path: string, options: RequestInit = {}): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // 1. First attempt with current active server
  try {
    const currentUrl = `${getServerUrl()}${cleanPath}`;
    const res = await fetch(currentUrl, options);
    return res;
  } catch (err: any) {
    console.warn(`[NoBarier API] Primary request to ${cleanPath} failed (${err.message || 'NetworkError'}), probing fallback servers...`);
  }

  // 2. Discover working server dynamically
  const discovered = await discoverWorkingServer();
  const retryUrl = `${discovered}${cleanPath}`;
  
  // 3. Retry on the discovered server
  return fetch(retryUrl, options);
}

// Automatically trigger probe on launch
if (typeof window !== 'undefined') {
  setTimeout(() => {
    discoverWorkingServer().catch(() => {});
  }, 100);
}
