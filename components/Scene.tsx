import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import Ornaments from './Ornaments';
import PhotoCloud from './PhotoCloud';
import { useStore } from '../store';
import { AppMode } from '../types';

const CameraController: React.FC = () => {
    const { cameraRotation, mode } = useStore();
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        
        // Base rotation logic
        let targetRotX = 0;
        let targetRotY = 0;

        if (mode === AppMode.SCATTER) {
            // Hand controls camera in Scatter mode
            targetRotX = cameraRotation.y * 0.5; // Yaw
            targetRotY = cameraRotation.x * 0.5; // Pitch
        } else if (mode === AppMode.TREE) {
            // Auto rotate in Tree mode
            targetRotX = state.clock.elapsedTime * 0.1;
        }

        // Smoothly interpolate
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotX, 0.05);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotY, 0.05);

        // Move camera group Z position based on mode
        const targetZ = mode === AppMode.FOCUS ? 2 : 0;
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.05);
    });

    return (
        <group ref={groupRef}>
            <group position={[0, 0, 10]}>
                <perspectiveCamera makeDefault fov={45} />
            </group>
        </group>
    );
};

const Scene: React.FC = () => {
  return (
    <Canvas
      gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#050805']} />
      
      <CameraController />

      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#FFD700" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B0000" />
      <spotLight position={[0, 10, 0]} angle={0.5} penumbra={1} intensity={2} color="#ffffff" castShadow />

      <group position={[0, -1, 0]}>
         <Ornaments />
         <PhotoCloud />
      </group>

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.4} />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
};

export default Scene;