import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeCanvasHero: React.FC<{ className?: string }> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group for entire 3D medical visual
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Central Glowing Core Sphere (Icosahedron with wireframe + inner glowing sphere)
    const coreGeo = new THREE.IcosahedronGeometry(3.2, 2);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x0E7C86,
      emissive: 0x0B6770,
      specular: 0x22D3EE,
      shininess: 90,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(coreMesh);

    const innerGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x1769AA,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    mainGroup.add(innerMesh);

    // 2. DNA Double Helix strands rotating around the core
    const dnaGroup = new THREE.Group();
    mainGroup.add(dnaGroup);

    const pointsCount = 48;
    const radius = 5.2;
    const height = 12;
    const strand1Geo = new THREE.BufferGeometry();
    const strand2Geo = new THREE.BufferGeometry();
    const pos1 = [];
    const pos2 = [];

    const sphereMat1 = new THREE.MeshStandardMaterial({ color: 0x00E5FF, roughness: 0.1, metalness: 0.9 });
    const sphereMat2 = new THREE.MeshStandardMaterial({ color: 0x10B981, roughness: 0.1, metalness: 0.9 });
    const rungMat = new THREE.LineBasicMaterial({ color: 0x6EE7B7, transparent: true, opacity: 0.4 });

    for (let i = 0; i < pointsCount; i++) {
      const t = i / pointsCount;
      const angle = t * Math.PI * 4;
      const y = (t - 0.5) * height;
      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      pos1.push(x1, y, z1);
      pos2.push(x2, y, z2);

      // Node sphere 1
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), sphereMat1);
      s1.position.set(x1, y, z1);
      dnaGroup.add(s1);

      // Node sphere 2
      const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), sphereMat2);
      s2.position.set(x2, y, z2);
      dnaGroup.add(s2);

      // Rungs connecting strands
      if (i % 2 === 0) {
        const rungPoints = [new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2)];
        const rungGeo = new THREE.BufferGeometry().setFromPoints(rungPoints);
        const rungLine = new THREE.Line(rungGeo, rungMat);
        dnaGroup.add(rungLine);
      }
    }

    // 3. Floating 3D Holographic Rings (Cybernetic Shield Rings)
    const ringGeo1 = new THREE.TorusGeometry(6.4, 0.08, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00F0FF, transparent: true, opacity: 0.6 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    mainGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(7.2, 0.06, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x10B981, transparent: true, opacity: 0.5 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    ring2.rotation.x = -Math.PI / 6;
    mainGroup.add(ring2);

    // 4. Ambient Floating Molecular Particles Cloud
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 26;
      particlePositions[i + 1] = (Math.random() - 0.5) * 22;
      particlePositions[i + 2] = (Math.random() - 0.5) * 20;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.18,
      color: 0x22D3EE,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00f0ff, 3, 50);
    pointLight1.position.set(10, 10, 15);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x10b981, 2.5, 50);
    pointLight2.position.set(-10, -10, -10);
    scene.add(pointLight2);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 1.5;
      targetY = y * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      mainGroup.rotation.y = elapsedTime * 0.35 + mouseX * 1.2;
      mainGroup.rotation.x = Math.sin(elapsedTime * 0.25) * 0.15 + mouseY * 1.2;

      coreMesh.rotation.y = -elapsedTime * 0.4;
      coreMesh.rotation.z = Math.sin(elapsedTime * 0.5) * 0.2;

      ring1.rotation.z = elapsedTime * 0.25;
      ring2.rotation.z = -elapsedTime * 0.3;

      dnaGroup.rotation.y = elapsedTime * 0.5;

      // Particle subtle wave
      particles.rotation.y = elapsedTime * 0.05;
      particles.rotation.x = Math.sin(elapsedTime * 0.08) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-h-[380px] pointer-events-auto cursor-grab active:cursor-grabbing ${className}`}
      aria-label="Interactive 3D HealthPass Hologram"
    />
  );
};
