import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

type Props = {
  pointer01: { x: number; y: number; down: boolean };
  countdownProgress?: number;
};

function makePaletteArray() {
  const arr = new Float32Array(MAX_BANDS * 3);
  BAND_COLORS.forEach((c, i) => {
    arr[i * 3 + 0] = c.rgb[0] / 255;
    arr[i * 3 + 1] = c.rgb[1] / 255;
    arr[i * 3 + 2] = c.rgb[2] / 255;
  });
  return arr;
}

// Fullscreen quad vertex (clipspace)
const FSQ_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Simulation: read prev texture, fade, inject brush when down
const SIM_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrev;
  uniform vec2 uPointer;   // 0..1
  uniform float uDown;     // 0/1
  uniform vec2 uRes;       // px
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec4 prev = texture2D(uPrev, vUv);

    // decay / fade
    prev.r *= 0.985;
    if (prev.r < 0.002) prev.r = 0.0;

    // circular brush in screen space (aspect-correct)
    vec2 aspect = vec2(uRes.x / min(uRes.x, uRes.y), uRes.y / min(uRes.x, uRes.y));
    float d = length((vUv - uPointer) * aspect);

    float radius = 0.06;
    float brush = 1.0 - smoothstep(0.0, radius, d);

    if (uDown > 0.5 && brush > 0.001) {
      float add = brush * 0.9;

      // store: r=intensity, g=styleY, b=colorX
      prev.r = min(1.0, prev.r + add);
      prev.g = mix(prev.g, uPointer.y, 0.35);
      prev.b = uPointer.x;
      prev.a = 1.0;
    }

    gl_FragColor = prev;
  }
