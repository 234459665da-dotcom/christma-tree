import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, Image } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { AppMode, GestureType } from '../types';

const PhotoItem: React.FC<{ 
  photo: any; 
  index: number; 
  total: number;
}> = ({ photo, index, total }) => {
  const meshRef = useRef<THREE.Group>(null);
  const { mode, focusedPhotoId, setFocusedPhotoId, setMode, handState } = useStore();
  
  // Pre-calculate target positions
  const targets = useMemo(() => {
    // TREE: Spiral around the tree, but larger radius so they sit on outside
    const t = index / total;
    const angle = t * Math.PI * 10;
    const height = (t * 7) - 3.5;
    const r = (4 - height) * 0.4 + 0.8; // Offset from ornaments
    
    const treePos = new THREE.Vector3(Math.cos(angle) * r, height, Math.sin(angle) * r);
    const treeRot = new THREE.Euler(0, -angle, 0);

    // SCATTER: Varied random positions
    const scatterPos = new THREE.Vector3(
      (Math.random() - 0.5) * 18, // Wider spread
      (Math.random() - 0.5) * 12, // Taller spread
      (Math.random() - 0.5) * 10 - 1 // Depth
    );
    const scatterRot = new THREE.Euler(
      (Math.random() - 0.5) * Math.PI * 0.5,
      (Math.random() - 0.5) * Math.PI * 0.5,
      (Math.random() - 0.5) * Math.PI * 0.2
    );

    // Drift/Sway Parameters
    const swaySpeed = 0.5 + Math.random();
    const swayOffset = Math.random() * Math.PI * 2;
    const swayAmp = new THREE.Vector3(
        0.2 + Math.random() * 0.3,
        0.2 + Math.random() * 0.3,
        0.1 + Math.random() * 0.2
    );

    return { treePos, treeRot, scatterPos, scatterRot, swaySpeed, swayOffset, swayAmp };
  }, [index, total]);

  // Raycaster for hand interaction
  const { camera, raycaster, scene } = useThree();

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    let targetPos = new THREE.Vector3();
    let targetRot = new THREE.Euler();
    let targetScale = 1;

    // Time-based sway calculation
    const time = state.clock.elapsedTime;
    const t = time * targets.swaySpeed + targets.swayOffset;
    
    // Calculate sway vector
    const sway = new THREE.Vector3(
        Math.sin(t) * targets.swayAmp.x,
        Math.cos(t * 0.8) * targets.swayAmp.y,
        Math.sin(t * 1.2) * targets.swayAmp.z
    );

    if (mode === AppMode.TREE) {
      targetPos.copy(targets.treePos);
      targetRot.copy(targets.treeRot);
      targetScale = 0.8;
    } else if (mode === AppMode.SCATTER) {
      // Base position + sway
      targetPos.copy(targets.scatterPos).add(sway);
      
      // Base rotation + slight sway
      targetRot.copy(targets.scatterRot);
      targetRot.x += Math.sin(t * 0.5) * 0.1;
      targetRot.y += Math.cos(t * 0.3) * 0.1;

      targetScale = 1.2;
    } else if (mode === AppMode.FOCUS) {
      if (focusedPhotoId === photo.id) {
        // Center screen, facing camera
        targetPos.set(0, 0, 4); // Close to camera
        targetRot.set(0, 0, 0);
        targetScale = 3.5;
      } else {
        // Push others back, but keep them floating slightly
        targetPos.copy(targets.scatterPos).multiplyScalar(1.5).add(sway);
        targetRot.copy(targets.scatterRot);
        targetScale = 0.5;
      }
    }

    // Lerp transform
    meshRef.current.position.lerp(targetPos, 0.05);
    // Quaternion slerp for rotation is better, but Euler lerp is okay for this simple effect
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, 0.05);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, 0.05);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, 0.05);
    
    const currentScale = meshRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.08);
    meshRef.current.scale.setScalar(newScale);

    // Hand Interaction Logic (Raycasting)
    if (handState.present && (handState.gesture === GestureType.PINCH || handState.gesture === GestureType.OPEN_HAND)) {
       // Only interact in SCATTER mode or if already focused
       if (mode === AppMode.SCATTER || mode === AppMode.FOCUS) {
         // Update raycaster based on hand coordinates (0-1) -> NDC (-1 to 1)
         const mouse = new THREE.Vector2(
           (handState.x * 2) - 1,
           -(handState.y * 2) + 1
         );
         raycaster.setFromCamera(mouse, camera);

         const intersects = raycaster.intersectObject(meshRef.current, true);
         if (intersects.length > 0) {
             // Hover effect could go here (e.g., slight scale up)
             if (handState.gesture === GestureType.PINCH) {
                if (mode !== AppMode.FOCUS || focusedPhotoId !== photo.id) {
                    setMode(AppMode.FOCUS);
                    setFocusedPhotoId(photo.id);
                }
             }
         }
       }
    }
  });

  return (
    <group ref={meshRef}>
      {/* Frame */}
      <mesh position={[0, 0, -0.01]}>
         <boxGeometry args={[1.1, 1.1, 0.05]} />
         <meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Photo */}
      <Image url={photo.url} transparent position={[0, 0, 0.03]} scale={[1, 1, 1]} />
    </group>
  );
};

const PhotoCloud: React.FC = () => {
  const photos = useStore(state => state.photos);
  return (
    <group>
      {photos.map((photo, i) => (
        <PhotoItem key={photo.id} photo={photo} index={i} total={photos.length} />
      ))}
    </group>
  );
};

export default PhotoCloud;