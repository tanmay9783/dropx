export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/Windows/.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'MacBook / iMac';
  else if (/iPad|iPhone|iPod/.test(ua)) os = 'iPhone / iPad';
  else if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?; (.*?)\)/);
    if (match && match[1] && !match[1].includes('Mobile')) {
      os = match[1].trim(); 
    } else {
      os = 'Android Device';
    }
  } else if (/Linux/.test(ua)) {
    os = 'Linux PC';
  }

  let browser = '';
  if (/Chrome/.test(ua) && !/Edge|Edg/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Edge|Edg/.test(ua)) browser = 'Edge';

  return browser ? `${browser} on ${os}` : os;
}
