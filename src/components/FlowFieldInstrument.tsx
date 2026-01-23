import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BAND_COLORS } from '../config/bandColors';

type Props = {
  onTriggerAudio: (x: number, y: number) => void;
  countdownProgress: number;
};

export const FlowFieldInstrument = ({ onTriggerAudio, countdownProgress }: Props) => {
  const { gl, size } = useThree();

  // 1. Prepare Palette
  const palette = useMemo(() => {
    const arr = new Float32Array(36 * 3);
    BAND_COLORS.forEach((c, i) => {
      arr[i * 3 + 0] = c.rgb[0] / 255;
      arr[i * 3 + 1] = c.rgb[1] / 255;
      arr[i * 3 + 2] = c.rgb[2] / 255;
    });
    return arr;
  }, []);

  // 2. Setup Buffers for persistence
  const [targetA, targetB] = useMemo(() => {
    const t = () => new THREE.WebGLRenderTarget(size.width, size.height, {
      format: THREE.RGBAFormat, 
      type: THREE.UnsignedByteType
    });
    return [t(), t()];
  }, [size.width, size.height]);

  const readTarget = useRef(targetA);
  const writeTarget = useRef(targetB);
  
  // Use a separate scene just for the simulation pass
  const simScene = useMemo(() => {
    const scene = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uBuffer: { value: null },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(-1, -1) },
        uIsDown: { value: 0 },
        uPalette: { value: palette },
        uCountdown: { value: 0 },
        uRes: { value: new THREE.Vector2(size.width, size.height) }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uBuffer;
        uniform float uTime, uIsDown, uCountdown;
        uniform vec2 uPointer, uRes;
        uniform float uPalette[108];
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec3 prev = texture2D(uBuffer, uv).rgb;
          prev *= 0.985; // Persistence fade

          vec2 aspect = uRes / min(uRes.x, uRes.y);
          float d = length((uv - uPointer) * aspect);
          float curl = sin(uv.y * 15.0 + uTime * 2.0) * 0.02;

          if (uIsDown > 0.5 && (d + curl) < 0.12) {
            int i = int(clamp(uv.x * 36.0, 0.0, 35.0)) * 3;
            vec3 col = vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
            
            // Material Zones
            if (uv.y < 0.33) col *= vec3(0.5, 0.8, 1.5); // Water
            else if (uv.y > 0.66) col *= vec3(1.8, 0.9, 0.3); // Fire
            else col *= 0.8; // Smoke

            prev += col * smoothstep(0.12, 0.0, d + curl) * 0.4;
          }
          
          if (uCountdown > 0.0) prev *= (1.0 + uCountdown * 0.01);
          gl_FragColor = vec4(prev, 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);
    return { scene, mat };
  }, [palette, size]);

  const displayMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const pointer = useRef(new THREE.Vector2(-1, -1));
  const isDown = useRef(false);

  useFrame((state) => {
    // 1. SIMULATION PASS
    simScene.mat.uniforms.uBuffer.value = readTarget.current.texture;
    simMatRef.current ? null : null; // Hack to keep ref clean
    simScene.mat.uniforms.uTime.value = state.clock.elapsedTime;
    simScene.mat.uniforms.uPointer.value.copy(pointer.current);
    simScene.mat.uniforms.uIsDown.value = isDown.current ? 1 : 0;
    simScene.mat.uniforms.uCountdown.value = countdownProgress;

    gl.setRenderTarget(writeTarget.current);
    gl.render(simScene.scene, state.camera);

    // 2. DISPLAY PASS
    gl.setRenderTarget(null);
    displayMatRef.current.map = writeTarget.current.texture;

    // 3. PING PONG
    const temp = readTarget.current;
    readTarget.current = writeTarget.current;
    writeTarget.current = temp;
  });

  const simMatRef = useRef(simScene.mat);

  return (
    <mesh
      onPointerDown={(e) => { isDown.current = true; pointer.current.copy(e.uv!); onTriggerAudio(e.uv!.x, e.uv!.y); }}
      onPointerMove={(e) => { pointer.current.copy(e.uv!); if(isDown.current) onTriggerAudio(e.uv!.x, e.uv!.y); }}
      onPointerUp={() => { isDown.current = false; pointer.current.set(-1, -1); }}
    >
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial ref={displayMatRef} />
    </mesh>
  );
};