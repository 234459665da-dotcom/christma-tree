import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { AppMode } from '../types';

const COUNT = 600;

// Reusable math helpers
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

const Ornaments: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const mode = useStore(state => state.mode);
  
  // Initialize positions for different states
  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      // Tree State (Cone/Spiral)
      const t = i / COUNT;
      const angle = t * Math.PI * 30; // Many winds
      const height = (t * 8) - 4; // -4 to 4
      const radius = (4 - height) * 0.4; // Cone shape
      
      const xTree = Math.cos(angle) * radius;
      const zTree = Math.sin(angle) * radius;
      const yTree = height;

      // Scatter State (Random Cloud)
      const xScat = (Math.random() - 0.5) * 15;
      const yScat = (Math.random() - 0.5) * 15;
      const zScat = (Math.random() - 0.5) * 10 - 2;

      // Type (0: Sphere, 1: Cube)
      const type = Math.random() > 0.7 ? 1 : 0; 
      
      // Color
      const color = type === 1 
        ? new THREE.Color('#8B0000') // Red
        : new THREE.Color('#FFD700'); // Gold

      // Add slight randomness to tree pos for natural look
      data.push({
        tree: new THREE.Vector3(xTree + (Math.random() - 0.5) * 0.2, yTree, zTree + (Math.random() - 0.5) * 0.2),
        scatter: new THREE.Vector3(xScat, yScat, zScat),
        color,
        type,
        scale: Math.random() * 0.15 + 0.05,
        speed: Math.random() * 0.5 + 0.5,
        currentPos: new THREE.Vector3(xTree, yTree, zTree) // Start at tree
      });
    }
    return data;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    particles.forEach((particle, i) => {
      let target: THREE.Vector3;

      if (mode === AppMode.TREE) {
        target = particle.tree;
      } else {
        // In scatter or focus, they float around their scatter position
        target = particle.scatter;
        
        // Add gentle floating motion
        target = target.clone().add(new THREE.Vector3(
          Math.sin(time * particle.speed + i) * 0.5,
          Math.cos(time * particle.speed * 0.8 + i) * 0.5,
          0
        ));
      }

      // Interpolate current position to target (Lerp)
      // Faster lerp for tree, slower/smoother for scatter
      const lerpFactor = mode === AppMode.TREE ? 0.05 : 0.02;
      particle.currentPos.lerp(target, lerpFactor);

      // Apply transform
      tempObject.position.copy(particle.currentPos);
      
      // Spin animation
      tempObject.rotation.x = time * particle.speed;
      tempObject.rotation.y = time * particle.speed * 0.5;
      
      tempObject.scale.setScalar(particle.scale);
      tempObject.updateMatrix();

      meshRef.current!.setMatrixAt(i, tempObject.matrix);
      meshRef.current!.setColorAt(i, particle.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial 
        roughness={0.2} 
        metalness={0.8}
        emissive="#332200"
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
};

export default Ornaments;