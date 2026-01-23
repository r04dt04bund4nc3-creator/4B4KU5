import { useFrame, useThree } from '@react-three/fiber';
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

type Props = {
  activeRows: number[];
  handleInteraction: (uv: THREE.Vector2) => void;
  countdownProgress: number; // 0..1
};

export const FlowFieldInstrument: React.FC<Props> = ({
  activeRows,
  handleInteraction,
  countdownProgress,
}) => {
  const { gl, size } = useThree();

  // 1. Prepare Palette and EQ data for GPU
  const palette = useMemo(() => {
    const arr = new Float32Array(MAX_BANDS * 3);
    BAND_COLORS.forEach((c, i) => {
      arr[i * 3 + 0] = c.rgb[0] / 255;
      arr[i * 3 + 1] = c.rgb[1] / 255;
      arr[i * 3 + 2] = c.rgb[2] / 255;
    });
    return arr;
  }, []);

  const eqUniform = useMemo(() => new Float32Array(MAX_BANDS), []);
  useEffect(() => {
    for (let i = 0; i < MAX_BANDS; i++) eqUniform[i] = activeRows[i];
  }, [activeRows, eqUniform]);

  // 2. Setup Persistent Buffers (The "Painting" Canvas)
  const renderTargets = useMemo(() => {
    const params = {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    };
    return [
      new THREE.WebGLRenderTarget(size.width, size.height, params),
      new THREE.WebGLRenderTarget(size.width, size.height, params),
    ];
  }, [size.width, size.height]);

  const readTarget = useRef(0); // Index for ping-ponging
  const pointer = useRef(new THREE.Vector2(-1, -1));
  const lastPointer = useRef(new THREE.Vector2(-1, -1));
  const isDown = useRef(false);

  // 3. Main Shader Materials
  const simulationMat = useRef<THREE.ShaderMaterial>(null!);
  const displayMat = useRef<THREE.MeshBasicMaterial>(null!);

  // Orthographic camera for full-screen processing
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const fullScreenQuad = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  useFrame((state) => {
    if (!simulationMat.current || !displayMat.current) return;

    const writeTarget = 1 - readTarget.current;

    // Update Uniforms
    simulationMat.current.uniforms.uTime.value = state.clock.elapsedTime;
    simulationMat.current.uniforms.uBuffer.value = renderTargets[readTarget.current].texture;
    simulationMat.current.uniforms.uPointer.value.copy(pointer.current);
    simulationMat.current.uniforms.uLastPointer.value.copy(lastPointer.current);
    simulationMat.current.uniforms.uIsDown.value = isDown.current ? 1.0 : 0.0;
    simulationMat.current.uniforms.uCountdown.value = countdownProgress;
    simulationMat.current.uniforms.uEQ.value = eqUniform;

    // Pass 1: Draw the painting logic to the 'write' target
    gl.setRenderTarget(renderTargets[writeTarget]);
    gl.render(state.scene, orthoCamera); // Scene contains the mesh using simulationMat
    
    // Pass 2: Show the result on screen
    gl.setRenderTarget(null);
    displayMat.current.map = renderTargets[writeTarget].texture;

    // Swap buffers
    readTarget.current = writeTarget;
  });

  // 4. Input Handlers
  const handlePointer = (e: any) => {
    lastPointer.current.copy(pointer.current);
    pointer.current.copy(e.uv);
    if (isDown.current || e.buttons > 0) handleInteraction(e.uv);
  };

  return (
    <group>
      {/* Simulation Plane (Hidden Pass) */}
      <mesh frustumCulled={false}>
        <primitive object={fullScreenQuad} />
        <shaderMaterial
          ref={simulationMat}
          uniforms={{
            uTime: { value: 0 },
            uBuffer: { value: null },
            uPointer: { value: new THREE.Vector2(-1, -1) },
            uLastPointer: { value: new THREE.Vector2(-1, -1) },
            uIsDown: { value: 0 },
            uPalette: { value: palette },
            uEQ: { value: eqUniform },
            uCountdown: { value: 0 },
            uRes: { value: new THREE.Vector2(size.width, size.height) },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
          `}
          fragmentShader={`
            precision highp float;
            uniform float uTime, uIsDown, uCountdown;
            uniform vec2 uPointer, uLastPointer, uRes;
            uniform sampler2D uBuffer;
            uniform float uPalette[108], uEQ[36];
            varying vec2 vUv;

            vec3 getBandColor(float x) {
              int i = int(clamp(x * 36.0, 0.0, 35.0)) * 3;
              return vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
            }

            void main() {
              vec2 uv = vUv;
              vec3 prev = texture2D(uBuffer, uv).rgb;
              
              // 1. Persistence & Rework-Fading
              float bandX = floor(uv.x * 36.0);
              float activeRow = uEQ[int(bandX)];
              float fade = (activeRow >= 0.0) ? 0.985 : 0.994;
              prev *= fade;

              // 2. The Brush (Wake)
              float dist = length((uv - uPointer) * (uRes / min(uRes.x, uRes.y)));
              float brush = smoothstep(0.08, 0.0, dist);
              
              if(uIsDown > 0.5) {
                vec3 base = getBandColor(uv.x);
                vec3 ink = base;
                
                if(uv.y < 0.33) ink *= vec3(0.5, 0.8, 1.2); // Water
                else if(uv.y > 0.66) ink *= vec3(1.5, 0.9, 0.4); // Fire
                
                // Turbulent turbulence
                float noise = sin(uv.x * 50.0 + uTime * 10.0) * cos(uv.y * 50.0 + uTime * 10.0);
                prev += ink * brush * 0.15 * (1.0 + noise * 0.2);
              }

              // 3. Countdown Reveal (Subtle EQ Lines)
              if(uCountdown > 0.0 && activeRow >= 0.0) {
                float rowY = activeRow / 36.0;
                float line = smoothstep(0.005, 0.0, abs(uv.y - rowY));
                prev += getBandColor(uv.x) * line * uCountdown * 0.4;
              }

              gl_FragColor = vec4(prev, 1.0);
            }
          `}
        />
      </mesh>

      {/* Visible Plane */}
      <mesh
        onPointerDown={(e) => { isDown.current = true; handlePointer(e); }}
        onPointerMove={handlePointer}
        onPointerUp={() => { isDown.current = false; pointer.current.set(-1, -1); }}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial ref={displayMat} transparent />
      </mesh>
    </group>
  );
};