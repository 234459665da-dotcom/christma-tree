import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { useStore } from '../store';
import { AppMode, GestureType } from '../types';

const HandRecognizer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setHandState, setMode, mode, setCameraRotation, focusedPhotoId, setFocusedPhotoId } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start()
      .then(() => setIsLoading(false))
      .catch(err => console.error("Camera error:", err));

    return () => {
      // Cleanup not fully exposed by library, but we stop the loop implicitly
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResults = (results: Results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setHandState({ present: false, gesture: GestureType.NONE });
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    
    // Calculate Centroid (approximate palm center)
    const palmX = landmarks[0].x; // Wrist
    const palmY = landmarks[0].y;
    
    // Detect Gestures
    const gesture = detectGesture(landmarks);
    
    // Normalize coordinates (0-1) - Invert X for mirror effect
    const x = 1 - landmarks[9].x; // Use middle finger knuckle for stability
    const y = landmarks[9].y;

    // Interaction Logic based on Gesture
    if (gesture === GestureType.FIST) {
      if (mode !== AppMode.TREE) {
        setMode(AppMode.TREE);
        setFocusedPhotoId(null);
      }
    } else if (gesture === GestureType.OPEN_HAND) {
      if (mode === AppMode.TREE || (mode === AppMode.FOCUS && !focusedPhotoId)) {
        setMode(AppMode.SCATTER);
      }
    }

    // Camera Rotation Logic (Only in SCATTER mode)
    if (mode === AppMode.SCATTER && gesture !== GestureType.FIST) {
      // Map x/y (0-1) to rotation angles
      // x: 0 -> -PI/4, 1 -> PI/4
      // y: 0 -> -PI/4, 1 -> PI/4
      const rotX = (y - 0.5) * 1.5;
      const rotY = (x - 0.5) * 1.5;
      setCameraRotation({ x: rotX, y: rotY });
    }

    setHandState({
      present: true,
      gesture,
      x,
      y,
      pinchDistance: calculateDistance(landmarks[4], landmarks[8])
    });
  };

  const detectGesture = (landmarks: any[]): GestureType => {
    // Finger states (approximate)
    // 4: Thumb Tip, 8: Index Tip, 12: Middle Tip, 16: Ring Tip, 20: Pinky Tip
    // Compare tip y to pip y (proximal interphalangeal joint)
    
    const isFingerBent = (tipIdx: number, pipIdx: number) => {
      // Note: Y increases downwards in screen coordinates
      // If tip is below PIP (higher Y value), it is bent (for palm facing camera)
      // This logic depends on hand orientation, assuming palm faces camera
      return landmarks[tipIdx].y > landmarks[pipIdx].y;
    };

    // Calculate distances from wrist (0) to tips to be more orientation independent
    const wrist = landmarks[0];
    const isBentDist = (tipIdx: number) => {
        const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
        const dKnuckle = Math.hypot(landmarks[tipIdx - 2].x - wrist.x, landmarks[tipIdx - 2].y - wrist.y);
        return dTip < dKnuckle * 1.2; // Threshold for bent
    };

    const indexBent = isBentDist(8);
    const middleBent = isBentDist(12);
    const ringBent = isBentDist(16);
    const pinkyBent = isBentDist(20);

    const allFingersBent = indexBent && middleBent && ringBent && pinkyBent;
    const allFingersOpen = !indexBent && !middleBent && !ringBent && !pinkyBent;

    // Pinch Detection
    const pinchDist = calculateDistance(landmarks[4], landmarks[8]);
    
    if (pinchDist < 0.05) {
      return GestureType.PINCH;
    }

    if (allFingersBent) {
      return GestureType.FIST;
    }

    if (allFingersOpen) {
      return GestureType.OPEN_HAND;
    }

    return GestureType.NONE;
  };

  const calculateDistance = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  };

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 text-white">
          <div className="text-center">
             <div className="w-16 h-16 border-4 border-t-gold-500 border-white/20 rounded-full animate-spin mx-auto mb-4"></div>
             <p className="font-serif text-gold-400">Initializing Vision Systems...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default HandRecognizer;