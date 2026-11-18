import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RoleType = 'patient' | 'doctor' | 'caregiver' | 'pharmacy' | 'lab';

interface ThreeRoleCanvasProps {
  role: RoleType;
  className?: string;
  size?: number;
  interactive?: boolean;
}

export const ThreeRoleCanvas: React.FC<ThreeRoleCanvasProps> = ({
  role,
  className = '',
  size = 180,
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = size;
    const height = size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0xffffff, 3.5, 30);
    keyLight.position.set(6, 8, 10);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x0e7c86, 3, 20);
    rimLight.position.set(-6, -6, -4);
    scene.add(rimLight);

    // Construct 3D object based on role
    const animatedItems: {
      rotateY?: THREE.Object3D[];
      pulseScale?: THREE.Object3D[];
      orbitItems?: THREE.Object3D[];
      floatingItems?: THREE.Object3D[];
    } = { rotateY: [], pulseScale: [], orbitItems: [], floatingItems: [] };

    if (role === 'doctor') {
      // 🩺 DOCTOR: Holographic Stethoscope + Caduceus Cross with Cyan/Blue glow
      const docGroup = new THREE.Group();
      mainGroup.add(docGroup);

      // Central Medical Cross
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0x1769AA,
        emissive: 0x0A4674,
        roughness: 0.2,
        metalness: 0.8,
      });
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.5), crossMat);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.5), crossMat);
      const crossMesh = new THREE.Group();
      crossMesh.add(vBar);
      crossMesh.add(hBar);
      docGroup.add(crossMesh);

      // Stethoscope Disc / Chestpiece
      const discGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 32);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0x0E7C86,
        roughness: 0.1,
        metalness: 0.9,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.z = -0.4;
      docGroup.add(disc);

      // Glowing Pulse Ring around chestpiece
      const ringGeo = new THREE.TorusGeometry(2.3, 0.08, 16, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.75 });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      docGroup.add(pulseRing);

      // Stethoscope binaural curved tube
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.8, 1.8, 0.4),
        new THREE.Vector3(-1.4, 0.5, 0.6),
        new THREE.Vector3(0, -1.8, 0.8),
        new THREE.Vector3(1.4, 0.5, 0.6),
        new THREE.Vector3(1.8, 1.8, 0.4),
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.12, 12, false);
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x22D3EE, metalness: 0.8, roughness: 0.2 });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      docGroup.add(tubeMesh);

      // Orbiting Vital Beads
      const orbitRing = new THREE.TorusGeometry(3.1, 0.04, 16, 64);
      const orbitMat = new THREE.MeshBasicMaterial({ color: 0x0EA5E9, transparent: true, opacity: 0.4 });
      const orbit = new THREE.Mesh(orbitRing, orbitMat);
      orbit.rotation.x = Math.PI / 3;
      docGroup.add(orbit);

      animatedItems.rotateY?.push(crossMesh);
      animatedItems.pulseScale?.push(pulseRing);
      animatedItems.orbitItems?.push(orbit);

    } else if (role === 'pharmacy') {
      // 💊 PHARMACIST: 3D Holographic Medicine Capsule & Generic Pill Dispenser with Emerald/Teal Rings
      const pharmGroup = new THREE.Group();
      mainGroup.add(pharmGroup);

      // Dual-tone Medicine Capsule (Top half emerald, bottom half white/silver)
      const capRadius = 1.1;
      const capHeight = 1.4;

      const topMat = new THREE.MeshStandardMaterial({
        color: 0x10B981,
        emissive: 0x065F46,
        roughness: 0.15,
        metalness: 0.7,
      });
      const botMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        emissive: 0x10B981,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.5,
      });

      const topCyl = new THREE.Mesh(new THREE.CylinderGeometry(capRadius, capRadius, capHeight / 2, 32), topMat);
      topCyl.position.y = capHeight / 4;
      const topCap = new THREE.Mesh(new THREE.SphereGeometry(capRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
      topCap.position.y = capHeight / 2;

      const botCyl = new THREE.Mesh(new THREE.CylinderGeometry(capRadius, capRadius, capHeight / 2, 32), botMat);
      botCyl.position.y = -capHeight / 4;
      const botCap = new THREE.Mesh(new THREE.SphereGeometry(capRadius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), botMat);
      botCap.position.y = -capHeight / 2;

      const capsule = new THREE.Group();
      capsule.add(topCyl);
      capsule.add(topCap);
      capsule.add(botCyl);
      capsule.add(botCap);
      capsule.rotation.z = Math.PI / 5;
      capsule.rotation.x = Math.PI / 8;
      pharmGroup.add(capsule);

      // Jan Aushadhi Generic Medicine Security Ring
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.08, 16, 64),
        new THREE.MeshStandardMaterial({ color: 0x34D399, metalness: 0.8, roughness: 0.2 })
      );
      ring1.rotation.x = Math.PI / 2.5;
      pharmGroup.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.06, 16, 64),
        new THREE.MeshBasicMaterial({ color: 0xA7F3D0, transparent: true, opacity: 0.6 })
      );
      ring2.rotation.y = Math.PI / 3;
      ring2.rotation.x = -Math.PI / 6;
      pharmGroup.add(ring2);

      // Molecular satellite nodes orbiting
      const moleculeGroup = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.9, roughness: 0.1 })
        );
        sphere.position.set(Math.cos(ang) * 2.5, Math.sin(ang) * 0.8, Math.sin(ang) * 2.5);
        moleculeGroup.add(sphere);
      }
      pharmGroup.add(moleculeGroup);

      animatedItems.rotateY?.push(capsule);
      animatedItems.orbitItems?.push(ring1, ring2, moleculeGroup);

    } else if (role === 'lab') {
      // 🔬 DIAGNOSTIC LAB: 3D Holographic Laboratory Flask & DNA Helix Analyzer with Purple/Violet glow
      const labGroup = new THREE.Group();
      mainGroup.add(labGroup);

      // Erlenmeyer Flask Body (Conical base + Cylindrical neck)
      const flaskMat = new THREE.MeshPhysicalMaterial({
        color: 0x8B5CF6,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        transmission: 0.7,
        thickness: 0.5,
        clearcoat: 1.0,
      });

      const flaskBase = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.5, 32, 1, true), flaskMat);
      flaskBase.rotation.x = Math.PI;
      flaskBase.position.y = -0.5;
      labGroup.add(flaskBase);

      const flaskNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.4, 32), flaskMat);
      flaskNeck.position.y = 1.4;
      labGroup.add(flaskNeck);

      const flaskRim = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 16, 32), flaskMat);
      flaskRim.position.y = 2.1;
      flaskRim.rotation.x = Math.PI / 2;
      labGroup.add(flaskRim);

      // Bioluminescent Liquid core
      const liquidMat = new THREE.MeshStandardMaterial({
        color: 0xA855F7,
        emissive: 0x7E22CE,
        roughness: 0.2,
        metalness: 0.5,
        transparent: true,
        opacity: 0.85,
      });
      const liquid = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 24), liquidMat);
      liquid.rotation.x = Math.PI;
      liquid.position.y = -0.8;
      labGroup.add(liquid);

      // Floating DNA Molecule Helix inside flask
      const dnaStrand = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const ang = t * Math.PI * 3;
        const y = (t - 0.5) * 2;
        const x = Math.cos(ang) * 0.45;
        const z = Math.sin(ang) * 0.45;

        const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xC084FC }));
        p1.position.set(x, y, z);
        dnaStrand.add(p1);

        const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38BDF8 }));
        p2.position.set(-x, y, -z);
        dnaStrand.add(p2);
      }
      dnaStrand.position.y = -0.2;
      labGroup.add(dnaStrand);

      // Laser Diagnostic Scan Ring
      const scanRing = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 1.8, 32),
        new THREE.MeshBasicMaterial({ color: 0xE879F9, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      scanRing.rotation.x = Math.PI / 2;
      scanRing.position.y = -0.5;
      labGroup.add(scanRing);

      animatedItems.rotateY?.push(dnaStrand);
      animatedItems.pulseScale?.push(scanRing);
      animatedItems.floatingItems?.push(scanRing);

    } else {
      // 🛡️ PATIENT: 3D Vitality Heart & HealthPass Biometric Shield Orb with Teal/Cyan Glow
      const patGroup = new THREE.Group();
      mainGroup.add(patGroup);

      // Central Hologram Heart/Orb
      const coreSphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.7, 2),
        new THREE.MeshStandardMaterial({
          color: 0x0E7C86,
          emissive: 0x0A5C63,
          roughness: 0.15,
          metalness: 0.85,
        })
      );
      patGroup.add(coreSphere);

      // Wireframe Shield Overlay
      const shieldWire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.3, 1),
        new THREE.MeshBasicMaterial({
          color: 0x22D3EE,
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        })
      );
      patGroup.add(shieldWire);

      // Biometric Pulse Orbit Ring
      const bioRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.08, 16, 64),
        new THREE.MeshStandardMaterial({ color: 0x14B8A6, metalness: 0.8, roughness: 0.2 })
      );
      bioRing.rotation.x = Math.PI / 3;
      patGroup.add(bioRing);

      const crossRing = new THREE.Mesh(
        new THREE.TorusGeometry(3.0, 0.05, 16, 64),
        new THREE.MeshBasicMaterial({ color: 0x67E8F9, transparent: true, opacity: 0.5 })
      );
      crossRing.rotation.y = Math.PI / 3;
      crossRing.rotation.x = -Math.PI / 4;
      patGroup.add(crossRing);

      // Orbiting Golden ABHA Pass Chip
      const chipMat = new THREE.MeshStandardMaterial({
        color: 0xF59E0B,
        metalness: 0.9,
        roughness: 0.1,
      });
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.08), chipMat);
      chip.position.set(2.8, 0.5, 0);
      patGroup.add(chip);

      animatedItems.rotateY?.push(coreSphere, shieldWire);
      animatedItems.pulseScale?.push(coreSphere);
      animatedItems.orbitItems?.push(bioRing, crossRing, chip);
    }

    // Interactive Mouse Tracking
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 1.5;
      targetY = y * 1.5;
    };

    if (interactive) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse tilt
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      mainGroup.rotation.y = elapsed * 0.5 + currentX;
      mainGroup.rotation.x = Math.sin(elapsed * 0.3) * 0.15 + currentY;

      // Pulse items (vital heartbeat)
      if (animatedItems.pulseScale) {
        const pulse = 1 + Math.sin(elapsed * 3) * 0.06;
        animatedItems.pulseScale.forEach((item) => item.scale.set(pulse, pulse, pulse));
      }

      // Floating items (scan laser)
      if (animatedItems.floatingItems) {
        animatedItems.floatingItems.forEach((item) => {
          item.position.y = Math.sin(elapsed * 2.2) * 1.0 - 0.4;
        });
      }

      // Rotate individual items
      if (animatedItems.rotateY) {
        animatedItems.rotateY.forEach((item) => {
          item.rotation.y = -elapsed * 0.6;
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (interactive) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [role, size, interactive]);

  return (
    <div
      ref={mountRef}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative inline-flex items-center justify-center pointer-events-auto ${className}`}
      aria-label={`3D interactive ${role} model`}
    />
  );
};
