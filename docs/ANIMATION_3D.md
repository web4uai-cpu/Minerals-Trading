# 3D & Animation Implementation Guide — Khanij Nexus

> Implementation specs for the 3D scenes and animation system.  
> Design intent is in `.claude/skills/frontend-ui/SKILL.md`.

---

## Dependencies to Install

```bash
# 3D
pnpm --filter @khanij/web add three @react-three/fiber @react-three/drei
pnpm --filter @khanij/web add -D @types/three

# Animation
pnpm --filter @khanij/web add framer-motion gsap @gsap/react lottie-react

# Charts
pnpm --filter @khanij/web add recharts d3
pnpm --filter @khanij/web add -D @types/d3
```

---

## Scene 1: India Globe (`components/3d/GlobeScene.tsx`)

### Tech
React Three Fiber + `@react-three/drei` `<OrbitControls>` + custom sphere geometry.

### Implementation

```tsx
'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import { useRef, useState } from 'react';
import * as THREE from 'three';

const MINING_STATES = [
  { name: 'Rajasthan', lat: 27.02, lng: 74.22, minerals: ['Iron Ore', 'Limestone'] },
  { name: 'Odisha',    lat: 20.95, lng: 85.10, minerals: ['Iron Ore', 'Bauxite'] },
  { name: 'Jharkhand', lat: 23.61, lng: 85.28, minerals: ['Coal', 'Iron Ore'] },
  { name: 'Goa',       lat: 15.30, lng: 74.00, minerals: ['Iron Ore', 'Manganese'] },
  { name: 'Karnataka', lat: 15.32, lng: 75.71, minerals: ['Iron Ore', 'Copper'] },
];

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function MiningMarker({ state, isActive, onClick }: MarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current && isActive) {
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.3);
    }
  });

  const pos = latLngToVector3(state.lat, state.lng, 2.05);

  return (
    <mesh ref={meshRef} position={pos} onClick={onClick}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshStandardMaterial
        color={isActive ? '#D97706' : '#10B981'}
        emissive={isActive ? '#D97706' : '#10B981'}
        emissiveIntensity={isActive ? 2 : 0.5}
      />
    </mesh>
  );
}

export function GlobeScene({ onStateSelect }: { onStateSelect: (state: string) => void }) {
  const [activeState, setActiveState] = useState<string | null>(null);

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#3B82F6" />

      {/* Earth sphere — dark ocean */}
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial color="#0A0B0D" metalness={0.1} roughness={0.8} />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[2.1, 64, 64]}>
        <meshStandardMaterial color="#1d4ed8" transparent opacity={0.05} side={THREE.BackSide} />
      </Sphere>

      {/* Mining state markers */}
      {MINING_STATES.map(state => (
        <MiningMarker
          key={state.name}
          state={state}
          isActive={activeState === state.name}
          onClick={() => {
            setActiveState(state.name);
            onStateSelect(state.name);
          }}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={8}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
```

---

## Scene 2: TrustScore Gauge (`components/3d/TrustGauge.tsx`)

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface TrustGaugeProps {
  score: number;  // 0–100
  previousScore?: number;
}

export function TrustGauge({ score, previousScore }: TrustGaugeProps) {
  const animatedScore = useSpring(previousScore ?? score, { stiffness: 60, damping: 20 });

  useEffect(() => { animatedScore.set(score); }, [score]);

  const rotation = useTransform(animatedScore, [0, 100], [-135, 135]);
  const color = score < 40 ? '#EF4444' : score < 70 ? '#F59E0B' : '#10B981';

  const circumference = 2 * Math.PI * 45;
  const dashOffset = useTransform(animatedScore, [0, 100], [circumference, 0]);

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* SVG arc gauge */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        {/* Background track */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#1C1F28" strokeWidth="8" />
        {/* Score arc */}
        <motion.circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>

      {/* Score number */}
      <motion.div className="text-center z-10">
        <motion.span className="text-3xl font-bold text-white">
          {useTransform(animatedScore, v => Math.round(v))}
        </motion.span>
        <p className="text-xs text-base-500 mt-0.5">TrustScore</p>
      </motion.div>
    </div>
  );
}
```

---

## Scene 3: Milestone Track (`components/3d/MilestoneTrack.tsx`)

```tsx
'use client';
import { motion } from 'framer-motion';

