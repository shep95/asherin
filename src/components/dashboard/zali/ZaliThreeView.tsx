import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function HologramObject({ mode = "assembly" }: { mode?: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 1, 0]}>
      {mode === "assembly" && <boxGeometry args={[2, 2, 2]} />}
      {mode === "atomic" && <icosahedronGeometry args={[1.5, 2]} />}
      {mode === "biological" && <torusKnotGeometry args={[1, 0.3, 100, 16]} />}
      <meshStandardMaterial 
        color="#00f0ff" 
        wireframe={true}
        emissive="#00f0ff"
        emissiveIntensity={0.5}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

const ZaliThreeView = ({ mode = "assembly" }: { mode?: string }) => {
  return (
    <div className="w-full h-full bg-black/90 relative overflow-hidden rounded-xl border border-border/20">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[10px] font-mono text-accent tracking-widest uppercase mb-1">
          ZALI HOLOGRAPHIC LAB
        </div>
        <div className="text-xs font-bold text-white tracking-wider">
          {mode.toUpperCase()} VIEW
        </div>
      </div>
      
      <Canvas camera={{ position: [4, 4, 6], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00f0ff" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00aa" />
        
        <HologramObject mode={mode} />
        
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#00f0ff" 
          cellColor="#1a1a1a" 
          sectionSize={3} 
          cellSize={1} 
        />
        
        <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
        <Environment preset="city" />
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 z-10 font-mono text-[10px] text-accent/50">
        SCALE: 1:1 • RENDER: REALTIME • PHYSICS: ACTIVE
      </div>
    </div>
  );
};

export default ZaliThreeView;
