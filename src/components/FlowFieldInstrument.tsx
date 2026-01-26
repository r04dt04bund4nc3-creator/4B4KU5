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

const FSQ_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * SIM PASS (your “fuse + incense” behavior)
 */
const SIM_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrev;
  uniform vec2 uPointer;      // 0..1
  uniform vec2 uPointerVel;   // delta in 0..1 per frame
  uniform float uDown;        // 0/1
  uniform vec2 uRes;          // px
  uniform float uTime;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  vec2 curl(vec2 p) {
    float e = 0.0025;
    float n1 = vnoise(p + vec2(e, 0.0));
    float n2 = vnoise(p - vec2(e, 0.0));
    float n3 = vnoise(p + vec2(0.0, e));
    float n4 = vnoise(p - vec2(0.0, e));
    vec2 g = vec2(n1 - n2, n3 - n4);
    return vec2(g.y, -g.x);
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uRes.x / min(uRes.x, uRes.y), uRes.y / min(uRes.x, uRes.y));

    // Advection
    vec2 p = uv * 1.65;
    vec2 vel = curl(p + uTime * 0.05);

    float activity = mix(0.25, 1.0, smoothstep(0.2, 0.9, uv.y));

    // Gentler upward drift than original
    vel += vec2(0.0, 0.06 * activity);

    float advectStrength = 0.010 * activity;
    vec2 advect = vel * advectStrength / aspect;

    vec4 prev = texture2D(uPrev, clamp(uv - advect, 0.0, 1.0));

    // Bloom (small)
    vec2 px = 1.0 / uRes;
    vec4 c0 = prev;
    vec4 c1 = texture2D(uPrev, clamp(uv + vec2(px.x, 0.0), 0.0, 1.0));
    vec4 c2 = texture2D(uPrev, clamp(uv - vec2(px.x, 0.0), 0.0, 1.0));
    vec4 c3 = texture2D(uPrev, clamp(uv + vec2(0.0, px.y), 0.0, 1.0));
    vec4 c4 = texture2D(uPrev, clamp(uv - vec2(0.0, px.y), 0.0, 1.0));
    vec4 blur = (c0 * 0.60 + (c1 + c2 + c3 + c4) * 0.10);

    vec4 state = mix(prev, blur, 0.10);

    // Decay
    float i = state.r;
    float decay = mix(0.995, 0.985, smoothstep(0.2, 1.0, i));
    state.r *= decay;
    if (state.r < 0.0015) state.r = 0.0;

    // Fuse injection behind motion
    vec2 center = uPointer;
    if (uDown > 0.5) {
      float speed = length(uPointerVel);
      if (speed > 0.0005) {
        vec2 dir = normalize(uPointerVel);
        center = uPointer - dir * 0.08;
      }
    }

    vec2 d = (uv - center) * aspect;
    float dist = length(d);

    float coreR = 0.008;
    float auraR = 0.025;
    float core = 1.0 - smoothstep(0.0, coreR, dist);
    float aura = 1.0 - smoothstep(coreR, auraR, dist);

    if (uDown > 0.5) {
      float add = core * 0.65 + aura * 0.12;
      if (add > 0.0005) {
        state.r = min(1.0, state.r + add);
        state.g = mix(state.g, uPointer.y, 0.25);
        state.b = mix(state.b, uPointer.x, 0.35);
        state.a = mix(state.a, hash(uv * uRes + uTime), 0.35);
      }
    }

    gl_FragColor = state;
  }
