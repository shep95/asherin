import { Suspense, useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Text, RoundedBox, Center, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ZaliProject } from "./types";

// ── Equipment / component block ──────────────────────────────────────────────
function EquipmentBlock({ position, size, color, label, index }: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  label: string;
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3} floatingRange={[-0.05, 0.05]}>
      <group position={position}>
        <RoundedBox
          ref={meshRef}
          args={size}
          radius={0.05}
          smoothness={4}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <meshStandardMaterial
            color={hovered ? "#00ffcc" : color}
            metalness={0.6}
            roughness={0.2}
            transparent
            opacity={hovered ? 1 : 0.85}
            emissive={hovered ? "#00ffcc" : color}
            emissiveIntensity={hovered ? 0.3 : 0.05}
          />
        </RoundedBox>
        {/* Edge wireframe */}
        <RoundedBox args={size} radius={0.05} smoothness={4}>
          <meshBasicMaterial color="#00ffcc" wireframe transparent opacity={0.08} />
        </RoundedBox>
        {hovered && (
          <Html center distanceFactor={6} style={{ pointerEvents: "none" }}>
            <div className="px-2 py-1 rounded-md bg-background/90 border border-accent/30 backdrop-blur-sm whitespace-nowrap">
              <p className="text-[10px] font-light text-accent">{label}</p>
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// ── Base platform ────────────────────────────────────────────────────────────
function BasePlatform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
      <circleGeometry args={[2.5, 64]} />
      <meshStandardMaterial
        color="#1a1a2e"
        metalness={0.8}
        roughness={0.3}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

// ── Grid ring ────────────────────────────────────────────────────────────────
function GridRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.1;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
      <ringGeometry args={[2.2, 2.5, 64]} />
      <meshBasicMaterial color="#00ffcc" transparent opacity={0.1} />
    </mesh>
  );
}

// ── Main scene ───────────────────────────────────────────────────────────────
function ModelScene({ project, viewMode }: { project: ZaliProject; viewMode: string }) {
  const specs = project.specifications as Record<string, any>;
  const materials = specs?.materials || [];
  const features = specs?.key_features || [];

  // Generate equipment blocks from materials + features
  const equipment = useMemo(() => {
    const items: { label: string; color: string }[] = [];
    materials.forEach((m: string) => items.push({ label: m, color: "#3b82f6" }));
    features.forEach((f: string) => items.push({ label: f, color: "#8b5cf6" }));
    if (items.length === 0) {
      items.push(
        { label: "Core Module", color: "#3b82f6" },
        { label: "Power Unit", color: "#ef4444" },
        { label: "Interface Layer", color: "#10b981" },
        { label: "Sensor Array", color: "#f59e0b" },
      );
    }
    return items;
  }, [materials, features]);

  const exploded = viewMode === "exploded";
  const spread = exploded ? 1.8 : 1;

  // Layout blocks in a circle — use deterministic sizing (no Math.random)
  const blocks = useMemo(() => {
    const count = Math.min(equipment.length, 12);
    return equipment.slice(0, count).map((eq, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = count <= 4 ? 0.8 * spread : 1.2 * spread;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (i % 3) * 0.4 - 0.3;
      // Deterministic sizing based on index
      const seed = ((i * 7 + 3) % 10) / 10;
      const sizeBase = 0.3 + seed * 0.15;
      const heightMul = 0.6 + ((i * 13 + 5) % 10) / 10 * 0.8;
      return {
        ...eq,
        position: [x, y, z] as [number, number, number],
        size: [sizeBase, sizeBase * heightMul, sizeBase] as [number, number, number],
      };
    });
  }, [equipment, spread]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 3, -3]} intensity={0.4} color="#00ffcc" />
      <spotLight position={[0, 8, 0]} angle={0.3} penumbra={0.8} intensity={0.5} color="#8b5cf6" />

      <Center>
        {/* Core central element */}
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
          <mesh>
            <icosahedronGeometry args={[0.4, 1]} />
            <meshStandardMaterial
              color="#00ffcc"
              metalness={0.9}
              roughness={0.1}
              emissive="#00ffcc"
              emissiveIntensity={0.15}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshBasicMaterial color="#00ffcc" wireframe transparent opacity={0.15} />
          </mesh>
        </Float>

        {/* Equipment blocks */}
        {blocks.map((block, i) => (
          <EquipmentBlock
            key={i}
            index={i}
            position={block.position}
            size={block.size}
            color={block.color}
            label={block.label}
          />
        ))}
      </Center>

      <BasePlatform />
      <GridRing />

      <Environment preset="night" />
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 1.8}
      />
    </>
  );
}

// ── Exported component ───────────────────────────────────────────────────────
interface Props {
  project: ZaliProject;
  viewMode: string;
}

const Zali3DModel = ({ project, viewMode }: Props) => {
  try {
    return (
      <div className="w-full h-full min-h-[350px]">
        <Canvas
          camera={{ position: [4, 3, 4], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
          onCreated={(state) => {
            state.gl.setClearColor(0x000000, 0);
          }}
        >
          <Suspense fallback={null}>
            <ModelScene project={project} viewMode={viewMode} />
          </Suspense>
        </Canvas>
      </div>
    );
  } catch {
    return (
      <div className="flex items-center justify-center h-full min-h-[350px]">
        <p className="text-xs text-muted-foreground">3D viewport unavailable</p>
      </div>
    );
  }
};

export default Zali3DModel;
