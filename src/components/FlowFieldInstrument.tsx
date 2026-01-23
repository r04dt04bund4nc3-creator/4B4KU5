import { useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

type Props = {
  onTriggerAudio: (x: number, y: number) => void;
  countdownProgress: number; // unused for now, but kept for future visuals
};

export const FlowFieldInstrument: React.FC<Props> = ({ onTriggerAudio }) => {
  const { size } = useThree();
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  // Pointer handlers: R3F gives us e.uv in [0,1] on the plane
  const handleDown = (e: any) => {
    if (!e.uv) return;
    const { x, y } = e.uv;
    onTriggerAudio(x, y);
  };

  const handleMove = (e: any) => {
    if (!e.uv) return;
    if (e.buttons === 0 && e.pointerType !== 'touch') return; // only drag or touch
    const { x, y } = e.uv;
    onTriggerAudio(x, y);
  };

  return (
    <mesh
      frustumCulled={false}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        uniforms={{
          uRes: { value: new THREE.Vector2(size.width, size.height) },
        }}
        vertexShader={/* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `}
        fragmentShader={/* glsl */`
          precision highp float;
          varying vec2 vUv;

          void main() {
            // Simple, clear visual: gradient + bright center dot
            vec3 base = vec3(vUv.x, vUv.y, 0.4 + 0.3 * vUv.y);
            float d = length(vUv - vec2(0.5, 0.5));
            float highlight = smoothstep(0.2, 0.0, d);
            vec3 col = base + vec3(0.8, 0.8, 0.8) * highlight * 0.6;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
};