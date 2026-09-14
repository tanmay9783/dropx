export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let os = '';

  // OS / Device Type Detection
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Android/.test(ua)) {
    if (/Samsung|SM-[A-Z0-9]+/i.test(ua)) {
      os = 'Samsung Phone';
    } else if (/Pixel/i.test(ua)) {
      const match = ua.match(/Pixel\s?[\d\w\s]+/i);
      os = match ? match[0].trim() : 'Pixel Phone';
    } else if (/OnePlus|OPD|CPH/i.test(ua)) {
      os = 'OnePlus Phone';
    } else if (/Redmi|POCO|Xiaomi|Mi\s/i.test(ua)) {
      os = 'Xiaomi Phone';
    } else if (/Moto/i.test(ua)) {
      os = 'Moto Phone';
    } else {
      os = /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
    }
  } else if (/Windows/.test(ua)) {
    os = 'Windows PC';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'Mac';
  } else if (/Linux/.test(ua)) {
    os = 'Linux PC';
  } else if (/CrOS/.test(ua)) {
    os = 'Chromebook';
  } else {
    os = 'Device';
  }

  // Browser Detection
  let browser = '';
  if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Edg|Edge/i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';

  if (browser && os) {
    return `${browser} on ${os}`;
  }
  return browser || os || 'Unknown Device';
}
