import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Building2, Compass, Layers, ShieldAlert, Sparkles, MapPin, Phone, ArrowRight, Bed, Clock, Award } from 'lucide-react';

interface WingDetail {
  id: string;
  name: string;
  type: string;
  floorCount: number;
  bedCapacity: string;
  dutySpecialist: string;
  status: string;
  color: number;
  hexColor: string;
  accent: string;
  description: string;
  targetMode: 'EMERGENCY' | 'DOCTOR' | 'LAB' | 'PHARMACY' | 'PATIENT';
}

const WINGS: WingDetail[] = [
  {
    id: 'trauma',
    name: 'Emergency & Trauma Resuscitation Wing',
    type: 'Level-1 Tertiary Trauma Care',
    floorCount: 4,
    bedCapacity: '48 ICU / Trauma Bays',
    dutySpecialist: 'Dr. Vikram Rao, MD (Emergency Medicine)',
    status: 'High Alert · Zero Wait Triage',
    color: 0xe11d48, // Crimson
    hexColor: '#E11D48',
    accent: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
    description: 'Rapid resuscitation, unconsented emergency triage, acute cardiac intervention, and post-stabilization identity linking.',
    targetMode: 'EMERGENCY',
  },
  {
    id: 'cardiology',
    name: 'Heart & Vascular Specialized Institute',
    type: 'Advanced Cardiac Pavilion',
    floorCount: 8,
    bedCapacity: '120 Dedicated Cardiac Beds',
    dutySpecialist: 'Dr. Priya Sharma, MBBS, MD, DM (Cardiology)',
    status: 'Cath Labs Active · 4 Surgeries Ongoing',
    color: 0x0e7c86, // Clinical Teal
    hexColor: '#0E7C86',
    accent: 'border-teal-500/50 bg-teal-500/10 text-teal-300',
    description: 'Coronary angioplasty, electrophysiology, echocardiography telemetry, and integrated e-prescription management.',
    targetMode: 'DOCTOR',
  },
  {
    id: 'diagnostics',
    name: 'NABL Diagnostic Pathology & Radiology Hub',
    type: 'Central Diagnostic Laboratory',
    floorCount: 5,
    bedCapacity: '3500 Samples/hr Throughput',
    dutySpecialist: 'Dr. Sunita Patil, MD Path (Lab Director)',
    status: 'Fully Automated Robotic Testing',
    color: 0x7c3aed, // Purple
    hexColor: '#7C3AED',
    accent: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
    description: 'NABL accredited automated pathology, PCR, molecular diagnostics, and cryptographic tamper-evident report uploads.',
    targetMode: 'LAB',
  },
  {
    id: 'pharmacy',
    name: 'Jan Aushadhi Generic Pharmacy Center',
    type: 'Subsidized Medical Dispensing',
    floorCount: 2,
    bedCapacity: '1800 Formulations Stocked',
    dutySpecialist: 'Rajesh Verma, B.Pharm (Pharmacist-in-Charge)',
    status: 'Zero Out-of-Stock Status',
    color: 0x16a34a, // Green
    hexColor: '#16A34A',
    accent: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    description: 'Instant prescription QR scanning, privacy-guaranteed view without clinical notes, and affordable generic substitutions.',
    targetMode: 'PHARMACY',
  },
  {
    id: 'patient_tower',
    name: 'Universal ABHA & Patient Record Vault',
    type: 'Digital Health Center',
    floorCount: 10,
    bedCapacity: '650 Multi-Specialty Inpatient Beds',
    dutySpecialist: 'Hospital Registrar & Medical Superintendant',
    status: 'FHIR R4 Secure Network Active',
    color: 0x0284c7, // Sky Blue
    hexColor: '#0284C7',
    accent: 'border-sky-500/50 bg-sky-500/10 text-sky-300',
    description: 'Citizen digital wallets, cryptographic consent delegation, offline emergency QR sync, and caregiver assisted management.',
    targetMode: 'PATIENT',
  },
];

interface Props {
  className?: string;
  onNavigateMode?: (mode: 'EMERGENCY' | 'DOCTOR' | 'LAB' | 'PHARMACY' | 'PATIENT') => void;
}