const MILESTONE_TYPES = ['AGREEMENT', 'ESCROW', 'SAMPLING', 'DISPATCH', 'DELIVERY', 'PAYMENT'] as const;

const MILESTONE_ICONS = {
  AGREEMENT: '📄', ESCROW: '🔒', SAMPLING: '🧪',
  DISPATCH: '🚚', DELIVERY: '📦', PAYMENT: '💰',
};

interface MilestoneTrackProps {
  milestones: Array<{ type: string; status: 'PENDING' | 'DONE' | 'OVERDUE' }>;
}

export function MilestoneTrack({ milestones }: MilestoneTrackProps) {
  return (
    <div className="relative flex items-center gap-2 py-4 overflow-x-auto">
      {milestones.map((milestone, i) => {
        const status = milestone.status;
        const isDone = status === 'DONE';
        const isOverdue = status === 'OVERDUE';
        const isNext = !isDone && milestones[i - 1]?.status === 'DONE';

        return (
          <div key={milestone.type} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <motion.div
                className="h-0.5 w-8 flex-shrink-0"
                style={{ background: isDone ? '#10B981' : '#252934' }}
                animate={{ scaleX: isDone ? 1 : 0 }}
                initial={{ scaleX: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
            )}

            {/* Milestone node */}
            <motion.div
              className={`relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg border-2 ${
                isDone ? 'bg-sage/20 border-sage' :
                isOverdue ? 'bg-crimson/20 border-crimson' :
                isNext ? 'bg-accent/20 border-accent' :
                'bg-base-800 border-base-700'
              }`}
              animate={isNext ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              whileHover={{ scale: 1.1 }}
            >
              <span>{MILESTONE_ICONS[milestone.type as keyof typeof MILESTONE_ICONS]}</span>

              {/* Glow effect for next milestone */}
              {isNext && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-accent/20"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Label */}
            <div className="absolute mt-14 text-xs text-base-500 text-center w-12 -ml-0.5">
              {milestone.type.toLowerCase()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Page Transition System

```tsx
// components/layout/PageTransition.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

const variants = {
  initial: { opacity: 0, y: 16 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={pathname} variants={variants} initial="initial" animate="enter" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Landing Hero Animation (GSAP)

```tsx
'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export function HeroSection() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl
      .from('.hero-eyebrow', { y: 20, opacity: 0, duration: 0.6 })
      .from('.hero-title span', { y: 60, opacity: 0, duration: 0.8, stagger: 0.15 }, '-=0.3')
      .from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
      .from('.hero-cta', { scale: 0.9, opacity: 0, duration: 0.4 }, '-=0.2')
      .from('.hero-stats', { y: 20, opacity: 0, stagger: 0.1 }, '-=0.2');
  }, { scope: container });

  return (
    <div ref={container} className="hero-container">
      <p className="hero-eyebrow">India's Minerals Trade Platform</p>
      <h1 className="hero-title">
        <span>Verified.</span> <span>Matched.</span> <span>Protected.</span>
      </h1>
      {/* ... */}
    </div>
  );
}
```

---

## Lottie Micro-Animations

```tsx
// Lottie files location: apps/web/public/lottie/
// Naming: {state}.json — e.g., success.json, loading.json, empty.json, error.json

import Lottie from 'lottie-react';
import successAnimation from '@/public/lottie/success.json';

export function SuccessState() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Lottie
        animationData={successAnimation}
        loop={false}
        style={{ width: 120, height: 120 }}
      />
      <p>Compliance document verified!</p>
    </div>
  );
}
```

---

## Reduced Motion Handling

```tsx
// hooks/useReducedMotion.ts
import { useReducedMotion } from 'framer-motion';

// All animation components check this:
const prefersReducedMotion = useReducedMotion();

const variants = prefersReducedMotion
  ? { initial: {}, enter: {}, exit: {} }  // No animation
  : { initial: { opacity: 0 }, enter: { opacity: 1 }, exit: { opacity: 0 } };
```

In GSAP:
```tsx
useGSAP(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // ... animations
});
```

---

## Performance Budget

| Scene | Max bundle size | Max frame time |
|-------|----------------|----------------|
| Globe | 800KB (three.js) | 16ms (60fps) |
| TrustGauge | 20KB | n/a (CSS/SVG) |
| MilestoneTrack | 30KB | n/a (Framer) |
| PriceSurface | 400KB | 16ms |

Use `Stats` from `@react-three/drei` in development to monitor FPS.
