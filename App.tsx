
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { AppMode, Particle, GestureType } from './types';

// --- Constants ---
const PARTICLE_COUNT = 765; // Reduced 10%
const DUST_COUNT = 5400; // Reduced 10%
const LIGHT_PARTICLE_COUNT = 225; // Reduced 10%
const SMALL_STAR_COUNT = 162; // Reduced 10%
const TREE_HEIGHT = 55;
const TREE_BASE_RADIUS = 22;
const SCATTER_RADIUS = 75;
const LERP_SPEED = 0.035; 
const ZOOM_POS = new THREE.Vector3(0, 5, 55); 
const PREVIEW_POS = new THREE.Vector3(0, 5, 50); 

// --- PALETTE ---
const COLOR_MATTE_GREEN = 0x1a4a2a;    
const COLOR_RICH_GOLD = 0xffbf00;      
const COLOR_DEEP_RED = 0xc2002b;       
const COLOR_BG = 0x010201;             
const COLOR_BEAR = 0x7a4a1b;

const FAIRY_LIGHT_COLORS = [0xffd700, 0xffaa00, 0xfff0b3, 0xffcc00];

// Math Cache
const _tempV1 = new THREE.Vector3();
const _tempQ1 = new THREE.Quaternion();

// --- Helpers ---
const createSnowflakeTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); 
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)'); 
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

// IMPROVED: Fully 3D Faceted Star Geometry (Convex)
const createStarGeometry = (radius = 1, thickness = 0.5) => {
  const innerRadius = radius * 0.45;
  const vertices = [
    0, 0, thickness,  // 0: Center Front (Apex)
    0, 0, -thickness, // 1: Center Back (Apex)
  ];

  const numPoints = 10; // 5 outer + 5 inner
  for (let i = 0; i < numPoints; i++) {
    const r = i % 2 === 0 ? radius : innerRadius;
    const a = (i / numPoints) * Math.PI * 2 + Math.PI / 2;
    vertices.push(Math.cos(a) * r, Math.sin(a) * r, 0);
  }

  const indices = [];
  const ringStart = 2; // Vertices 0 and 1 are centers

  for (let i = 0; i < numPoints; i++) {
    const current = ringStart + i;
    const next = ringStart + ((i + 1) % numPoints);

    // Front Face (Counter-Clockwise)
    indices.push(0, current, next);
    
    // Back Face (Clockwise relative to front, so normals point out)
    indices.push(1, next, current);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  
  return geom;
};

const createWreath = () => {
  const g = new THREE.Group();
  const greenMat = new THREE.MeshStandardMaterial({ color: COLOR_MATTE_GREEN, roughness: 0.8 });
  const berryMat = new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff0000, emissiveIntensity: 1.5, roughness: 0.2 });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 12, 24), greenMat);
  g.add(torus);
  for(let i=0; i<8; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), berryMat);
    const a = (i / 8) * Math.PI * 2;
    b.position.set(Math.cos(a)*0.5, Math.sin(a)*0.5, 0.1);
    g.add(b);
  }
  g.scale.setScalar(1.5);
  return g;
};

const createTeddyBear = () => {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: COLOR_BEAR, roughness: 1.0 });
  const mMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), furMat);
  body.scale.y = 1.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furMat);
  head.position.y = 0.6;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mMat);
  muzzle.position.set(0, 0.55, 0.28);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), furMat); earL.position.set(0.2, 0.85, 0.1);
  const earR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), furMat); earR.position.set(-0.2, 0.85, 0.1);
  g.add(body, head, muzzle, earL, earR);
  g.scale.setScalar(1.5);
  return g;
};

