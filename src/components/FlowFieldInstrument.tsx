import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

// --- UTILS ---------------------------------------------------------

function getPaletteArray() {
  const arr = new Float32Array(MAX_BANDS * 3);
  BAND_COLORS.forEach((c, i) => {
    arr[i * 3 + 0] = c.rgb[0] / 255;
    arr[i * 3 + 1] = c.rgb[1] / 255;
    arr[i * 3 + 2] = c.rgb[2] / 255;
  });
  return arr;
}

// --- SHADERS -------------------------------------------------------

const SIM_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Simulation pass: writes intensity + stylization data into the FBO
const SIM_FRAGMENT = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uPointer;   // 0..1
  uniform float uDown;     // 0 or 1
  uniform float uAspect;   // width / height
  uniform float uTime;
  
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    
    // Previous frame
    vec4 prev = texture2D(uTexture, uv); // (r=intensity, g=y-style, b=x-color, a=unused)
    
    // Distance from pointer with aspect correction
    vec2 d = uv - uPointer;
    d.x *= uAspect;
    float dist = length(d);

    // Radial brush: 1 at center, 0 at radius
    float radius = 0.12;
    float brush = 1.0 - smoothstep(0.0, radius, dist);

    if (uDown > 0.5 && brush > 0.001) {
      float add = brush * 0.9;

      // Increase intensity and clamp
      prev.r = min(1.0, prev.r + add);

      // Encode Y (material) and X (band) for the renderer
      prev.g = mix(prev.g, uPointer.y, 0.4);
      prev.b = uPointer.x;
    }

    // Fade trail over time
    prev.r *= 0.985;
    if (prev.r < 0.002) prev.r = 0.0;

    gl_FragColor = prev;
  }
`;

const RENDER_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Render pass: turns the FBO data into visible color
const RENDER_FRAGMENT = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uPalette[${MAX_BANDS * 3}];
  uniform float uTime;
  uniform float uCountdown;
  
  varying vec2 vUv;

  void main() {
    vec4 data = texture2D(uTexture, vUv);
    float intensity = data.r;
    float inputY    = data.g;
    float inputX    = data.b;

    // Subtle animated background so we know the shader is active
    vec3 bgColor = vec3(0.04, 0.06, 0.09);
    bgColor += 0.02 * sin(vec3(
      vUv.x * 4.0 + uTime * 0.25,
      vUv.y * 5.0 - uTime * 0.18,
      (vUv.x + vUv.y) * 3.0 + uTime * 0.21
    ));

    if (intensity < 0.01) {
      gl_FragColor = vec4(bgColor, 1.0);
      return;
    }

    // GENERATIVE PALETTE (approximate BAND_COLORS)
    vec3 baseColor;
    if (inputX < 0.16) {
      baseColor = mix(vec3(0.4, 0.8, 0.1), vec3(0.1, 0.6, 0.1), inputX/0.16);        // verdant
    } else if (inputX < 0.5) {
      baseColor = mix(vec3(0.6, 0.1, 0.1), vec3(0.9, 0.6, 0.1), (inputX-0.16)/0.34); // ember
    } else if (inputX < 0.83) {
      baseColor = mix(vec3(0.1, 0.4, 0.8), vec3(0.4, 0.1, 0.6), (inputX-0.5)/0.33);  // abyssal
    } else {
      baseColor = vec3(0.9, 0.9, 0.2);                                               // solar
    }

    vec3 col = baseColor;

    // MATERIAL MODES by Y
    if (inputY < 0.33) {
      // WATER: cooler, refractive feel
      col = mix(baseColor * 0.4, baseColor * 1.6, intensity);
      col += vec3(0.1, 0.25, 0.4) * intensity;
    } else if (inputY < 0.66) {
      // SMOKE: desaturated, airy
      float t = (inputY - 0.33) / 0.33;
      float g = dot(baseColor, vec3(0.299, 0.587, 0.114));
      vec3 gray = vec3(g);
      col = mix(gray, baseColor, 0.2 + 0.8 * t);
      col *= 0.8 + 0.4 * intensity;
    } else {
      // FIRE: hotter, additive
      float t = (inputY - 0.66) / 0.34;
      col = baseColor * (1.0 + 3.0 * t * intensity);
      col += vec3(0.3, 0.1, 0.0) * intensity * intensity;
    }

    // Blend into background with intensity
    vec3 composite = mix(bgColor, col, smoothstep(0.0, 0.3, intensity));

    // Countdown brightening (future UX cue)
    composite *= (1.0 + uCountdown * 0.5);

    gl_FragColor = vec4(composite, 1.0);
  }
`;

