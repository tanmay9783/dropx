import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Upload, AlertCircle, Sparkles, Check, Lock } from 'lucide-react';
import jsQR from 'jsqr';

interface QrScannerModalProps {
  initialStream?: MediaStream | null;
  initialError?: string | null;
  initialPermissionDenied?: boolean;
  onScan: (code: string, key?: string | null) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  initialStream,
  initialError,
  initialPermissionDenied,
  onScan,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(!initialStream && !initialError);
  const [error, setError] = useState<string | null>(initialError || null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(!!initialPermissionDenied);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // Parse DropX Room code from scanned URL or raw code
  const parseScannedData = (text: string): { code: string; key?: string } | null => {
    if (!text) return null;
    const trimmed = text.trim();

    // 1. Direct 6-character code
    if (/^[2-9A-Z]{6}$/i.test(trimmed)) {
      return { code: trimmed.toUpperCase() };
    }

    // 2. URL parsing (e.g. https://domain.com/#FE8MMZ or ?code=FE8MMZ or /join/FE8MMZ)
    try {
      const url = new URL(trimmed);
      let foundCode: string | null = null;
      let foundKey: string | undefined;

      // Check query param ?code=
      const queryCode = url.searchParams.get('code');
      if (queryCode && /^[2-9A-Z]{6}$/i.test(queryCode)) {
        foundCode = queryCode.toUpperCase();
      }

      // Check URL hash #ROOMCODE or #key=...
      if (!foundCode && url.hash) {
        const hash = url.hash.replace('#', '');
        const hashMatch = hash.match(/([2-9A-Z]{6})/i);
        if (hashMatch) {
          foundCode = hashMatch[1].toUpperCase();
        }
        const keyMatch = hash.match(/key=([^&]+)/);
        if (keyMatch) {
          foundKey = keyMatch[1];
        }
      }

      // Check pathname (e.g. /join/FE8MMZ)
      if (!foundCode) {
        const parts = url.pathname.split('/').filter(Boolean);
        for (const part of parts) {
          if (/^[2-9A-Z]{6}$/i.test(part)) {
            foundCode = part.toUpperCase();
            break;
          }
        }
      }

      if (foundCode) {
        return { code: foundCode, key: foundKey };
      }
    } catch {
      // Search anywhere in text for a 6-character room token
      const match = trimmed.match(/\b([2-9A-Z]{6})\b/i);
      if (match) {
        return { code: match[1].toUpperCase() };
      }
    }

    return null;
  };

  const handleSuccessfulScan = (code: string, key?: string | null) => {
    if (detectedCode) return;
    setDetectedCode(code);
    try {
      navigator.vibrate?.(100);
    } catch {
      // Ignore vibration error
    }
    setTimeout(() => {
      onScan(code, key);
      onClose();
    }, 400);
  };

  // Start Camera Stream with automatic fallback
  const startCameraWithMode = useCallback(async (mode: 'environment' | 'user') => {
    setLoading(true);
    setError(null);
    setIsPermissionDenied(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported on this browser. Please use Chrome or Safari, or upload a QR image.');
      setLoading(false);
      return;
    }

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    let stream: MediaStream | null = null;

    try {
      // 1. Try with preferred camera facingMode
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
        },
        audio: false,
      });
    } catch (firstErr: any) {
      // 2. Fallback to basic unconstrained video
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (fallbackErr: any) {
        const isDenied = fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError';
        setIsPermissionDenied(isDenied);
        setError(
          isDenied
            ? 'Camera permission is blocked for this site. You can unblock it via the lock icon or upload a QR screenshot below.'
            : 'Unable to open camera on this device. You can choose a QR image from your gallery.'
        );
        setLoading(false);
        return;
      }
    }