const createSantaHat = () => {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: COLOR_DEEP_RED, roughness: 0.6, emissive: 0x440000, emissiveIntensity: 0.4 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 20), whiteMat);
  brim.rotation.x = Math.PI / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.35, 16), redMat);
  base.position.y = 0.18;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 16), redMat);
  top.position.set(-0.1, 0.5, 0); top.rotation.z = -0.5;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), whiteMat);
  pom.position.set(-0.4, 0.8, 0);
  g.add(brim, base, top, pom);
  g.scale.setScalar(1.7);
  return g;
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.LOADING);
  const [loadingProgress, setLoadingProgress] = useState(0); 
  const [loadingText, setLoadingText] = useState("INITIALIZING ASSETS");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rotationSpeedRef = useRef(0.002); 
  const gestureRef = useRef<GestureType>('NONE');
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const atmosphereRef = useRef<THREE.Points | null>(null);
  const snowDataRef = useRef<{ velocities: Float32Array; sways: Float32Array }>({
    velocities: new Float32Array(DUST_COUNT), sways: new Float32Array(DUST_COUNT)
  });
  
  const zoomedPhotoRef = useRef<Particle | null>(null);
  const previewingPhotoRef = useRef<Particle | null>(null); 
  const mountRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<AppMode>(AppMode.LOADING);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const isCountingDownRef = useRef(false);
  const lShapeHoldTimeRef = useRef(0);
  const pinchHoldTimeRef = useRef(0);

  const takePhoto = () => {
     if (!videoRef.current || !mainGroupRef.current) return;
     setFlash(true); setTimeout(() => setFlash(false), 200);

     // Polaroid Specs
     const canvasWidth = 512;
     const canvasHeight = 630; // Approx 1:1.23 ratio (Classic Polaroid is ~8.8x10.7)
     const cvs = document.createElement('canvas'); 
     cvs.width = canvasWidth; 
     cvs.height = canvasHeight;
     const ctx = cvs.getContext('2d'); if (!ctx) return;
     
     // 1. Background (Paper) - Warm white
     ctx.fillStyle = '#fdfbf7'; 
     ctx.fillRect(0,0, canvasWidth, canvasHeight);
     
     // 2. Draw Image
     const vid = videoRef.current;
     const minDim = Math.min(vid.videoWidth, vid.videoHeight);
     const sx = (vid.videoWidth - minDim) / 2; const sy = (vid.videoHeight - minDim) / 2;
     
     const margin = 24;
     const imgSize = canvasWidth - (margin * 2); // 464x464

     // Apply slight "Instant Film" look
     ctx.filter = 'contrast(1.1) saturate(1.2) brightness(1.1)';
     ctx.drawImage(vid, sx, sy, minDim, minDim, margin, margin, imgSize, imgSize); 
     ctx.filter = 'none';

     // 3. Text in the "Chin"
     ctx.font = '28px Cinzel'; 
     ctx.fillStyle = '#222';
     ctx.textAlign = 'center';
     const now = new Date();
     const label = `NOEL • ${now.toLocaleDateString()}`;
     // Centered horizontally, positioned in the bottom whitespace
     ctx.fillText(label, canvasWidth / 2, margin + imgSize + 85);

     const tex = new THREE.CanvasTexture(cvs);
     tex.colorSpace = THREE.SRGBColorSpace; 
     
     const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0 });
     
     // CRITICAL: Black base color prevents yellow tint from scene lights. 
     // Emissive map handles the visual. 
     // Increased intensity slightly (0.45 -> 0.6) for visibility.
     const frontMat = new THREE.MeshStandardMaterial({ 
         color: 0x000000, 
         roughness: 0.8, 
         metalness: 0.0, 
         emissive: 0xffffff, 
         emissiveMap: tex,   
         emissiveIntensity: 0.6
     });
     
     // UPDATED: Use frontMat for both Front (4) and Back (5) faces to have image on both sides
     const mats = [paperMat, paperMat, paperMat, paperMat, frontMat, frontMat];

     // Adjust Geometry to match Polaroid aspect ratio (Width 6, Height 7.4)
     const mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 7.4, 0.12), mats);
     
     const h = Math.random() * TREE_HEIGHT - TREE_HEIGHT/2;
     
     // UPDATED: Reduce offset (+2.0 instead of +5) so photos sit tighter in the tree (fuse in).
     const r = (1 - (h + TREE_HEIGHT/2)/TREE_HEIGHT) * TREE_BASE_RADIUS + 2.0; 
     
     const angle = Math.random() * 6.28;
     const treePos = new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r);

     // UPDATED: Correct orientation logic.
     // 1. Position mesh at treePos to calculate lookAt correctly.
     mesh.position.copy(treePos);
     // 2. Look at the central axis (0, h, 0). By default this makes the front face (+Z) point INWARDS.
     mesh.lookAt(0, h, 0);
     // 3. Rotate 180 deg (PI) around Y so the front face points OUTWARDS (towards viewer).
     mesh.rotateY(Math.PI);
     // 4. Add slight random tilt for natural hanging effect.
     mesh.rotateZ((Math.random() - 0.5) * 0.25);
     mesh.rotateX((Math.random() - 0.5) * 0.15);

     mainGroupRef.current.add(mesh);
     const newP: Particle = {
         mesh, type: 'PHOTO', treePos,
         scatterPos: new THREE.Vector3((Math.random()-0.5)*140, (Math.random()-0.5)*140, (Math.random()-0.5)*140),
         velocity: new THREE.Vector3(), rotationSpeed: new THREE.Vector3(), isPhoto: true
     };
     particlesRef.current.push(newP);
     setCountdown(null); isCountingDownRef.current = false;
     
     previewingPhotoRef.current = newP;
     setTimeout(() => { 
         previewingPhotoRef.current = null; 
         // Auto return to tree mode after 3 seconds
         modeRef.current = AppMode.TREE;
         setAppMode(AppMode.TREE);
     }, 3000);
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR_BG); 
    scene.fog = new THREE.FogExp2(COLOR_BG, 0.007); 

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 80);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Softer bloom to avoid over-exposing the star
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.8, 0.8);
    composer.addPass(bloom);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const p1 = new THREE.PointLight(0xffd700, 1500, 500); p1.position.set(60, 80, 60); scene.add(p1);
    const p2 = new THREE.PointLight(0xffaa00, 800, 400); p2.position.set(-60, -40, 50); scene.add(p2);

    const goldMat = new THREE.MeshStandardMaterial({ 
      color: COLOR_RICH_GOLD, emissive: COLOR_RICH_GOLD, emissiveIntensity: 0.6, // Increased brightness
      metalness: 1.0, roughness: 0.05 
    });
    const redMat = new THREE.MeshPhysicalMaterial({ 
      color: COLOR_DEEP_RED, emissive: 0x550000, emissiveIntensity: 0.25, 
      metalness: 0.4, roughness: 0.1, clearcoat: 1.0 
    });

    const mainGroup = new THREE.Group(); scene.add(mainGroup); mainGroupRef.current = mainGroup;

    // Topper Star - Uses new Faceted Geometry
    // Increased thickness to 1.5 to make it properly "convex" and 3D
    const topper = new THREE.Mesh(createStarGeometry(5, 1.5), new THREE.MeshStandardMaterial({
      color: 0xfff0b3, emissive: 0xffd700, emissiveIntensity: 0.6, 
      metalness: 1.0, roughness: 0.05
    }));
    topper.position.set(0, TREE_HEIGHT/2 + 5, 0); mainGroup.add(topper);
    particlesRef.current.push({ mesh: topper, type: 'STAR_ORNAMENT', treePos: topper.position.clone(), scatterPos: new THREE.Vector3(0, 75, 0), velocity: new THREE.Vector3(), rotationSpeed: new THREE.Vector3(0, 0.08, 0) });

    // Fairy Lights
    for (let i = 0; i < LIGHT_PARTICLE_COUNT; i++) {
        const c = FAIRY_LIGHT_COLORS[Math.floor(Math.random() * FAIRY_LIGHT_COLORS.length)];
        const lightMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8), 
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 12.0 }) // Increased base brightness
        );
        const hN = Math.pow(Math.random(), 0.95); const y = (hN * TREE_HEIGHT) - (TREE_HEIGHT / 2);
        const mR = TREE_BASE_RADIUS * (1.0 - (y + TREE_HEIGHT/2) / TREE_HEIGHT);
        const tP = new THREE.Vector3(Math.cos(Math.random()*6.28)*mR*(0.2+0.8*Math.sqrt(Math.random())), y, Math.sin(Math.random()*6.28)*mR*(0.2+0.8*Math.sqrt(Math.random())));
        const sP = new THREE.Vector3((Math.random()-0.5)*170, (Math.random()-0.5)*170, (Math.random()-0.5)*170);
        lightMesh.position.copy(sP); mainGroup.add(lightMesh);
        lightMesh.userData.phase = Math.random() * Math.PI * 2;
        lightMesh.userData.speed = 1.2 + Math.random() * 2.0;
        particlesRef.current.push({ mesh: lightMesh, type: 'LIGHT', treePos: tP, scatterPos: sP, velocity: new THREE.Vector3(), rotationSpeed: new THREE.Vector3() });
    }

    // Small Golden Stars inside
    // Thickness 0.2 gives them a nice little gem shape
    const starGeom = createStarGeometry(0.5, 0.2);
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.9 }); // Increased brightness
    for (let i = 0; i < SMALL_STAR_COUNT; i++) {
        const smStar = new THREE.Mesh(starGeom, starMat.clone());
        const hN = Math.pow(Math.random(), 0.9); const y = (hN * TREE_HEIGHT) - (TREE_HEIGHT / 2);
        const mR = TREE_BASE_RADIUS * (1.0 - (y + TREE_HEIGHT/2) / TREE_HEIGHT);
        const tP = new THREE.Vector3(Math.cos(Math.random()*6.28)*mR*(0.1+0.9*Math.sqrt(Math.random())), y, Math.sin(Math.random()*6.28)*mR*(0.1+0.9*Math.sqrt(Math.random())));
        const sP = new THREE.Vector3((Math.random()-0.5)*160, (Math.random()-0.5)*160, (Math.random()-0.5)*160);
        smStar.position.copy(sP);
        smStar.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
        mainGroup.add(smStar);
        particlesRef.current.push({ mesh: smStar, type: 'ORNAMENT', treePos: tP, scatterPos: sP, velocity: new THREE.Vector3(), rotationSpeed: new THREE.Vector3(Math.random()*0.02, Math.random()*0.02, Math.random()*0.02) });
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let m: THREE.Object3D; let pt: Particle['type']; const r = Math.random();
      if (r < 0.12) { m = createWreath(); pt = 'ORNAMENT'; }
      else if (r < 0.25) { m = createSantaHat(); pt = 'ORNAMENT'; }
      else if (r < 0.35) { m = createTeddyBear(); pt = 'ORNAMENT'; }
      else { 
        m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), r > 0.88 ? redMat : goldMat);
        pt = 'ORNAMENT'; 
      }
      const hN = Math.pow(Math.random(), 0.9); const y = (hN * TREE_HEIGHT) - (TREE_HEIGHT / 2);
      const mR = TREE_BASE_RADIUS * (1.0 - (y + TREE_HEIGHT/2) / TREE_HEIGHT);
      const tP = new THREE.Vector3(Math.cos(Math.random()*6.28)*mR*(0.2+0.8*Math.sqrt(Math.random())), y, Math.sin(Math.random()*6.28)*mR*(0.2+0.8*Math.sqrt(Math.random())));
      const ph=Math.acos(2*Math.random()-1), th=2*3.14*Math.random(), rS=SCATTER_RADIUS*(0.8+0.7*Math.random());
      const sP = new THREE.Vector3(rS*Math.sin(ph)*Math.cos(th), rS*Math.sin(ph)*Math.sin(th), rS*Math.cos(ph));
      m.position.copy(sP); mainGroup.add(m);
      particlesRef.current.push({ mesh: m, type: pt, treePos: tP, scatterPos: sP, velocity: new THREE.Vector3(), rotationSpeed: new THREE.Vector3((Math.random()-0.5)*0.03, (Math.random()-0.5)*0.05, (Math.random()-0.5)*0.03) });
    }

    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(DUST_COUNT * 3);
    const vels = new Float32Array(DUST_COUNT);
    const sws = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) { 
        snowPos[i*3] = (Math.random()-0.5)*250; snowPos[i*3+1] = (Math.random()-0.5)*200; snowPos[i*3+2] = (Math.random()-0.5)*250; 
        vels[i] = 0.1 + Math.random() * 0.15; sws[i] = Math.random() * 6.28;
    }
    snowDataRef.current = { velocities: vels, sways: sws };
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, map: createSnowflakeTexture(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(snow); atmosphereRef.current = snow;

    const clock = new THREE.Clock();

    const animate = () => {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        mainGroup.rotation.y += rotationSpeedRef.current;
        const mode = modeRef.current;

        particlesRef.current.forEach(p => {
            if (p.type === 'LIGHT') {
                const mat = (p.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
                const twinkle = Math.sin(time * p.mesh.userData.speed + p.mesh.userData.phase);
                mat.emissiveIntensity = 9.0 + twinkle * 9.0; // Increased dynamic brightness
                const s = 1.0 + twinkle * 0.12;
                p.mesh.scale.set(s, s, s);
            }

            if (previewingPhotoRef.current === p || zoomedPhotoRef.current === p) {
                const tW = previewingPhotoRef.current === p ? PREVIEW_POS : ZOOM_POS;
                _tempV1.copy(tW); p.mesh.parent?.worldToLocal(_tempV1);
                p.mesh.position.lerp(_tempV1, 0.15);
                _tempQ1.copy(mainGroup.quaternion).invert();
                p.mesh.quaternion.slerp(_tempQ1.multiply(camera.quaternion), 0.15);
                
                const sf = 3.0; 
                p.mesh.scale.lerp(new THREE.Vector3(sf, sf, sf), 0.12);
                return;
            }

            if (p.isPhoto) {
                p.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
            }

            let target = (mode === AppMode.TREE) ? p.treePos : p.scatterPos;
            p.mesh.position.lerp(target, LERP_SPEED);
            p.mesh.rotation.x += p.rotationSpeed.x; p.mesh.rotation.y += p.rotationSpeed.y; p.mesh.rotation.z += p.rotationSpeed.z;
        });

        if (atmosphereRef.current) {
            const pos = atmosphereRef.current.geometry.attributes.position.array as Float32Array;
            const { velocities, sways } = snowDataRef.current;
            for (let i = 0; i < DUST_COUNT; i++) {
                pos[i*3+1] -= velocities[i]; sways[i] += 0.012; pos[i*3] += Math.sin(sways[i]) * 0.04;
                if (pos[i*3+1] < -120) pos[i*3+1] = 120;
            }
            atmosphereRef.current.geometry.attributes.position.needsUpdate = true;
        }
        composer.render();
    };
    animate();

    const initVision = async () => {
        // Failsafe: If initialization takes longer than 8 seconds, force into Tree mode.
        // This handles cases where camera permission is ignored or network hangs.
        const timeoutId = setTimeout(() => {
             console.warn("Vision initialization timed out. Defaulting to standard mode.");
             setAppMode(AppMode.TREE); 
             modeRef.current = AppMode.TREE;
        }, 8000);

        try {
            setLoadingText("LOADING AI ENGINE...");
            setLoadingProgress(25);
            // FIX: Update WASM version to match standard stable releases (0.10.14) to avoid potential mismatches with import map
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
            
            setLoadingText("LOADING HAND TRACKING...");
            setLoadingProgress(50);
            const landmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" }, runningMode: "VIDEO", numHands: 1 });
            
            setLoadingText("REQUESTING CAMERA...");
            setLoadingProgress(75);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    clearTimeout(timeoutId); // Initialization successful, cancel failsafe
                    videoRef.current?.play(); 
                    setLoadingProgress(100);
                    setAppMode(AppMode.SCATTER); modeRef.current = AppMode.SCATTER;
                    const predict = () => {
                        if (landmarker && videoRef.current) {
                            const res = landmarker.detectForVideo(videoRef.current, performance.now());
                            if (res.landmarks?.[0]) {
                                const l = res.landmarks[0];
                                const wrist = l[0], tTip = l[4], iTip = l[8], mTip = l[12], rTip = l[16], pTip = l[20];
                                const isEx = (t: NormalizedLandmark, mIdx: number) => Math.hypot(t.x-wrist.x, t.y-wrist.y) > Math.hypot(l[mIdx].x-wrist.x, l[mIdx].y-wrist.y)*1.2;
                                const iE = isEx(iTip,5), mE = isEx(mTip,9), rE = isEx(rTip,13), pE = isEx(pTip,17);
                                const tE = Math.hypot(tTip.x - l[5].x, tTip.y - l[5].y) > 0.05;
                                
                                const pinchDist = Math.hypot(tTip.x-iTip.x, tTip.y-iTip.y);
                                const isPinch = pinchDist < 0.04; // Reduced from 0.08 to prevent false positives

                                let gest: GestureType = 'NONE';
                                if (isPinch) gest = 'PINCH';
                                else if (!iE && !mE && !rE && !pE) gest = 'FIST';
                                else if (iE && mE && rE && pE) gest = 'OPEN_PALM';
                                else if (tE && iE && !mE) gest = 'L_SHAPE';
                                
                                gestureRef.current = gest;
                                rotationSpeedRef.current = (0.5 - wrist.x) * 0.035;
                                
                                if (gest === 'OPEN_PALM') { 
                                    pinchHoldTimeRef.current = 0;
                                    modeRef.current = AppMode.SCATTER; setAppMode(AppMode.SCATTER); zoomedPhotoRef.current = null; 
                                } 
                                else if (gest === 'FIST') { 
                                    pinchHoldTimeRef.current = 0;
                                    modeRef.current = AppMode.TREE; setAppMode(AppMode.TREE); zoomedPhotoRef.current = null; 
                                }
                                else if (gest === 'PINCH') {
                                    if (++pinchHoldTimeRef.current > 12) { // Require ~10-12 frames hold to trigger
                                        if (!zoomedPhotoRef.current) {
                                            const phs = particlesRef.current.filter(p => p.isPhoto);
                                            if (phs.length > 0) zoomedPhotoRef.current = phs[Math.floor(Math.random()*phs.length)];
                                        }
                                    }
                                } else if (gest === 'L_SHAPE' && !isCountingDownRef.current) {
                                    pinchHoldTimeRef.current = 0;
                                    if (++lShapeHoldTimeRef.current > 25) { isCountingDownRef.current = true; setCountdown(3); }
                                } else { 
                                    lShapeHoldTimeRef.current = 0; 
                                    pinchHoldTimeRef.current = 0;
                                }
                            }
                        }
                        requestAnimationFrame(predict);
                    };
                    predict();
                };
            }
        } catch (e) { 
            console.warn("Vision init failed, falling back to tree mode:", e);
            clearTimeout(timeoutId);
            setAppMode(AppMode.TREE); 
            modeRef.current = AppMode.TREE; 
        }
    };
    initVision();

    const onResize = () => {
        if (!cameraRef.current) return;
        cameraRef.current.aspect = window.innerWidth / window.innerHeight; cameraRef.current.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
        window.removeEventListener('resize', onResize);
        videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (countdown === 0) takePhoto();
    else if (countdown !== null && countdown > 0) setTimeout(() => setCountdown(countdown - 1), 1000);
  }, [countdown]);

  const showCam = countdown !== null || gestureRef.current === 'L_SHAPE';

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-cinzel text-white">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 z-50 ${flash ? 'opacity-100' : 'opacity-0'}`} />

      {appMode === AppMode.LOADING && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black transition-opacity duration-1000">
           <h1 className="text-3xl md:text-5xl text-yellow-400 tracking-[0.4em] mb-4 text-center drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] uppercase">FROSTING THE NOEL...</h1>
           <div className="w-64 h-1 bg-gray-900 rounded overflow-hidden shadow-inner mb-2">
              <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 transition-all duration-300" style={{ width: `${loadingProgress}%`}}/>
           </div>
           <div className="text-yellow-500 text-xs tracking-widest opacity-70 font-sans">{loadingText}</div>
        </div>
      )}

      {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="text-9xl text-yellow-100 font-bold animate-ping drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{countdown}</div>
          </div>
      )}

      <video ref={videoRef} 
        className={showCam 
          ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-auto max-w-[500px] max-h-[500px] object-cover rounded-xl border-4 border-yellow-500 z-40 opacity-100 shadow-[0_0_60px_rgba(255,215,0,0.4)] transition-all duration-500"
          : "absolute opacity-0 pointer-events-none"
        }
        playsInline muted autoPlay style={{ transform: showCam ? 'translate(-50%, -50%) scaleX(-1)' : 'scaleX(-1)' }} 
      />
      
      <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-10 z-30 pointer-events-none text-center text-sm md:text-base font-bold tracking-widest">
          <div className={appMode === AppMode.SCATTER ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(255,215,0,0.8)] scale-110 transition-transform' : 'opacity-20 drop-shadow-[0_0_4px_rgba(255,215,0,0.4)]'}>✋ SCATTER</div>
          <div className={appMode === AppMode.TREE ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(255,215,0,0.8)] scale-110 transition-transform' : 'opacity-20 drop-shadow-[0_0_4px_rgba(255,215,0,0.4)]'}>✊ GATHER</div>
          <div className={countdown !== null ? 'text-yellow-200 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'opacity-20 drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]'}>👆 CAPTURE</div>
          <div className={gestureRef.current === 'PINCH' ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(255,215,0,0.8)] scale-110 transition-transform' : 'opacity-20 drop-shadow-[0_0_4px_rgba(255,215,0,0.4)]'}>👌 RECALL</div>
      </div>
    </div>
  );
};

export default App;