`;

/**
 * RENDER PASS (palette + “colored smoke” fix)
 *
 * Changes vs your current:
 * - No grayscale-mixing in “smoke” stage (keeps chroma).
 * - More emissive highs (bright color like your reference).
 * - Powder is more colorful + less muddy (grain uses chroma, not gray residue).
 * - Background is darker/cleaner so pigment pops.
 */
const RENDER_FRAG = /* glsl */ `
  precision highp float;

  #define MAX_BANDS 36

  uniform sampler2D uTex;
  uniform vec2 uPointer;
  uniform float uDown;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCountdown;
  uniform float uPalette[MAX_BANDS * 3];

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  vec3 bandColor(float x01) {
    float b = clamp(floor(x01 * float(MAX_BANDS)), 0.0, float(MAX_BANDS - 1));
    int i = int(b) * 3;
    return vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
  }

  // Preserve hue/chroma: adjust brightness instead of desaturating to gray
  vec3 darkenPreserveChroma(vec3 c, float k) {
    // k: 0..1, higher = darker
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    // Pull toward a darker version of itself (not toward gray)
    return mix(c, c * (0.25 + 0.75 * l), k);
  }

  vec3 materialize(vec3 base, float y01, float intensity) {
    // 0..1: water -> smoke -> fire
    if (y01 < 0.33) {
      float t = y01 / 0.33;
      // watery glow (cooler, but keep color)
      vec3 water = base * vec3(0.35, 0.85, 1.35);
      return water * mix(0.18, 0.55, t);
    } else if (y01 < 0.66) {
      float t = (y01 - 0.33) / 0.33;
      // smoke: keep chroma, reduce brightness a touch, add airy lift
      vec3 smoke = darkenPreserveChroma(base, 0.55);
      // airy lift with intensity so “smoke” blooms bright where dense
      smoke *= mix(0.40, 1.05, t);
      smoke *= (0.70 + 0.60 * smoothstep(0.08, 0.35, intensity));
      return smoke;
    } else {
      float t = (y01 - 0.66) / 0.34;
      // fire: warmer + emissive
      vec3 fire = base * vec3(1.55, 0.95, 0.35);
      return fire * mix(0.70, 2.40, t);
    }
  }

  void main() {
    vec2 uv = vUv;

    // Clean dark background (less colorful bias than before)
    vec3 col = vec3(0.006, 0.010, 0.016);
    col += 0.010 * sin(vec3(uv.x * 5.0, uv.y * 6.0, (uv.x + uv.y) * 3.0) + uTime * 0.10);

    vec4 d = texture2D(uTex, uv);
    float intensity = d.r;
    float styleY = d.g;
    float colorX = d.b;
    float seed = d.a;

    if (intensity > 0.001) {
      vec3 base = bandColor(colorX);
      vec3 ink = materialize(base, styleY, intensity);

      // Main body (airy smoke)
      float body = smoothstep(0.02, 0.32, intensity);

      // Bright “core glow” for higher intensity (gets you toward reference)
      float coreGlow = smoothstep(0.22, 0.75, intensity);
      coreGlow = pow(coreGlow, 1.4);

      // Powder: chromatic grains at low intensity, stronger than before
      float powderZone = 1.0 - smoothstep(0.04, 0.16, intensity);
      float grain = hash(uv * uRes * 0.75 + seed * 91.0);
      float powder = powderZone * smoothstep(0.40, 0.92, grain);

      // Composition:
      //  - body: soft volumetric color
      //  - coreGlow: additive-ish bloom
      //  - powder: chromatic pigment speckle that reads “settled”
      col += ink * (0.65 * body);
      col += ink * (0.45 * intensity);     // keeps midtones present
      col += ink * powder * 0.55;          // stronger powder, less muddy
      col += ink * coreGlow * 0.55;        // emissive pop for saturated smoke

      // Optional micro-shimmer kept subtle
      float shimmer = 0.5 + 0.5 * sin((uv.x * 88.0 + uv.y * 63.0) + uTime * 0.55 + seed * 6.0);
      col += ink * shimmer * 0.03 * body;
    }

    // Pointer spark: barely visible
    vec2 aspect = vec2(uRes.x / min(uRes.x, uRes.y), uRes.y / min(uRes.x, uRes.y));
    float dp = length((uv - uPointer) * aspect);
    float spark = 1.0 - smoothstep(0.0, 0.012, dp);

    vec3 pBase = bandColor(uPointer.x);
    vec3 pInk = materialize(pBase, uPointer.y, 0.5);
    col += pInk * spark * mix(0.02, 0.06, uDown);

    // Very subtle countdown lift
    col *= 1.0 + uCountdown * 0.12;

    // Tonemap + gamma
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

  const palette = useMemo(() => makePaletteArray(), []);

  const targets = useRef<{ a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget } | null>(null);
  const ping = useRef(true);

  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCam = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cam.position.z = 1;
    return cam;
  }, []);

  const simMat = useRef<THREE.ShaderMaterial | null>(null);
  const renderMat = useRef<THREE.ShaderMaterial | null>(null);

  const prevPointerRef = useRef(new THREE.Vector2(0.5, 0.5));

  useEffect(() => {
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
        uPointerVel: { value: new THREE.Vector2(0.0, 0.0) },
        uDown: { value: 0 },
        uRes: { value: new THREE.Vector2(size.width, size.height) },
        uTime: { value: 0 },
      },
    });

    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat.current);
    simQuad.frustumCulled = false;
    simScene.add(simQuad);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const prev = prevPointerRef.current;
    const vx = pointer01.x - prev.x;
    const vy = pointer01.y - prev.y;
    prev.set(pointer01.x, pointer01.y);

    // SIM uniforms
    simMat.current.uniforms.uPrev.value = read.texture;
    (simMat.current.uniforms.uPointer.value as THREE.Vector2).set(pointer01.x, pointer01.y);
    (simMat.current.uniforms.uPointerVel.value as THREE.Vector2).set(vx, vy);
    simMat.current.uniforms.uDown.value = pointer01.down ? 1 : 0;
    simMat.current.uniforms.uTime.value = clock.elapsedTime;

    gl.setRenderTarget(write);
    gl.render(simScene, simCam);
    gl.setRenderTarget(null);

    // RENDER uniforms
    renderMat.current.uniforms.uTex.value = write.texture;
    (renderMat.current.uniforms.uPointer.value as THREE.Vector2).set(pointer01.x, pointer01.y);
    renderMat.current.uniforms.uDown.value = pointer01.down ? 1 : 0;
    (renderMat.current.uniforms.uRes.value as THREE.Vector2).set(size.width, size.height);
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