import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

function getPaletteArray() {
  const arr = new Float32Array(MAX_BANDS * 3);
  BAND_COLORS.forEach((c, i) => {
    arr[i * 3 + 0] = c.rgb[0] / 255;
    arr[i * 3 + 1] = c.rgb[1] / 255;
    arr[i * 3 + 2] = c.rgb[2] / 255;
  });
  return arr;
}

const SIM_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const SIM_FRAGMENT = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uPointer;
  uniform float uDown;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    vec4 prev = texture2D(uTexture, vUv);
    
    vec2 distVec = (vUv - uPointer);
    distVec.x *= uAspect;
    float d = length(distVec);
    
    // Brush influence
    float brush = smoothstep(0.08, 0.0, d) * uDown;
    
    // Accumulate intensity in R, store pos in G/B
    float newIntensity = clamp(prev.r + brush * 0.4, 0.0, 1.0);
    float newStyleY = mix(prev.g, uPointer.y, brush);
    float newStyleX = mix(prev.b, uPointer.x, brush);
    
    // Decay over time
    newIntensity *= 0.985;
    
    gl_FragColor = vec4(newIntensity, newStyleY, newStyleX, 1.0);
  }
`;

const RENDER_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const RENDER_FRAGMENT = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uPalette[108]; // 36 * 3
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec4 data = texture2D(uTexture, vUv);
    float intensity = data.r;
    float inputY = data.g;
    float inputX = data.b;

    vec3 bgColor = vec3(0.02, 0.03, 0.06);
    
    if(intensity < 0.005) {
       gl_FragColor = vec4(bgColor, 1.0);
       return;
    }

    // Direct palette color mapping
    vec3 baseColor = vec3(0.5);
    float band = clamp(inputX * 36.0, 0.0, 35.0);
    int idx = int(band) * 3;
    
    // Color logic
    if (inputX < 0.2) baseColor = vec3(0.5, 0.9, 0.1);      // Verdant
    else if (inputX < 0.5) baseColor = vec3(0.9, 0.3, 0.1); // Ember
    else if (inputX < 0.8) baseColor = vec3(0.1, 0.4, 0.9); // Abyssal
    else baseColor = vec3(0.9, 0.8, 0.1);                   // Solar

    vec3 color = baseColor;
    if (inputY < 0.33) color *= 1.2; // water
    else if (inputY > 0.66) color += vec3(0.3, 0.1, 0.0); // fire

    vec3 final = mix(bgColor, color * (0.5 + intensity * 1.5), smoothstep(0.0, 0.2, intensity));
    gl_FragColor = vec4(final, 1.0);
  }
`;

type Props = {
  pointer01: { x: number; y: number; down: boolean };
  countdownProgress?: number;
};

export const FlowFieldInstrument: React.FC<Props> = ({ pointer01 }) => {
  const { size, gl } = useThree();
  
  const [targetA, targetB] = useMemo(() => {
    const opts = {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    };
    return [
      new THREE.WebGLRenderTarget(size.width, size.height, opts),
      new THREE.WebGLRenderTarget(size.width, size.height, opts)
    ];
  }, [size.width, size.height]);

  const rtCurrent = useRef(targetA);
  const rtPrev = useRef(targetB);
  
  const simMat = useRef<THREE.ShaderMaterial>(null!);
  const renderMat = useRef<THREE.ShaderMaterial>(null!);
  
  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const palette = useMemo(() => getPaletteArray(), []);

  // Sync pointer to uniforms WITHOUT waiting for React re-render
  useFrame((state) => {
    if (!simMat.current || !renderMat.current) return;

    const { gl } = state;

    // 1. Update Sim Uniforms
    simMat.current.uniforms.uPointer.value.set(pointer01.x, pointer01.y);
    simMat.current.uniforms.uDown.value = pointer01.down ? 1.0 : 0.0;
    simMat.current.uniforms.uAspect.value = size.width / size.height;
    simMat.current.uniforms.uTexture.value = rtPrev.current.texture;

    // 2. Render Simulation
    gl.setRenderTarget(rtCurrent.current);
    gl.render(simScene, simCam);
    
    // 3. Render Final to Screen
    renderMat.current.uniforms.uTexture.value = rtCurrent.current.texture;
    renderMat.current.uniforms.uTime.value = state.clock.elapsedTime;
    gl.setRenderTarget(null);

    // 4. Swap Ping-Pong
    const temp = rtCurrent.current;
    rtCurrent.current = rtPrev.current;
    rtPrev.current = temp;
  });

  return (
    <>
      {createPortal(
        <mesh>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={simMat}
            vertexShader={SIM_VERTEX}
            fragmentShader={SIM_FRAGMENT}
            uniforms={{
              uTexture: { value: null },
              uPointer: { value: new THREE.Vector2(0.5, 0.5) },
              uDown: { value: 0 },
              uAspect: { value: 1 }
            }}
          />
        </mesh>,
        simScene
      )}

      <mesh frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={renderMat}
          vertexShader={RENDER_VERTEX}
          fragmentShader={RENDER_FRAGMENT}
          uniforms={{
            uTexture: { value: null },
            uPalette: { value: palette },
            uTime: { value: 0 }
          }}
        />
      </mesh>
    </>
  );
};