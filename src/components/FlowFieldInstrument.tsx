import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

// --- UTILS ---
function getPaletteArray() {
  const arr = new Float32Array(MAX_BANDS * 3);
  BAND_COLORS.forEach((c, i) => {
    arr[i * 3 + 0] = c.rgb[0] / 255;
    arr[i * 3 + 1] = c.rgb[1] / 255;
    arr[i * 3 + 2] = c.rgb[2] / 255;
  });
  return arr;
}

// --- SHADER ---
const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  
  uniform vec2 uPointer;
  uniform float uDown;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uPalette[${MAX_BANDS * 3}];
  
  varying vec2 vUv;

  // Manual Palette Lookup
  vec3 getBandColor(float x) {
    if (x < 0.16) return mix(vec3(0.4, 0.8, 0.1), vec3(0.1, 0.6, 0.1), x/0.16);
    if (x < 0.5) return mix(vec3(0.6, 0.1, 0.1), vec3(0.9, 0.6, 0.1), (x-0.16)/0.34);
    if (x < 0.83) return mix(vec3(0.1, 0.4, 0.8), vec3(0.4, 0.1, 0.6), (x-0.5)/0.33);
    return vec3(0.9, 0.9, 0.2);
  }

  void main() {
    vec2 uv = vUv;
    
    // 1. Background (Breathing)
    vec3 col = vec3(0.02, 0.03, 0.05);
    col += 0.02 * sin(uv.y * 10.0 + uTime * 0.5);

    // 2. Pointer Graphic
    // Fix aspect ratio for circle
    float aspect = uResolution.x / uResolution.y;
    vec2 pUV = uv;
    pUV.x *= aspect;
    vec2 pPointer = uPointer;
    pPointer.x *= aspect;

    float dist = length(pUV - pPointer);
    
    // Core radius
    float radius = 0.08; 
    // Soft glow
    float glow = 1.0 - smoothstep(0.0, radius, dist);
    
    // Only show if touching or debug (remove uDown check to see it always if needed)
    float activeIntensity = glow * (0.5 + 0.5 * uDown); 

    if (activeIntensity > 0.01) {
       // Get Color based on X
       vec3 inkColor = getBandColor(uPointer.x);
       
       // Apply Style based on Y
       // WATER (Bottom)
       if (uPointer.y < 0.33) {
         inkColor = mix(inkColor, vec3(0.5, 0.8, 1.0), 0.3);
         inkColor *= 1.5; // Bright
       } 
       // SMOKE (Middle)
       else if (uPointer.y < 0.66) {
         float g = dot(inkColor, vec3(0.33));
         inkColor = mix(vec3(g), inkColor, 0.5); // Desaturated
       }
       // FIRE (Top)
       else {
         inkColor *= vec3(2.0, 1.2, 0.5); // Hot
       }

       col += inkColor * activeIntensity;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

type Props = {
  pointer01: { x: number; y: number; down: boolean };
  countdownProgress?: number;
};

export const FlowFieldInstrument: React.FC<Props> = ({ pointer01 }) => {
  const { size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const palette = useMemo(() => getPaletteArray(), []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
      // Smoothly interpolate pointer for visuals if desired, but raw is fine for Step 1
      materialRef.current.uniforms.uPointer.value.set(pointer01.x, pointer01.y);
      materialRef.current.uniforms.uDown.value = pointer01.down ? 1.0 : 0.0;
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  });

  return (
    <mesh>
      {/* Plane covers the screen because Camera is Orthographic Zoom 1 */}
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0.5, 0.5) },
          uDown: { value: 0 },
          uResolution: { value: new THREE.Vector2(100, 100) },
          uPalette: { value: palette }
        }}
        transparent={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};