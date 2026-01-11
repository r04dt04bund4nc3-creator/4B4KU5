import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface RibbonProps {
  finalEQState: number[];
  maxRows: number;
  maxBands: number;
  isVisible: boolean;
}

export const Ribbon: React.FC<RibbonProps> = ({ 
  finalEQState, 
  maxRows, 
  maxBands,
  isVisible 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    if (!isVisible || finalEQState.length === 0) return null;

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < maxBands; i++) {
        const rowIndex = finalEQState[i] !== undefined ? finalEQState[i] : 0;
        const x = (i / (maxBands - 1)) * 2 - 1;
        const y = (rowIndex / (maxRows - 1)) * 2 - 1;
        points.push(new THREE.Vector3(x, y, 0.05));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 64, 0.01, 8, false);
  }, [finalEQState, maxBands, maxRows, isVisible]);

  useFrame((state: any) => {
    if (meshRef.current && isVisible) {
       const time = state.clock.getElapsedTime();
       const r = Math.sin(time * 3) * 0.5 + 0.5;
       const g = Math.sin(time * 3 + 2) * 0.5 + 0.5;
       const b = Math.sin(time * 3 + 4) * 0.5 + 0.5;
       // @ts-ignore - Material color set is valid but TS is strict here
       meshRef.current.material.color.setRGB(r, g, b);
    }
  });

  if (!geometry || !isVisible) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial attach="material" color={0xffffff} transparent opacity={0.8} />
    </mesh>
  );
};