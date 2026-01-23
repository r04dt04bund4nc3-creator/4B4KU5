import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BAND_COLORS } from '../config/bandColors';

const MAX_BANDS = 36;

type Props = {
  activeRows: number[];
  handleInteraction: (uv: THREE.Vector2) => void;
  countdownProgress: number; // 0..1 during last 36s
};

export const FlowFieldInstrument: React.FC<Props> = ({
  activeRows,
  handleInteraction,
  countdownProgress,
}) => {
  const { gl, size } = useThree();

  // Palette packed for GPU (36 * vec3)
  const palette = useMemo(() => {
    const arr = new Float32Array(MAX_BANDS * 3);
    BAND_COLORS.forEach((c, i) => {
      arr[i * 3 + 0] = c.rgb[0] / 255;
      arr[i * 3 + 1] = c.rgb[1] / 255;
      arr[i * 3 + 2] = c.rgb[2] / 255;
    });
    return arr;
  }, []);

  // Pointer state (single touch only)
  const pointer = useRef(new THREE.Vector2(-10, -10));
  const lastPointer = useRef(new THREE.Vector2(-10, -10));
  const pointerDown = useRef(false);

  // We render into this RT each frame, then display it.
  const rt = useRef<THREE.WebGLRenderTarget | null>(null);

  // A separate scene/camera for “buffer pass”
  const bufferScene = useRef(new THREE.Scene());
  const bufferCam = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  const bufferQuad = useRef<THREE.Mesh | null>(null);

  // Materials
  const bufferMat = useRef<THREE.ShaderMaterial | null>(null);
  const displayMat = useRef<THREE.MeshBasicMaterial | null>(null);

  // ActiveRows as a float array for uniforms (WebGL1-safe pattern)
  const activeRowsUniform = useMemo(() => new Float32Array(MAX_BANDS), []);
  useEffect(() => {
    for (let i = 0; i < MAX_BANDS; i++) activeRowsUniform[i] = activeRows[i];
  }, [activeRows, activeRowsUniform]);

  // Create / resize render target
  useEffect(() => {
    const makeRT = () => {
      const next = new THREE.WebGLRenderTarget(size.width, size.height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
      });
      next.texture.minFilter = THREE.LinearFilter;
      next.texture.magFilter = THREE.LinearFilter;
      next.texture.generateMipmaps = false;
      return next;
    };

    const old = rt.current;
    rt.current = makeRT();
    old?.dispose();

    // also update resolution uniforms if material exists
    if (bufferMat.current) {
      bufferMat.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  }, [size.width, size.height]);

  // Build the buffer pipeline once
  useEffect(() => {
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    bufferMat.current = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: pointer.current },
        uLastPointer: { value: lastPointer.current },
        uPointerDown: { value: 0 },
        uCountdown: { value: 0 },
        uBuffer: { value: null as THREE.Texture | null },
        uPalette: { value: palette },
        uActiveRows: { value: activeRowsUniform },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        #define MAX_BANDS 36
        #define MAX_ROWS 36

        uniform float uTime;
        uniform vec2 uPointer;
        uniform vec2 uLastPointer;
        uniform float uPointerDown;
        uniform float uCountdown;
        uniform sampler2D uBuffer;
        uniform float uPalette[MAX_BANDS * 3];
        uniform float uActiveRows[MAX_BANDS];
        uniform vec2 uResolution;

        varying vec2 vUv;

        vec3 bandColor(float band) {
          int i = int(band) * 3;
          return vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
        }

        // Y material mapping: water -> smoke -> fire
        vec3 materialize(vec3 base, float y) {
          if (y < 0.33) {
            // water: cooler, softer
            float t = y / 0.33;
            return base * vec3(0.55, 0.8, 1.1) * mix(0.35, 0.65, t);
          } else if (y < 0.66) {
            // smoke: desaturated
            float t = (y - 0.33) / 0.33;
            float g = dot(base, vec3(0.299, 0.587, 0.114));
            vec3 gray = vec3(g);
            return mix(gray, base, 0.25) * mix(0.55, 0.85, t);
          } else {
            // fire: warm + bright
            float t = (y - 0.66) / 0.34;
            return base * vec3(1.25, 0.85, 0.35) * mix(0.8, 1.8, t);
          }
        }

        // Cheap curl noise (enough to feel turbulent)
        vec2 curl(vec2 p) {
          float s = sin(p.x * 6.0 + uTime * 1.7) + cos(p.y * 6.5 - uTime * 1.3);
          float c = cos(p.x * 5.2 - uTime * 1.1) - sin(p.y * 5.8 + uTime * 1.5);
          return vec2(s, c);
        }

        void main() {
          vec2 uv = vUv;

          // previous frame
          vec3 prev = texture2D(uBuffer, uv).rgb;

          // global decay (painting but not infinite)
          float decay = 0.992;

          // if this band has been touched (has a row), decay slightly more there so “changes” clean up old strokes
          int bandIdx = int(floor(uv.x * float(MAX_BANDS)));
          bandIdx = clamp(bandIdx, 0, MAX_BANDS - 1);
          float row = uActiveRows[bandIdx]; // -1..35
          if (row >= 0.0) decay = 0.985;

          prev *= decay;

          // pointer stroke injection (only when down)
          vec2 aspect = vec2(uResolution.x / min(uResolution.x, uResolution.y), uResolution.y / min(uResolution.x, uResolution.y));
          float d = length((uv - uPointer) * aspect);
          vec2 v = (uPointer - uLastPointer) * aspect;
          float speed = clamp(length(v) * 60.0, 0.0, 2.0);

          // turbulence warp
          vec2 w = curl(uv * 2.0) * (0.002 + speed * 0.004);
          vec2 warpedUv = uv + w;

          // band color from x
          float band = clamp(floor(uv.x * float(MAX_BANDS)), 0.0, float(MAX_BANDS - 1));
          vec3 base = bandColor(band);
          vec3 ink = materialize(base, uv.y);

          // stroke shape
          float radius = mix(0.06, 0.025, clamp(speed, 0.0, 1.0));
          float core = smoothstep(radius, 0.0, d);

          // extra sparkle for top third
          float sparkle = 0.0;
          if (uv.y > 0.66) {
            sparkle = pow(max(0.0, sin((uv.x + uv.y) * 120.0 + uTime * 18.0)), 18.0) * 0.35;
          }

          vec3 add = vec3(0.0);
          if (uPointerDown > 0.5 && uPointer.x > -1.0) {
            add = ink * core * (0.10 + speed * 0.14);
            add += ink * sparkle * core;
          }

          // Non-numeric countdown: overall “energize” + subtle EQ reveal
          if (uCountdown > 0.0) {
            float energize = 1.0 + uCountdown * 0.35;
            prev *= energize;

            // EQ reveal line per band (shows where the final row ended up)
            float rowNorm = clamp(row / float(MAX_ROWS), 0.0, 1.0);
            float line = smoothstep(rowNorm - 0.01, rowNorm, uv.y) * smoothstep(rowNorm + 0.01, rowNorm, uv.y);
            prev += materialize(base, rowNorm) * line * (0.15 * uCountdown);
          }

          vec3 outc = prev + add;

          // mild tonemap / gamma
          outc = clamp(outc, 0.0, 1.5);
          outc = outc / (1.0 + outc);
          outc = pow(outc, vec3(0.4545));

          gl_FragColor = vec4(outc, 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(quadGeo, bufferMat.current);
    bufferQuad.current = quad;
    bufferScene.current.add(quad);

    // Display material will be made once RT exists; updated in frame.
    displayMat.current = new THREE.MeshBasicMaterial({
      map: null,
      transparent: false,
    });

    return () => {
      bufferScene.current.remove(quad);
      quadGeo.dispose();
      bufferMat.current?.dispose();
      displayMat.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, activeRowsUniform]);

  // pointer handlers via R3F events on the visible mesh
  const onPointerDown = (e: any) => {
    pointerDown.current = true;
    lastPointer.current.copy(pointer.current);
    pointer.current.copy(e.uv);
    handleInteraction(e.uv);
  };

  const onPointerMove = (e: any) => {
    lastPointer.current.copy(pointer.current);
    pointer.current.copy(e.uv);
    if (pointerDown.current || e.pointerType === 'touch' || e.buttons > 0) {
      handleInteraction(e.uv);
    }
  };

  const onPointerUp = () => {
    pointerDown.current = false;
    pointer.current.set(-10, -10);
    lastPointer.current.set(-10, -10);
  };

  useFrame(({ clock }) => {
    if (!rt.current || !bufferMat.current || !displayMat.current) return;

    bufferMat.current.uniforms.uTime.value = clock.elapsedTime;
    bufferMat.current.uniforms.uCountdown.value = countdownProgress;
    bufferMat.current.uniforms.uPointerDown.value = pointerDown.current ? 1 : 0;

    // feed last rendered texture back into buffer shader
    bufferMat.current.uniforms.uBuffer.value = rt.current.texture;

    // render buffer scene into RT
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(rt.current);
    gl.render(bufferScene.current, bufferCam.current);
    gl.setRenderTarget(prevTarget);

    // show RT on the visible plane
    displayMat.current.map = rt.current.texture;
    displayMat.current.needsUpdate = true;
  });

  return (
    <mesh
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial ref={displayMat} />
    </mesh>
  );
};