import { DeviceInfo } from '../types/flux';

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  let platform: DeviceInfo['platform'] = 'Other';
  let isMobile = false;

  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    platform = 'iOS';
    isMobile = true;
  } else if (/Android/.test(ua)) {
    platform = 'Android';
    isMobile = true;
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    platform = 'macOS';
  } else if (/Windows/.test(ua)) {
    platform = 'Windows';
  } else if (/Linux/.test(ua)) {
    platform = 'Linux';
  }

  let browser = 'Browser';
  if (/Edg\//.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  }

  const savedName = localStorage.getItem('flux_device_name');
  const defaultName = savedName || `${platform === 'iOS' ? 'iPhone' : platform === 'Android' ? 'Android Device' : platform} (${browser})`;

  return {
    name: defaultName,
    platform,
    browser,
    isMobile,
  };
}
