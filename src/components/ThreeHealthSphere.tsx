import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HealthSphereProps {
  categories?: string[];
  vitalScore?: number;
  className?: string;
}

export const ThreeHealthSphere: React.FC<HealthSphereProps> = ({
  categories = ['Cardiac', 'Metabolic', 'Respiratory', 'Allergies'],
  vitalScore = 98,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Glowing Hologram Core Sphere
    const sphereGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x0E7C86,
      emissive: 0x074D54,
      specular: 0x5EEAD4,
      shininess: 100,
      transparent: true,
      opacity: 0.8,
      wireframe: false,
    });
    const mainSphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(mainSphere);

    // Hologram grid lattice overlay
    const latticeGeo = new THREE.IcosahedronGeometry(2.6, 2);
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const latticeMesh = new THREE.Mesh(latticeGeo, latticeMat);
    group.add(latticeMesh);

    // Orbital Rings with Pulsing Node Beacons for each Health Category
    const categoryColors = [0xEF4444, 0x10B981, 0x3B82F6, 0xF59E0B, 0x8B5CF6];
    const nodesGroup = new THREE.Group();
    group.add(nodesGroup);

    categories.slice(0, 5).forEach((_, idx) => {
      const angle = (idx / Math.min(categories.length, 5)) * Math.PI * 2;
      const dist = 3.6;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle * 1.5) * 1.2;
      const z = Math.sin(angle) * dist;

      const nodeGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: categoryColors[idx % categoryColors.length],
        emissive: categoryColors[idx % categoryColors.length],
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(x, y, z);
      nodesGroup.add(node);

      // Connecting orbit line
      const orbitCurve = new THREE.EllipseCurve(0, 0, dist, dist, 0, Math.PI * 2, false, 0);
      const orbitPoints = orbitCurve.getPoints(50);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x0E7C86,
        transparent: true,
        opacity: 0.25,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLine.rotation.x = Math.PI / 2 + (idx * 0.2);
      nodesGroup.add(orbitLine);
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const light1 = new THREE.PointLight(0x22d3ee, 2.5, 30);
    light1.position.set(5, 5, 8);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x10b981, 2, 30);
    light2.position.set(-5, -5, -8);
    scene.add(light2);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      group.rotation.y = elapsed * 0.4;
      group.rotation.x = Math.sin(elapsed * 0.3) * 0.15;

      latticeMesh.rotation.y = -elapsed * 0.3;
      nodesGroup.rotation.y = elapsed * 0.6;

      // Pulse core scale with vitality heartbeat rhythm
      const pulse = 1 + Math.sin(elapsed * 2.8) * 0.04;
      mainSphere.scale.set(pulse, pulse, pulse);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 280;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [categories, vitalScore]);

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div ref={mountRef} className="w-[260px] h-[260px] pointer-events-none" />
      <div className="absolute bottom-2 text-center pointer-events-none">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0E7C86] bg-[#0E7C86]/10 px-2.5 py-0.5 rounded-full border border-[#0E7C86]/30">
          3D VITALITY ORB
        </span>
      </div>
    </div>
  );
};
