import React, { useMemo } from 'react';
import * as THREE from 'three';
// FIX: Added 'type' keyword here to satisfy TypeScript strict mode
import type { BandColor } from '../config/bandColors';

interface BandColumnProps {
  index: number;
  colorData: BandColor;
  activeRow: number;
  maxRows: number;
  maxBands: number;
}

export const BandColumn: React.FC<BandColumnProps> = ({ 
  index, 
  colorData, 
  activeRow, 
  maxRows, 
  maxBands 
}) => {
  const spheres = useMemo(() => {
    return new Array(maxRows).fill(0).map((_, rowIndex) => {
      const x = (index / (maxBands - 1)) * 2 - 1;
      const y = (rowIndex / (maxRows - 1)) * 2 - 1;
      return { x, y, rowIndex };
    });
  }, [index, maxRows, maxBands]);

  const threeColor = useMemo(() => new THREE.Color(colorData.hex), [colorData.hex]);

  return (
    <group>
      {spheres.map((pos) => {
        const normalizedY = pos.rowIndex / (maxRows - 1);
        const baseOpacity = 0.001 + normalizedY * 0.999;
        const isActive = activeRow === pos.rowIndex;
        const emissiveIntensity = isActive ? 2.0 : 0;

        return (
          <mesh key={pos.rowIndex} position={[pos.x, pos.y, 0]}>
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshStandardMaterial 
              color={threeColor}
              transparent
              opacity={isActive ? 1 : baseOpacity}
              roughness={0.2}
              metalness={0.3}
              emissive={threeColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        );
      })}
    </group>
  );
};