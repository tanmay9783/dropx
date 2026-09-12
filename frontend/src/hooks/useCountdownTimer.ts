import { useState, useEffect, useCallback } from 'react';

export function useCountdownTimer(expiresAt: string | null, onExpire?: () => void) {
  const calculateRemainingSeconds = useCallback(() => {
    if (!expiresAt) return 0;
    const target = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = Math.floor((target - now) / 1000);
    return diff > 0 ? diff : 0;
  }, [expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemainingSeconds);

  useEffect(() => {
    if (!expiresAt) return;

    // Initial check
    const remaining = calculateRemainingSeconds();
    setRemainingSeconds(remaining);
    if (remaining <= 0 && onExpire) {
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      const seconds = calculateRemainingSeconds();
      setRemainingSeconds(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);

    // Recalculate on tab focus / visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const secs = calculateRemainingSeconds();
        setRemainingSeconds(secs);
        if (secs <= 0 && onExpire) {
          onExpire();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [expiresAt, calculateRemainingSeconds, onExpire]);

  // Format as HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isExpired: remainingSeconds <= 0,
  };
}
