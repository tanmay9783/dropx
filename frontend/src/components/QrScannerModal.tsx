import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Upload, AlertCircle, Sparkles, Check } from 'lucide-react';
import jsQR from 'jsqr';

interface QrScannerModalProps {
  onScan: (code: string, key?: string | null) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      // Not a valid URL, search anywhere in text for a 6-character room token
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

  // Start Camera Stream
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      setLoading(true);
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        if (videoDevices.length > 1) {
          setHasMultipleCameras(true);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser settings.'
            : 'Unable to start camera. You can also upload a QR code image below.'
        );
        setLoading(false);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // Real-time Frame Scanning Loop
  useEffect(() => {
    let animationFrameId: number;
    let scanning = true;

    // Check for native BarcodeDetector API support
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
        // 1. Try hardware-accelerated BarcodeDetector if available
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
            // Fall back to jsQR below
          }
        }

        // 2. Fallback to jsQR frame analysis
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

  // Handle uploaded QR image decoding
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
        setError('No valid DropX QR code was found in this image.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
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
            <div className="p-6 text-center flex flex-col items-center space-y-3 max-w-xs text-xs text-rose-300">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p>{error}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold flex items-center space-x-2 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload QR Image</span>
              </button>
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
