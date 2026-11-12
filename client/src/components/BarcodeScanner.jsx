import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BarcodeDetector } from 'barcode-detector/ponyfill';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';

// ==========================================
// TUNABLE TIMING & CONFIRMATION CONSTANTS
// ==========================================
const SCAN_INTERVAL = 100; // ms: minimum time between detector.detect() calls (~10 fps)
const CONFIRM_READS = 2; // consecutive reads of the exact same code required to accept
const COOLDOWN = 800; // ms: pause detection completely after any accepted scan
const SAME_CODE_COOLDOWN = 2000; // ms: ignore the same code after it was accepted
const INACTIVITY_TIMEOUT = 60000; // ms: 60s auto-stop camera if no scan accepted

// Code 128 SKU validation pattern - adjust here to match your inventory format
const SKU_REGEX = /^[A-Za-z0-9-]{4,}$/;

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'code_128'];

/**
 * Standard Modulo 10 check-digit validation for EAN-13, EAN-8, and UPC-A.
 * Numeric only, length 8, 12, or 13.
 */
function isValidEanUpc(code) {
  if (!code || typeof code !== 'string') return false;
  if (!/^\d+$/.test(code)) return false;

  const len = code.length;
  if (len !== 8 && len !== 12 && len !== 13) return false;

  let sum = 0;
  let multiplier = 3;
  // Walk from right-to-left excluding the check digit, alternating weights 3 and 1
  for (let i = len - 2; i >= 0; i--) {
    sum += parseInt(code[i], 10) * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  return expectedCheckDigit === parseInt(code[len - 1], 10);
}

/**
 * Validates a detected barcode item against checksum rules or SKU pattern.
 */
function isValidBarcode(barcode) {
  if (!barcode || !barcode.rawValue) return false;
  const { format, rawValue } = barcode;

  if (format === 'code_128') {
    return SKU_REGEX.test(rawValue);
  }

  if (format === 'ean_13' || format === 'ean_8' || format === 'upc_a') {
    return isValidEanUpc(rawValue);
  }

  // Fallback if format is not specified by the underlying detector
  if (/^\d{8}$|^\d{12}$|^\d{13}$/.test(rawValue)) {
    return isValidEanUpc(rawValue);
  }

  return SKU_REGEX.test(rawValue);
}

/**
 * Computes center coordinates (X, Y) of a barcode from boundingBox or cornerPoints.
 */
function getBarcodeCenter(barcode) {
  if (barcode.boundingBox) {
    const { x, y, width, height } = barcode.boundingBox;
    return {
      x: x + width / 2,
      y: y + height / 2,
    };
  }

  if (barcode.cornerPoints && barcode.cornerPoints.length > 0) {
    const sumX = barcode.cornerPoints.reduce((acc, pt) => acc + pt.x, 0);
    const sumY = barcode.cornerPoints.reduce((acc, pt) => acc + pt.y, 0);
    return {
      x: sumX / barcode.cornerPoints.length,
      y: sumY / barcode.cornerPoints.length,
    };
  }

  return null;
}

/**
 * Reusable BarcodeScanner component
 * @param {Object} props
 * @param {(code: string) => void} props.onScan - Called when a barcode is verified and accepted
 * @param {() => void} props.onClose - Called to close scanner modal/overlay
 */
const BarcodeScanner = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);

  // Stable callback refs so effect doesn't restart when parent re-renders
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  // Tracking refs for confirmation streak & cooldowns
  const streakRef = useRef({ code: '', count: 0 });
  const lastAcceptedCodeRef = useRef('');
  const lastAcceptedTimeRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Audio feedback
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (err) {
      console.warn('Audio feedback failed:', err);
    }
  }, []);

  // Vibration feedback
  const triggerVibrate = useCallback(() => {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(200);
      } catch (err) {
        console.warn('Vibration feedback failed:', err);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('Error stopping media tracks:', err);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(async () => {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';

    // 1. Insecure context check
    if (!isHttps && !isLocalhost) {
      setError(
        'Insecure Context: Camera access requires HTTPS. Please access this application via an HTTPS URL.',
      );
      setLoading(false);
      return;
    }

    // 2. MediaDevices API support check
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError('Camera API is not supported on this device or browser.');
      setLoading(false);
      return;
    }

    stopCamera();

    try {
      // Create BarcodeDetector once
      if (!detectorRef.current) {
        detectorRef.current = new BarcodeDetector({
          formats: SUPPORTED_FORMATS,
        });
      }

      // Constraints: facingMode environment, ideal 1920x1080, continuous focus
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        },
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintErr) {
        console.warn(
          'Primary 1080p continuous-focus constraints failed, falling back:',
          constraintErr,
        );
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      }

      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Check for torch capability on active video track (torch off by default)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities =
          typeof videoTrack.getCapabilities === 'function'
            ? videoTrack.getCapabilities()
            : {};
        if (capabilities && 'torch' in capabilities) {
          setTorchSupported(true);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to start barcode scanner:', err);
      stopCamera();

      let errorMessage = 'Failed to access camera. Please try again.';
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError'
      ) {
        errorMessage =
          'Camera permission denied. Please allow camera access in your browser settings to scan barcodes.';
      } else if (
        err.name === 'NotFoundError' ||
        err.name === 'DevicesNotFoundError'
      ) {
        errorMessage = 'No camera found on this device.';
      } else if (
        err.name === 'NotReadableError' ||
        err.name === 'TrackStartError'
      ) {
        errorMessage =
          'Camera is currently in use by another application or cannot be started.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage =
          'The camera does not satisfy the required constraints (e.g., environment facing mode).';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setLoading(false);
    }
  }, [stopCamera]);

  const toggleTorch = async () => {
    const nextState = !torchOn;
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        await track.applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const handleRetry = () => {
    setError('');
    setLoading(true);
    startCamera();
  };

  useEffect(() => {
    let isStopped = false;
    let animationFrameId;
    let isDetecting = false;
    let lastDetectTime = 0;
    lastAcceptedTimeRef.current = Date.now(); // reset inactivity clock on mount

    // Tab visibility handling: pause/stop camera when tab goes to background
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isStopped = true;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        stopCamera();
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const start = async () => {
      await Promise.resolve();
      if (isStopped) return;
      await startCamera();

      // Process candidates in a frame
      const processFrame = (barcodes, videoW, videoH) => {
        // 1. Center region filter: X between 20% and 80%, Y between 25% and 75%
        const centerCandidates = barcodes.filter((barcode) => {
          const center = getBarcodeCenter(barcode);
          if (!center) return false;
          return (
            center.x >= videoW * 0.2 &&
            center.x <= videoW * 0.8 &&
            center.y >= videoH * 0.25 &&
            center.y <= videoH * 0.75
          );
        });

        // 2. Validate checksums (EAN/UPC) or SKU pattern (Code 128)
        const validCandidates = centerCandidates.filter(isValidBarcode);

        // 3. Ambiguity check: if more than 1 valid barcode is inside center region, ignore frame
        if (validCandidates.length > 1) {
          streakRef.current = { code: '', count: 0 };
          return;
        }

        // 4. If no valid barcodes in center, reset streak
        if (validCandidates.length === 0) {
          streakRef.current = { code: '', count: 0 };
          return;
        }

        // 5. Exactly 1 valid barcode candidate
        const candidateCode = validCandidates[0].rawValue;

        if (candidateCode === streakRef.current.code) {
          streakRef.current.count += 1;
        } else {
          streakRef.current = { code: candidateCode, count: 1 };
        }

        // 6. Confirm reads requirement (CONFIRM_READS = 2 consecutive frames)
        if (streakRef.current.count >= CONFIRM_READS) {
          const now = Date.now();

          // Check SAME_CODE_COOLDOWN (2000ms)
          if (
            candidateCode === lastAcceptedCodeRef.current &&
            now - lastAcceptedTimeRef.current < SAME_CODE_COOLDOWN
          ) {
            return;
          }

          // ACCEPT SCAN
          lastAcceptedCodeRef.current = candidateCode;
          lastAcceptedTimeRef.current = now;
          cooldownUntilRef.current = now + COOLDOWN; // 800ms global detection cooldown
          streakRef.current = { code: '', count: 0 }; // reset streak after acceptance

          setLastScanned(candidateCode);
          playBeep();
          triggerVibrate();

          if (onScanRef.current) {
            onScanRef.current(candidateCode);
          }
        }
      };

      // Main detection loop
      const scanLoop = async () => {
        if (isStopped) return;

        const now = performance.now();
        const timeSinceLastDetect = now - lastDetectTime;

        // Auto-stop camera after 60s with no accepted scan
        if (Date.now() - lastAcceptedTimeRef.current > INACTIVITY_TIMEOUT) {
          isStopped = true;
          stopCamera();
          if (onCloseRef.current) {
            onCloseRef.current();
          }
          return;
        }

        // Cooldown check (pauses detection after an accepted scan)
        const isUnderCooldown = Date.now() < cooldownUntilRef.current;

        // Rate limit: at most every 100ms (~10 fps), busy check, and not under cooldown
        if (
          !isUnderCooldown &&
          timeSinceLastDetect >= SCAN_INTERVAL &&
          !isDetecting
        ) {
          const video = videoRef.current;
          const detector = detectorRef.current;

          if (
            video &&
            detector &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            isDetecting = true;
            lastDetectTime = now;

            try {
              const barcodes = await detector.detect(video);
              if (!isStopped && barcodes && barcodes.length > 0) {
                processFrame(barcodes, video.videoWidth, video.videoHeight);
              } else if (!isStopped) {
                streakRef.current = { code: '', count: 0 };
              }
            } catch {
              // Silently ignore frame detection failures
            } finally {
              isDetecting = false;
            }
          }
        }

        if (!isStopped) {
          animationFrameId = requestAnimationFrame(scanLoop);
        }
      };

      animationFrameId = requestAnimationFrame(scanLoop);
    };

    start();

    return () => {
      isStopped = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      stopCamera();
    };
  }, [startCamera, stopCamera, playBeep, triggerVibrate]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        bgcolor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Video Element */}
      <Box
        component="video"
        ref={videoRef}
        autoPlay
        playsInline
        muted
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Top Header Bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        <Typography variant="h6" color="white" fontWeight={700}>
          Barcode Scanner
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Torch toggle button - only rendered when torch is supported by the track */}
          {torchSupported && (
            <IconButton
              onClick={toggleTorch}
              sx={{
                bgcolor: torchOn ? 'warning.main' : 'rgba(255,255,255,0.2)',
                color: torchOn ? '#000' : '#fff',
                '&:hover': {
                  bgcolor: torchOn ? 'warning.light' : 'rgba(255,255,255,0.3)',
                },
              }}
              aria-label="Toggle Torch"
            >
              {torchOn ? <FlashOnIcon /> : <FlashOffIcon />}
            </IconButton>
          )}

          <IconButton
            onClick={onClose}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
            }}
            aria-label="Close Scanner"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Aiming Overlay (matches 20-80% width and 25-75% height) */}
      {!error && (
        <Box
          sx={{
            position: 'absolute',
            left: '20%',
            top: '25%',
            width: '60%',
            height: '50%',
            borderRadius: 3,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none', // Does not block taps on any button
            zIndex: 5,
          }}
        >
          {/* Viewfinder Corners */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 24,
              height: 24,
              borderTop: '4px solid #1976d2',
              borderLeft: '4px solid #1976d2',
              borderTopLeftRadius: 8,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 24,
              height: 24,
              borderTop: '4px solid #1976d2',
              borderRight: '4px solid #1976d2',
              borderTopRightRadius: 8,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 24,
              height: 24,
              borderBottom: '4px solid #1976d2',
              borderLeft: '4px solid #1976d2',
              borderBottomLeftRadius: 8,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderBottom: '4px solid #1976d2',
              borderRight: '4px solid #1976d2',
              borderBottomRightRadius: 8,
            }}
          />

          {/* Red scan line animation */}
          <Box
            sx={{
              position: 'absolute',
              left: 8,
              right: 8,
              height: '2px',
              backgroundColor: '#ff1744',
              boxShadow: '0 0 8px #ff1744',
              animation: 'scanAnimation 2s infinite ease-in-out',
              '@keyframes scanAnimation': {
                '0%': { top: '10%' },
                '50%': { top: '85%' },
                '100%': { top: '10%' },
              },
            }}
          />

          {loading && (
            <CircularProgress
              size={36}
              sx={{ color: 'white', position: 'absolute' }}
            />
          )}
        </Box>
      )}

      {/* Error state message */}
      {error && (
        <Box
          sx={{
            position: 'relative',
            zIndex: 10,
            maxWidth: 420,
            mx: 2,
            p: 3,
            bgcolor: 'background.paper',
            borderRadius: 3,
            textAlign: 'center',
            boxShadow: 6,
          }}
        >
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {error}
          </Alert>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<VideocamIcon />}
              onClick={handleRetry}
            >
              Retry Camera
            </Button>
            <Button variant="outlined" onClick={onClose}>
              Close
            </Button>
          </Box>
        </Box>
      )}

      {/* Bottom status & tips */}
      {!error && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            pointerEvents: 'none',
          }}
        >
          {lastScanned && (
            <Chip
              label={`Scanned: ${lastScanned}`}
              color="primary"
              sx={{
                fontWeight: 700,
                fontSize: '0.9rem',
                bgcolor: 'primary.main',
                color: 'white',
                boxShadow: 3,
              }}
            />
          )}
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              textAlign: 'center',
              bgcolor: 'rgba(0,0,0,0.65)',
              px: 2.5,
              py: 0.8,
              borderRadius: 2,
              backdropFilter: 'blur(4px)',
            }}
          >
            Align one barcode inside the box
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default BarcodeScanner;