// --- COMPONENT -----------------------------------------------------

type Props = {
  pointer01: { x: number; y: number; down: boolean };
  countdownProgress?: number;
};

export const FlowFieldInstrument: React.FC<Props> = ({
  pointer01,
  countdownProgress = 0,
}) => {
  const { size, gl } = useThree();

  // Ping‑pong render targets
  const [targetA, targetB] = useMemo(() => {
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType, // very compatible, enough precision for 0..1 data
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };
    const t1 = new THREE.WebGLRenderTarget(size.width, size.height, opts);
    const t2 = new THREE.WebGLRenderTarget(size.width, size.height, opts);
    return [t1, t2];
  }, []); // Created once; we resize manually below

  const currentTarget = useRef(targetA);
  const prevTarget = useRef(targetB);

  const simMaterial = useRef<THREE.ShaderMaterial | null>(null);
  const renderMaterial = useRef<THREE.ShaderMaterial | null>(null);
  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCamera = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cam.position.z = 1;
    return cam;
  }, []);
  const simMesh = useRef<THREE.Mesh | null>(null);

  // Keep targets in sync with viewport size
  useEffect(() => {
    currentTarget.current.setSize(size.width, size.height);
    prevTarget.current.setSize(size.width, size.height);
  }, [size.width, size.height]);

  const palette = useMemo(() => getPaletteArray(), []);

  useFrame(({ clock }) => {
    if (!simMaterial.current || !renderMaterial.current || !simMesh.current) return;

    // --- SIMULATION PASS (off‑screen) ---
    simMesh.current.material = simMaterial.current;

    simMaterial.current.uniforms.uTexture.value = prevTarget.current.texture;
    simMaterial.current.uniforms.uPointer.value.set(pointer01.x, pointer01.y);
    simMaterial.current.uniforms.uDown.value = pointer01.down ? 1.0 : 0.0;
    simMaterial.current.uniforms.uAspect.value = size.width / size.height;
    simMaterial.current.uniforms.uTime.value = clock.elapsedTime;

    gl.setRenderTarget(currentTarget.current);
    gl.render(simScene, simCamera);
    gl.setRenderTarget(null);

    // --- RENDER PASS (to screen, via main mesh) ---
    renderMaterial.current.uniforms.uTexture.value = currentTarget.current.texture;
    renderMaterial.current.uniforms.uTime.value = clock.elapsedTime;
    renderMaterial.current.uniforms.uCountdown.value = countdownProgress;

    // Swap targets
    const tmp = currentTarget.current;
    currentTarget.current = prevTarget.current;
    prevTarget.current = tmp;
  });

  return (
    <>
      {/* Off‑screen simulation scene */}
      {createPortal(
        <mesh ref={simMesh}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={simMaterial}
            vertexShader={SIM_VERTEX}
            fragmentShader={SIM_FRAGMENT}
            uniforms={{
              uTexture: { value: null },
              uPointer: { value: new THREE.Vector2(0.5, 0.5) },
              uDown: { value: 0 },
              uAspect: { value: 1 },
              uTime: { value: 0 },
            }}
          />
        </mesh>,
        simScene
      )}

      {/* On‑screen display */}
      <mesh frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={renderMaterial}
          vertexShader={RENDER_VERTEX}
          fragmentShader={RENDER_FRAGMENT}
          uniforms={{
            uTexture: { value: null },
            uPalette: { value: palette },
            uTime: { value: 0 },
            uCountdown: { value: 0 },
          }}
          transparent={false}
        />
      </mesh>
    </>
  );
};