`;

// Render: background + accumulated ink + ALWAYS show a pointer glow
const RENDER_FRAG = /* glsl */ `
  precision highp float;

  #define MAX_BANDS 36

  uniform sampler2D uTex;
  uniform vec2 uPointer;   // 0..1
  uniform float uDown;     // 0/1
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCountdown;
  uniform float uPalette[MAX_BANDS * 3];

  varying vec2 vUv;

  vec3 bandColor(float x01) {
    float b = clamp(floor(x01 * float(MAX_BANDS)), 0.0, float(MAX_BANDS - 1));
    int i = int(b) * 3;
    return vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
  }

  vec3 materialize(vec3 base, float y01) {
    if (y01 < 0.33) {
      float t = y01 / 0.33;
      return base * vec3(0.35, 0.7, 1.2) * mix(0.25, 0.6, t);
    } else if (y01 < 0.66) {
      float g = dot(base, vec3(0.299, 0.587, 0.114));
      vec3 gray = vec3(g);
      float t = (y01 - 0.33) / 0.33;
      return mix(gray, base, 0.25) * mix(0.35, 0.85, t);
    } else {
      float t = (y01 - 0.66) / 0.34;
      return base * vec3(1.4, 0.85, 0.25) * mix(0.7, 2.0, t);
    }
  }

  void main() {
    // background (always visible)
    vec3 col = vec3(0.02, 0.03, 0.05);
    col += 0.02 * sin(vec3(vUv.x * 7.0, vUv.y * 9.0, (vUv.x+vUv.y) * 5.0) + uTime * 0.25);

    // accumulated texture
    vec4 data = texture2D(uTex, vUv);
    float intensity = data.r;
    float styleY = data.g;
    float colorX = data.b;

    if (intensity > 0.001) {
      vec3 base = bandColor(colorX);
      vec3 ink = materialize(base, styleY);
      col = mix(col, col + ink * (0.8 + 1.5 * intensity), smoothstep(0.0, 0.25, intensity));
    }

    // GUARANTEED POINTER GLOW (even if FBO fails)
    vec2 aspect = vec2(uRes.x / min(uRes.x, uRes.y), uRes.y / min(uRes.x, uRes.y));
    float dp = length((vUv - uPointer) * aspect);
    float pr = mix(0.035, 0.055, uDown); 
    float pGlow = 1.0 - smoothstep(0.0, pr, dp);

    vec3 pBase = bandColor(uPointer.x);
    vec3 pInk = materialize(pBase, uPointer.y);
    col += pInk * pGlow * (0.6 + 1.2 * uDown);

    // subtle end lift
    col *= 1.0 + uCountdown * 0.25;

    // tonemap
    col = col / (1.0 + col);
    col = pow(col, vec3(0.4545));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const FlowFieldInstrument: React.FC<Props> = ({
  pointer01,
  countdownProgress = 0,
}) => {
  const { gl, size } = useThree();

  // Render targets (ping-pong)
  const targets = useRef<{
    a: THREE.WebGLRenderTarget;
    b: THREE.WebGLRenderTarget;
  } | null>(null);

  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCam = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cam.position.z = 1;
    return cam;
  }, []);

  const palette = useMemo(() => makePaletteArray(), []);

  // Materials
  const simMat = useRef<THREE.ShaderMaterial | null>(null);
  const renderMat = useRef<THREE.ShaderMaterial | null>(null);

  const ping = useRef(true);

  // Create FBOs + sim quad
  useEffect(() => {
    // FIX: Type annotation removed here to solve TS error
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };

    const a = new THREE.WebGLRenderTarget(size.width, size.height, opts);
    const b = new THREE.WebGLRenderTarget(size.width, size.height, opts);
    targets.current = { a, b };

    simMat.current = new THREE.ShaderMaterial({
      vertexShader: FSQ_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        uPrev: { value: b.texture },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uDown: { value: 0 },
        uRes: { value: new THREE.Vector2(size.width, size.height) },
        uTime: { value: 0 },
      },
    });

    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat.current);
    simQuad.frustumCulled = false;
    simScene.add(simQuad);

    // Initial Clear
    const prevClear = gl.getClearColor(new THREE.Color());
    const prevAlpha = gl.getClearAlpha();
    gl.setClearColor(new THREE.Color(0, 0, 0), 1);
    
    gl.setRenderTarget(a);
    gl.clear(true, true, true);
    gl.setRenderTarget(b);
    gl.clear(true, true, true);
    
    gl.setRenderTarget(null);
    gl.setClearColor(prevClear, prevAlpha);

    return () => {
      simScene.remove(simQuad);
      simQuad.geometry.dispose();
      simMat.current?.dispose();
      a.dispose();
      b.dispose();
      targets.current = null;
      simMat.current = null;
    };
  }, []);

  // Resize
  useEffect(() => {
    if (!targets.current) return;
    targets.current.a.setSize(size.width, size.height);
    targets.current.b.setSize(size.width, size.height);
    if (simMat.current) {
      (simMat.current.uniforms.uRes.value as THREE.Vector2).set(size.width, size.height);
    }
    if (renderMat.current) {
      (renderMat.current.uniforms.uRes.value as THREE.Vector2).set(size.width, size.height);
    }
  }, [size.width, size.height]);

  useFrame(({ clock }) => {
    if (!targets.current || !simMat.current || !renderMat.current) return;

    const a = targets.current.a;
    const b = targets.current.b;

    const write = ping.current ? a : b;
    const read = ping.current ? b : a;

    // SIM
    simMat.current.uniforms.uPrev.value = read.texture;
    (simMat.current.uniforms.uPointer.value as THREE.Vector2).set(pointer01.x, pointer01.y);
    simMat.current.uniforms.uDown.value = pointer01.down ? 1 : 0;
    simMat.current.uniforms.uTime.value = clock.elapsedTime;

    gl.setRenderTarget(write);
    gl.render(simScene, simCam);
    gl.setRenderTarget(null);

    // RENDER
    renderMat.current.uniforms.uTex.value = write.texture;
    (renderMat.current.uniforms.uPointer.value as THREE.Vector2).set(pointer01.x, pointer01.y);
    renderMat.current.uniforms.uDown.value = pointer01.down ? 1 : 0;
    renderMat.current.uniforms.uTime.value = clock.elapsedTime;
    renderMat.current.uniforms.uCountdown.value = countdownProgress;

    ping.current = !ping.current;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={renderMat}
        vertexShader={FSQ_VERT}
        fragmentShader={RENDER_FRAG}
        uniforms={{
          uTex: { value: null },
          uPointer: { value: new THREE.Vector2(0.5, 0.5) },
          uDown: { value: 0 },
          uRes: { value: new THREE.Vector2(size.width, size.height) },
          uTime: { value: 0 },
          uCountdown: { value: 0 },
          uPalette: { value: palette },
        }}
      />
    </mesh>
  );
};