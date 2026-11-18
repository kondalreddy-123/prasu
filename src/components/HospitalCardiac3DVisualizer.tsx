import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Activity, Heart, Layers, Sparkles, Volume2, VolumeX, Shield, Play, Pause, Zap } from 'lucide-react';

interface Props {
  className?: string;
  onConsultDoctor?: () => void;
}

export const HospitalCardiac3DVisualizer: React.FC<Props> = ({ className = '', onConsultDoctor }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [bpm, setBpm] = useState<number>(72);
  const [activeLayer, setActiveLayer] = useState<'all' | 'vascular' | 'electrical' | 'myocardium'>('all');
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedChamber, setSelectedChamber] = useState<string>('Left Ventricle');

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const layerRef = useRef(activeLayer);
  layerRef.current = activeLayer;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // -------------------------------------------------------------
  // 1. THREE.JS 3D ANATOMICAL CARDIAC DIGITAL TWIN
  // -------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a192f, 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2, 18);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Cardiac Assembly Group
    const heartGroup = new THREE.Group();
    scene.add(heartGroup);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x0e7c86, 3.5);
    mainLight.position.set(8, 12, 10);
    scene.add(mainLight);

    const backlight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    backlight.position.set(-8, -6, -8);
    scene.add(backlight);

    const rimLight = new THREE.PointLight(0xff3366, 3, 25);
    rimLight.position.set(0, -4, 6);
    scene.add(rimLight);

    // Anatomical Heart Constructs:
    // A. Ventricular Body (Left and Right Ventricles)
    const leftVentricleGeo = new THREE.ConeGeometry(2.4, 4.2, 32, 16);
    leftVentricleGeo.rotateZ(Math.PI);
    leftVentricleGeo.translate(-0.6, -0.6, 0);

    const rightVentricleGeo = new THREE.ConeGeometry(2.0, 3.8, 32, 16);
    rightVentricleGeo.rotateZ(Math.PI);
    rightVentricleGeo.translate(0.9, -0.5, 0.3);

    // B. Atria
    const leftAtriumGeo = new THREE.SphereGeometry(1.6, 24, 24);
    leftAtriumGeo.translate(-1.0, 1.8, -0.4);

    const rightAtriumGeo = new THREE.SphereGeometry(1.5, 24, 24);
    rightAtriumGeo.translate(1.2, 1.7, 0.2);

    // Materials
    const myocardiumMat = new THREE.MeshPhysicalMaterial({
      color: 0x9b111e, // Deep Ruby / Cardiac Red
      emissive: 0x3d0007,
      roughness: 0.35,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      wireframe: false,
    });

    const lvMesh = new THREE.Mesh(leftVentricleGeo, myocardiumMat);
    const rvMesh = new THREE.Mesh(rightVentricleGeo, myocardiumMat);
    const laMesh = new THREE.Mesh(leftAtriumGeo, myocardiumMat);
    const raMesh = new THREE.Mesh(rightAtriumGeo, myocardiumMat);

    const muscleGroup = new THREE.Group();
    muscleGroup.add(lvMesh);
    muscleGroup.add(rvMesh);
    muscleGroup.add(laMesh);
    muscleGroup.add(raMesh);
    heartGroup.add(muscleGroup);

    // C. Vascular Arch (Aorta & Pulmonary Artery)
    const vascularGroup = new THREE.Group();
    heartGroup.add(vascularGroup);

    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.4, 1.5, 0),
      new THREE.Vector3(-0.3, 3.4, 0.2),
      new THREE.Vector3(0.5, 4.2, -0.2),
      new THREE.Vector3(1.6, 3.6, -0.8),
      new THREE.Vector3(1.7, 1.0, -1.2),
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.75, 16, false);
    const aortaMat = new THREE.MeshStandardMaterial({
      color: 0xd92d20, // Oxygenated Arterial Red
      roughness: 0.2,
      metalness: 0.3,
    });
    const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
    vascularGroup.add(aortaMesh);

    // Pulmonary Trunk & Branches
    const pulmoCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.6, 1.2, 0.6),
      new THREE.Vector3(0.3, 2.8, 0.8),
      new THREE.Vector3(-0.8, 3.2, 0.5),
    ]);
    const pulmoGeo = new THREE.TubeGeometry(pulmoCurve, 24, 0.65, 16, false);
    const pulmoMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Deoxygenated Venous Blue
      roughness: 0.25,
      metalness: 0.3,
    });
    const pulmoMesh = new THREE.Mesh(pulmoGeo, pulmoMat);
    vascularGroup.add(pulmoMesh);

    // Coronary Arteries (Vascular network branching over the ventricles)
    const coronaryMat = new THREE.MeshBasicMaterial({ color: 0xff3b57 });
    for (let c = 0; c < 5; c++) {
      const startX = -0.5 + c * 0.3;
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(startX, 1.0, 1.4),
        new THREE.Vector3(startX - 0.3, -0.2, 1.6),
        new THREE.Vector3(startX - 0.1, -1.4, 1.3),
        new THREE.Vector3(startX + (c % 2 === 0 ? 0.3 : -0.3), -2.4, 0.8),
      ]);
      const branchGeo = new THREE.TubeGeometry(branchCurve, 20, 0.08, 8, false);
      const branchMesh = new THREE.Mesh(branchGeo, coronaryMat);
      vascularGroup.add(branchMesh);
    }

    // D. Electrical Conduction Pathways (SA Node, AV Node, Bundle of His, Purkinje Fibers)
    const electricalGroup = new THREE.Group();
    heartGroup.add(electricalGroup);

    // Sinoatrial Node (glowing beacon in RA)
    const saNodeGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const saNodeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.5,
    });
    const saNode = new THREE.Mesh(saNodeGeo, saNodeMat);
    saNode.position.set(1.4, 2.5, 0.4);
    electricalGroup.add(saNode);

    // AV Node (Central septal node)
    const avNode = saNode.clone();
    avNode.position.set(0.1, 0.8, 0.3);
    electricalGroup.add(avNode);

    // Glowing Conduction Ring / Pathways
    const pathwayPoints = [
      new THREE.Vector3(1.4, 2.5, 0.4),
      new THREE.Vector3(0.7, 1.6, 0.5),
      new THREE.Vector3(0.1, 0.8, 0.3),
      new THREE.Vector3(0.0, -0.4, 0.4),
      new THREE.Vector3(-0.6, -1.8, 0.5),
    ];
    const pathwayCurve = new THREE.CatmullRomCurve3(pathwayPoints);
    const pathwayGeo = new THREE.TubeGeometry(pathwayCurve, 24, 0.07, 8, false);
    const pathwayMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 });
    const pathwayMesh = new THREE.Mesh(pathwayGeo, pathwayMat);
    electricalGroup.add(pathwayMesh);

    // Holographic Medical Diagnostic Grid Rings around heart
    const ringGeo = new THREE.TorusGeometry(4.8, 0.04, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0e7c86, transparent: true, opacity: 0.4 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    heartGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.03, 16, 100), new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.3 }));
    ring2.rotation.y = Math.PI / 4;
    heartGroup.add(ring2);

    // Interactive mouse rotation
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotY = 0;
    let targetRotX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        targetRotY += deltaX * 0.008;
        targetRotX += deltaY * 0.008;
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
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (isPausedRef.current) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Current BPM calculation
      const currentBpm = bpmRef.current;
      const cycleFrequency = currentBpm / 60; // beats per second
      const beatPhase = (time * cycleFrequency * Math.PI * 2) % (Math.PI * 2);

      // Realistic cardiac systole / diastole pumping curve
      // Systole: rapid contraction; Diastole: relaxing recoil
      const pulseFactor = Math.sin(beatPhase);
      const cardiacExpansion = 1 + (pulseFactor > 0.4 ? Math.pow(pulseFactor, 3) * 0.14 : 0);

      muscleGroup.scale.set(cardiacExpansion, cardiacExpansion * 1.03, cardiacExpansion);
      vascularGroup.scale.set(1 + (pulseFactor > 0.6 ? 0.06 : 0), 1, 1 + (pulseFactor > 0.6 ? 0.06 : 0));

      // Electrical signal glow pulsation
      saNodeMat.emissiveIntensity = 1.0 + Math.max(0, pulseFactor) * 2.5;

      // Handle layer visibilities
      const layer = layerRef.current;
      muscleGroup.visible = layer === 'all' || layer === 'myocardium';
      vascularGroup.visible = layer === 'all' || layer === 'vascular';
      electricalGroup.visible = layer === 'all' || layer === 'electrical';

      // Smooth camera rotation
      if (!isDragging) {
        targetRotY += delta * 0.35;
      }
      heartGroup.rotation.y += (targetRotY - heartGroup.rotation.y) * 0.1;
      heartGroup.rotation.x += (targetRotX - heartGroup.rotation.x) * 0.1;

      // Floating gentle oscillation
      heartGroup.position.y = Math.sin(time * 1.2) * 0.2;

      // Rotate auxiliary telemetry rings
      ring1.rotation.z = time * 0.2;
      ring2.rotation.x = time * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 2. SYNCHRONIZED REAL-TIME ECG TELEMETRY CANVAS
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;
    const points: number[] = new Array(240).fill(40);

    const draw = () => {
      animId = requestAnimationFrame(draw);
      if (isPausedRef.current) return;

      const w = canvas.width;
      const h = canvas.height;
      const baseline = h / 2;

      ctx.fillStyle = 'rgba(10, 25, 47, 0.25)';
      ctx.fillRect(0, 0, w, h);

      // Medical grid lines
      ctx.strokeStyle = 'rgba(14, 124, 134, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Generate ECG Waveform based on current BPM
      const currentBpm = bpmRef.current;
      const interval = Math.floor(200 / (currentBpm / 60)); // frames per heartbeat
      const cyclePos = step % interval;

      let val = 0;
      // P wave
      if (cyclePos >= 10 && cyclePos <= 22) {
        val = -Math.sin(((cyclePos - 10) / 12) * Math.PI) * 7;
      }
      // PR segment (flat)
      else if (cyclePos > 22 && cyclePos < 28) {
        val = 0;
      }
      // Q wave (small dip)
      else if (cyclePos >= 28 && cyclePos <= 32) {
        val = 4;
      }
      // R wave (huge sharp spike)
      else if (cyclePos > 32 && cyclePos <= 38) {
        val = -32;
      }
      // S wave (deep negative dip)
      else if (cyclePos > 38 && cyclePos <= 44) {
        val = 9;
      }
      // ST segment
      else if (cyclePos > 44 && cyclePos < 55) {
        val = 0;
      }
      // T wave
      else if (cyclePos >= 55 && cyclePos <= 75) {
        val = -Math.sin(((cyclePos - 55) / 20) * Math.PI) * 11;
      } else {
        // baseline with tiny physiologic noise
        val = (Math.random() - 0.5) * 1.2;
      }

      points.push(baseline + val);
      if (points.length > w / 2) {
        points.shift();
      }

      // Draw ECG trace line
      ctx.beginPath();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 8;

      for (let i = 0; i < points.length; i++) {
        const x = i * 2;
        const y = points[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      step++;
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className={`relative rounded-3xl bg-gradient-to-br from-[#071321] via-[#0B1E36] to-[#0A192F] border-2 border-teal-500/30 shadow-2xl overflow-hidden ${className}`}>
      {/* Real Clinical Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-teal-500/20 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300">
            <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-teal-300 uppercase">
                Cardiac 3D Telemetry Twin
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Telemetry Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-time biomechanical simulation synchronized with hospital ECG monitors
            </p>
          </div>
        </div>

        {/* Diagnostic Presets */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-700/60">
          <button
            type="button"
            onClick={() => setBpm(58)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              bpm === 58 ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Resting 58 BPM
          </button>
          <button
            type="button"
            onClick={() => setBpm(72)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              bpm === 72 ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Normal 72 BPM
          </button>
          <button
            type="button"
            onClick={() => setBpm(105)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              bpm === 105 ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Elevated 105 BPM
          </button>
        </div>
      </div>

      {/* Main 3D WebGL Canvas Area */}
      <div className="relative w-full h-[360px] sm:h-[420px]">
        {/* Three.js DOM container */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Anatomical Layer Selector Pills (Floating Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-lg">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1.5">
            Anatomical Layers
          </span>
          <button
            type="button"
            onClick={() => setActiveLayer('all')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl text-left transition-all ${
              activeLayer === 'all'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Full Anatomical Twin
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('myocardium')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl text-left transition-all ${
              activeLayer === 'myocardium'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Myocardial Muscle
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('vascular')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl text-left transition-all ${
              activeLayer === 'vascular'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Aorta & Coronary Arteries
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('electrical')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl text-left transition-all ${
              activeLayer === 'electrical'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            SA/AV Conduction Node
          </button>
        </div>

        {/* Live Clinical Biomarkers Panel (Floating Right) */}
        <div className="absolute top-4 right-4 z-10 bg-slate-900/85 backdrop-blur-md p-3.5 rounded-2xl border border-teal-500/30 text-white w-48 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
            <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">
              Cardiac Vitals
            </span>
            <Activity className="w-3.5 h-3.5 text-teal-400" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Heart Rate</span>
              <span className="text-base font-black text-rose-400">{bpm}</span>
              <span className="text-[9px] text-slate-400 ml-0.5">BPM</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Blood Press.</span>
              <span className="text-base font-black text-teal-300">120/80</span>
              <span className="text-[9px] text-slate-400 ml-0.5">mmHg</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">EF Ratio</span>
              <span className="text-sm font-extrabold text-emerald-400">64%</span>
              <span className="text-[9px] text-slate-400 ml-0.5">Normal</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Cardiac Out.</span>
              <span className="text-sm font-extrabold text-sky-400">5.2</span>
              <span className="text-[9px] text-slate-400 ml-0.5">L/min</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-slate-700/70 text-[10px] text-slate-400 leading-tight">
            <span>Rhythm: </span>
            <span className="text-emerald-400 font-bold">Sinus Rhythm (SR)</span>
            <br />
            <span>Pathology: </span>
            <span className="text-slate-200">Zero Arrhythmia</span>
          </div>
        </div>

        {/* Orbit Helper Tip */}
        <div className="absolute bottom-3 left-4 z-10 pointer-events-none">
          <span className="text-[11px] font-medium text-slate-300/80 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Click & drag to rotate in 3D · Zoom with scroll wheel
          </span>
        </div>
      </div>

      {/* Synchronized Real-Time ECG Waveform Monitor */}
      <div className="relative border-t border-teal-500/20 bg-[#06101e] p-3">
        <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400 px-1 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-bold">Lead II (ECG Rhythm Strip)</span>
            <span className="text-[10px] text-slate-500">25 mm/s · 10 mm/mV · Filter: 0.05-150 Hz</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">P-Q-R-S-T Normal</span>
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isPaused ? 'Resume live wave' : 'Pause wave'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <canvas
          ref={ecgCanvasRef}
          width={640}
          height={70}
          className="w-full h-[65px] rounded-xl border border-teal-900/50 bg-[#081526]"
        />
      </div>

      {/* Footer Care Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-black/40 border-t border-teal-500/20 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Shield className="w-4 h-4 text-teal-400" />
          <span>Integrates with NABL Pathology & OPD Consultation Workbenches</span>
        </div>
        {onConsultDoctor && (
          <button
            type="button"
            onClick={onConsultDoctor}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-[#0E7C86] hover:from-teal-600 hover:to-[#0A626A] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Consult Cardiology Specialist</span>
          </button>
        )}
      </div>
    </div>
  );
};