    if (!stream) {
      setError('Camera stream could not be started.');
      setLoading(false);
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay may need user gesture
      }
    }
    setLoading(false);

    // Check for multiple cameras only after permissions are active
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length > 1) {
        setHasMultipleCameras(true);
      }
    } catch {
      // Ignore enumeration error
    }
  }, []);

  const startCamera = useCallback(async () => {
    return startCameraWithMode(facingMode);
  }, [facingMode, startCameraWithMode]);

  useEffect(() => {
    if (initialStream) {
      streamRef.current = initialStream;
      if (videoRef.current) {
        videoRef.current.srcObject = initialStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setLoading(false);
      setError(null);
      setIsPermissionDenied(false);

      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const videoDevices = devices.filter((d) => d.kind === 'videoinput');
            if (videoDevices.length > 1) {
              setHasMultipleCameras(true);
            }
          })
          .catch(() => {});
      }
      return;
    }

    if (initialError) {
      setError(initialError);
      setIsPermissionDenied(!!initialPermissionDenied);
      setLoading(false);
      return;
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [initialStream, initialError, initialPermissionDenied, startCamera]);

  // Ensure stream is attached to video element as soon as viewfinder mounts
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [loading, error]);

  // Real-time Frame Scanning Loop
  useEffect(() => {
    let animationFrameId: number;
    let scanning = true;

    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    let barcodeDetector: any = null;
    if (BarcodeDetectorClass) {
      try {
        barcodeDetector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      } catch {
        barcodeDetector = null;
      }
    }

    const scanFrame = async () => {
      if (!scanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        // 1. Try BarcodeDetector if available
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              const parsed = parseScannedData(rawValue);
              if (parsed) {
                scanning = false;
                handleSuccessfulScan(parsed.code, parsed.key);
                return;
              }
            }
          } catch {
            // Fall back to jsQR
          }
        }

        // 2. jsQR Canvas fallback
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            const parsed = parseScannedData(code.data);
            if (parsed) {
              scanning = false;
              handleSuccessfulScan(parsed.code, parsed.key);
              return;
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(scanFrame);
    };

    animationFrameId = requestAnimationFrame(scanFrame);

    return () => {
      scanning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [detectedCode]);

  // Handle uploaded QR image from gallery / files
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height);
        if (qr && qr.data) {
          const parsed = parseScannedData(qr.data);
          if (parsed) {
            handleSuccessfulScan(parsed.code, parsed.key);
            return;
          }
        }
        setError('No valid DropX QR code was found in this image. Please choose another photo or screenshot.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toggleCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCameraWithMode(nextMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md flex flex-col glass-panel rounded-3xl border border-yellow-500/30 shadow-2xl overflow-hidden bg-slate-950">
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Scan Room QR Code</h3>
              <p className="text-[11px] text-slate-400">Point your camera at the host QR code</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {hasMultipleCameras && (
              <button
                onClick={toggleCamera}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
              title="Close Scanner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center flex flex-col items-center space-y-4 max-w-xs text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div>
                <p className="font-bold text-sm text-white mb-1">
                  {isPermissionDenied ? 'Camera Access Blocked' : 'Camera Unavailable'}
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  {error}
                </p>
              </div>

              {isPermissionDenied && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-300 text-left space-y-1 w-full">
                  <div className="flex items-center space-x-1 font-semibold text-yellow-400">
                    <Lock className="w-3 h-3" />
                    <span>How to unblock in Chrome:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                    <li>Tap the <strong>🔒 lock icon</strong> beside the URL.</li>
                    <li>Tap <strong>Permissions</strong> ➔ Enable <strong>Camera</strong>.</li>
                    <li>Tap <strong>Retry Camera</strong> below.</li>
                  </ol>
                </div>
              )}

              <div className="flex flex-col gap-2 w-full pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose QR Image from Gallery</span>
                </button>

                <button
                  onClick={startCamera}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center space-x-1.5 transition-all text-[11px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Hidden Processing Canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning Reticle & HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-56 h-56 rounded-3xl border-2 border-yellow-400/80 shadow-[0_0_40px_rgba(250,204,21,0.25)] flex items-center justify-center overflow-hidden">
                  {/* Corner Accent Brackets */}
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-yellow-400 rounded-tl-xl"></div>
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-yellow-400 rounded-tr-xl"></div>
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-yellow-400 rounded-bl-xl"></div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-yellow-400 rounded-br-xl"></div>

                  {/* Animated Sweeping Laser Line */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_12px_#facc15] animate-laser"></div>

                  {detectedCode && (
                    <div className="absolute inset-0 bg-yellow-500/20 backdrop-blur-xs flex flex-col items-center justify-center text-yellow-300 animate-fade-in">
                      <div className="h-10 w-10 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold mb-1 shadow-lg">
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                      <span className="text-xs font-mono font-black">{detectedCode}</span>
                    </div>
                  )}
                </div>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-2 text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-yellow-400" />
                  <span>Starting camera viewfinder...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Instant room join on detection</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 font-semibold transition-all flex items-center space-x-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