export const HospitalCampus3D: React.FC<Props> = ({ className = '', onNavigateMode }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedWing, setSelectedWing] = useState<WingDetail>(WINGS[0]);
  const [isRotating, setIsRotating] = useState<boolean>(true);

  const selectedWingRef = useRef(selectedWing);
  selectedWingRef.current = selectedWing;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071526, 0.015);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 16, 26);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Main Campus Group
    const campusGroup = new THREE.Group();
    scene.add(campusGroup);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0b192c, 1.4);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(15, 25, 15);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const blueAmbient = new THREE.PointLight(0x0e7c86, 2.5, 30);
    blueAmbient.position.set(0, 8, 0);
    scene.add(blueAmbient);

    // 1. Campus Foundation Grid
    const groundGeo = new THREE.CylinderGeometry(14, 14, 0.6, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      roughness: 0.6,
      metalness: 0.4,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -0.3;
    groundMesh.receiveShadow = true;
    campusGroup.add(groundMesh);

    // Glowing Concentric Grid Rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0e7c86, transparent: true, opacity: 0.35 });
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(6, 6.08, 64), ringMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.02;
    campusGroup.add(innerRing);

    const outerRing = new THREE.Mesh(new THREE.RingGeometry(11, 11.08, 64), ringMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.02;
    campusGroup.add(outerRing);

    // 2. Central Glass Atrium & Helipad Tower
    const atriumGeo = new THREE.CylinderGeometry(2.4, 2.8, 3.2, 32);
    const atriumMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transmission: 0.85,
      opacity: 0.8,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
    });
    const atrium = new THREE.Mesh(atriumGeo, atriumMat);
    atrium.position.set(0, 1.6, 0);
    campusGroup.add(atrium);

    // Helipad On Central Tower
    const helipadGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.2, 32);
    const helipadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const helipad = new THREE.Mesh(helipadGeo, helipadMat);
    helipad.position.set(0, 3.3, 0);
    campusGroup.add(helipad);

    // Helipad 'H' Marking & Red Beacon
    const beaconGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 3.6, 0);
    campusGroup.add(beacon);

    // 3. Architectural Pavilions (Wings) positioned in a circular campus layout
    const wingMeshes: { id: string; mesh: THREE.Group; baseMat: THREE.MeshStandardMaterial }[] = [];

    const wingConfigs = [
      { id: 'trauma', angle: (Math.PI * 2 * 0) / 5, width: 3.2, depth: 2.4, height: 3.8, color: 0xe11d48 },
      { id: 'cardiology', angle: (Math.PI * 2 * 1) / 5, width: 3.4, depth: 2.6, height: 6.2, color: 0x0e7c86 },
      { id: 'diagnostics', angle: (Math.PI * 2 * 2) / 5, width: 3.0, depth: 2.5, height: 4.8, color: 0x7c3aed },
      { id: 'pharmacy', angle: (Math.PI * 2 * 3) / 5, width: 2.8, depth: 2.2, height: 2.8, color: 0x16a34a },
      { id: 'patient_tower', angle: (Math.PI * 2 * 4) / 5, width: 3.6, depth: 2.8, height: 7.8, color: 0x0284c7 },
    ];

    const radius = 6.8;

    wingConfigs.forEach((cfg) => {
      const x = Math.cos(cfg.angle) * radius;
      const z = Math.sin(cfg.angle) * radius;

      const wingGroup = new THREE.Group();
      wingGroup.position.set(x, 0, z);
      wingGroup.rotation.y = -cfg.angle + Math.PI / 2;

      // Base Structure
      const buildingGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const buildingMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.3,
        metalness: 0.5,
      });
      const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
      buildingMesh.position.y = cfg.height / 2;
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      wingGroup.add(buildingMesh);

      // Glass Curtain Facade
      const windowGeo = new THREE.BoxGeometry(cfg.width * 0.95, cfg.height * 0.85, cfg.depth * 0.1);
      const windowMat = new THREE.MeshPhysicalMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 0.35,
        roughness: 0.1,
        metalness: 0.8,
        clearcoat: 1.0,
      });
      const windowsFront = new THREE.Mesh(windowGeo, windowMat);
      windowsFront.position.set(0, cfg.height / 2, cfg.depth / 2 + 0.04);
      wingGroup.add(windowsFront);

      // Glowing Rooftop Status Strip
      const roofStripGeo = new THREE.BoxGeometry(cfg.width * 1.02, 0.25, cfg.depth * 1.02);
      const roofStripMat = new THREE.MeshBasicMaterial({ color: cfg.color });
      const roofStrip = new THREE.Mesh(roofStripGeo, roofStripMat);
      roofStrip.position.set(0, cfg.height + 0.12, 0);
      wingGroup.add(roofStrip);

      // Connecting Skybridge to Central Atrium
      const bridgeLength = radius - cfg.depth / 2 - 2.4;
      const bridgeGeo = new THREE.BoxGeometry(1.0, 0.6, bridgeLength);
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(0, 2.0, -bridgeLength / 2 - cfg.depth / 2);
      wingGroup.add(bridge);

      campusGroup.add(wingGroup);
      wingMeshes.push({ id: cfg.id, mesh: wingGroup, baseMat: buildingMat });
    });

    // Ambulance Emergency Bay Lights (blinking near Trauma wing)
    const ambuLight = new THREE.PointLight(0xff0044, 2, 8);
    ambuLight.position.set(radius, 0.8, 0);
    campusGroup.add(ambuLight);

    // Interactive Drag / Orbit
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        targetRotY += deltaX * 0.007;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseUp = () => { isDragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Continuous gentle rotation if not dragging
      if (!isDragging && isRotating) {
        targetRotY += delta * 0.15;
      }
      campusGroup.rotation.y += (targetRotY - campusGroup.rotation.y) * 0.08;

      // Pulse beacon and emergency ambulance strobe
      beaconMat.color.setHex(Math.sin(time * 6) > 0 ? 0xff0033 : 0x550011);
      ambuLight.intensity = Math.sin(time * 8) > 0 ? 3.5 : 0.5;

      // Highlight the selected wing
      const curId = selectedWingRef.current.id;
      wingMeshes.forEach((item) => {
        if (item.id === curId) {
          item.mesh.position.y = Math.sin(time * 3) * 0.12 + 0.15;
        } else {
          item.mesh.position.y = 0;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRotating]);

  return (
    <div className={`relative rounded-3xl bg-gradient-to-br from-[#06121E] via-[#091D34] to-[#0A1B2E] border-2 border-teal-500/30 shadow-2xl overflow-hidden ${className}`}>
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-teal-500/20 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300">
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-teal-300 uppercase">
                3D Hospital Campus & Surgical Wings
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-[10px] font-bold text-teal-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NABH Level-3 Tertiary Facility
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Interactive digital twin of multi-specialty care towers, trauma resuscitation bays, and robotic diagnostics
            </p>
          </div>
        </div>

        {/* Rotation toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className="px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-[11px] font-bold text-slate-300 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Compass className={`w-3.5 h-3.5 text-teal-400 ${isRotating ? 'animate-spin' : ''}`} />
            <span>{isRotating ? 'Auto Orbit ON' : 'Auto Orbit PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas with Interactive Overlay */}
      <div className="relative w-full h-[360px] sm:h-[420px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Department Wing Quick Select Bar (Left Floating) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-slate-700/80 shadow-xl max-w-[220px]">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
            Hospital Care Wings
          </span>
          {WINGS.map((w) => {
            const isSelected = selectedWing.id === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWing(w)}
                className={`p-2 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2 border ${
                  isSelected
                    ? `${w.accent} shadow-md font-bold scale-[1.02]`
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: w.hexColor }}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate leading-tight">{w.name}</div>
                  <div className="text-[9px] text-slate-400 truncate">{w.type}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Department Live Status Card (Floating Right) */}
        <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700/80 text-white w-64 sm:w-72 shadow-2xl space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ backgroundColor: `${selectedWing.hexColor}25`, color: selectedWing.hexColor }}
            >
              {selectedWing.type}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Active
            </span>
          </div>

          <div>
            <h4 className="text-sm font-extrabold text-white leading-tight">{selectedWing.name}</h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug line-clamp-2">
              {selectedWing.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">Capacity</span>
              <span className="text-xs font-bold text-slate-200">{selectedWing.bedCapacity}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Floors</span>
              <span className="text-xs font-bold text-slate-200">{selectedWing.floorCount} Levels</span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-black/40 border border-slate-800 text-[10px] space-y-0.5">
            <div className="text-slate-400">Chief on Duty:</div>
            <div className="font-bold text-teal-300 truncate">{selectedWing.dutySpecialist}</div>
            <div className="text-emerald-400 font-semibold">{selectedWing.status}</div>
          </div>

          {onNavigateMode && (
            <button
              type="button"
              onClick={() => onNavigateMode(selectedWing.targetMode)}
              className="w-full py-2 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-110"
              style={{ backgroundColor: selectedWing.hexColor }}
            >
              <span>Enter {selectedWing.name.split(' ')[0]} Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Orbit Helper Tip */}
        <div className="absolute bottom-3 left-4 z-10 pointer-events-none">
          <span className="text-[11px] font-medium text-slate-300/80 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Click & drag to explore campus pavilions · Select any wing on the left to inspect
          </span>
        </div>
      </div>

      {/* Hospital Certifications & Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-black/40 border-t border-teal-500/20 text-xs text-slate-300">
        <div className="flex items-center gap-2 p-1.5">
          <Award className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-white">NABH Accredited</div>
            <div className="text-[9px] text-slate-400">Tertiary Hospital Care</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <Bed className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-white">850 Total Beds</div>
            <div className="text-[9px] text-slate-400">92 ICU / Critical Care</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <Clock className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-white">24/7 Trauma Level 1</div>
            <div className="text-[9px] text-slate-400">3 Min Average Triage</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-white">Emergency: 108</div>
            <div className="text-[9px] text-slate-400">Free Tele-Triage Desk</div>
          </div>
        </div>
      </div>
    </div>
  );
};
