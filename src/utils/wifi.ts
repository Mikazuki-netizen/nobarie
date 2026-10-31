export interface ParsedWifiPayload {
  isWifi: boolean;
  ssid?: string;
  password?: string;
  url?: string;
  code?: string;
  sid?: string;
  token?: string;
}

export function parseWifiQr(text: string): ParsedWifiPayload {
  if (!text || !text.startsWith('WIFI:')) {
    return { isWifi: false };
  }

  const result: ParsedWifiPayload = { isWifi: true };

  // Match SSID (S:...)
  const ssidMatch = text.match(/S:([^;]+)/);
  if (ssidMatch) {
    result.ssid = ssidMatch[1];
  }

  // Match Password (P:...)
  const passMatch = text.match(/P:([^;]+)/);
  if (passMatch) {
    result.password = passMatch[1];
  }

  // Match URL if appended (URL:http://...)
  const urlMatch = text.match(/URL:(https?:\/\/[^\s;]+)/);
  if (urlMatch) {
    result.url = urlMatch[1];
    try {
      const parsedUrl = new URL(result.url);
      result.code = parsedUrl.searchParams.get('code') || undefined;
      result.sid = parsedUrl.searchParams.get('sid') || undefined;
      result.token = parsedUrl.searchParams.get('token') || undefined;
    } catch {
      // Ignore
    }
  }

  return result;
}

export function generateWifiQrString(ssid: string, password?: string, transferUrl?: string): string {
  const passPart = password ? `P:${password};` : '';
  const urlPart = transferUrl ? `;URL:${transferUrl}` : '';
  return `WIFI:T:WPA;S:${ssid};${passPart};${urlPart}`;
}

export function joinNativeWifi(ssid: string, password?: string): boolean {
  try {
    const webkit = (window as any).webkit;
    if (webkit && webkit.messageHandlers && webkit.messageHandlers.nativeWifi) {
      webkit.messageHandlers.nativeWifi.postMessage({
        action: 'join',
        ssid,
        password: password || '',
      });
      return true;
    }
  } catch (err) {
    console.warn('[WiFi] native join error:', err);
  }
  return false;
}
