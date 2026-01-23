import { useFrame, useThree, createPortal } from '@react-three/fiber';
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

  // 2. Buffer Buffering Logic
  const simScene = useMemo(() => new THREE.Scene(), []);
  const [targetA, targetB] = useMemo(() => {
    const t = () => new THREE.WebGLRenderTarget(size.width, size.height, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    return [t(), t()];
  }, [size.width, size.height]);

  const readTarget = useRef(targetA);
  const writeTarget = useRef(targetB);
  const simMatRef = useRef<THREE.ShaderMaterial>(null!);
  const displayMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const pointer = useRef(new THREE.Vector2(-1, -1));
  const isDown = useRef(false);

  useFrame((state) => {
    if (!simMatRef.current) return;

    // Simulation Pass
    simMatRef.current.uniforms.uBuffer.value = readTarget.current.texture;
    simMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    simMatRef.current.uniforms.uPointer.value.copy(pointer.current);
    simMatRef.current.uniforms.uIsDown.value = isDown.current ? 1 : 0;
    simMatRef.current.uniforms.uCountdown.value = countdownProgress;
    
    gl.setRenderTarget(writeTarget.current);
    gl.render(simScene, state.camera);

    // Display Pass
    gl.setRenderTarget(null);
    displayMatRef.current.map = writeTarget.current.texture;

    // Swap Buffers
    const temp = readTarget.current;
    readTarget.current = writeTarget.current;
    writeTarget.current = temp;
  });

  return (
    <>
      {/* Simulation Plane (Hidden Pass) */}
      {createPortal(
        <mesh>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={simMatRef}
            uniforms={{
              uBuffer: { value: null },
              uTime: { value: 0 },
              uPointer: { value: new THREE.Vector2(-1, -1) },
              uIsDown: { value: 0 },
              uCountdown: { value: 0 },
              uPalette: { value: palette },
              uRes: { value: new THREE.Vector2(size.width, size.height) }
            }}
            vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`}
            fragmentShader={`
              precision highp float;
              uniform sampler2D uBuffer;
              uniform float uTime, uIsDown, uCountdown;
              uniform vec2 uPointer, uRes;
              uniform float uPalette[108];
              varying vec2 vUv;

              vec3 getBandColor(float x) {
                int i = int(clamp(x * 36.0, 0.0, 35.0)) * 3;
                return vec3(uPalette[i], uPalette[i+1], uPalette[i+2]);
              }

              void main() {
                vec2 uv = vUv;
                vec3 prev = texture2D(uBuffer, uv).rgb;
                
                // Fade previous frame
                prev *= 0.985;

                // Calculate distance to pointer
                vec2 aspect = uRes / min(uRes.x, uRes.y);
                float d = length((uv - uPointer) * aspect);

                if (uIsDown > 0.5 && d < 0.15) {
                  vec3 base = getBandColor(uv.x);
                  
                  // Material Logic: Water -> Smoke -> Fire
                  if (uv.y < 0.33) {
                    // Water: Cool, Blue tint
                    prev += base * vec3(0.4, 0.7, 1.2) * smoothstep(0.15, 0.0, d) * 0.4;
                  } else if (uv.y > 0.66) {
                    // Fire: Hot, Gold/Red tint + Sparks
                    float spark = pow(max(0.0, sin(uv.x * 120.0 + uTime * 20.0)), 20.0);
                    prev += (base * vec3(1.5, 0.9, 0.3) + vec3(1.0, 0.5, 0.0) * spark) * smoothstep(0.15, 0.0, d) * 0.5;
                  } else {
                    // Smoke: Desaturated
                    float g = dot(base, vec3(0.299, 0.587, 0.114));
                    prev += vec3(g) * smoothstep(0.15, 0.0, d) * 0.25;
                  }
                }

                // Countdown Reveal (Subtle EQ lines)
                if (uCountdown > 0.0) {
                  // We need the active row data here, but for now let's just do a global brighten
                  // In next iteration we will pass activeRows as a texture
                  prev *= 1.0 + uCountdown * 0.3; 
                }

                gl_FragColor = vec4(prev, 1.0);
              }
            `}
          />
        </mesh>,
        simScene
      )}

      {/* Visible Interactive Plane */}
      <mesh
        onPointerDown={(e) => { 
          isDown.current = true; 
          pointer.current.copy(e.uv!); 
          onTriggerAudio(e.uv!.x, e.uv!.y); 
        }}
        onPointerMove={(e) => { 
          pointer.current.copy(e.uv!); 
          if(isDown.current) onTriggerAudio(e.uv!.x, e.uv!.y); 
        }}
        onPointerUp={() => { 
          isDown.current = false; 
          pointer.current.set(-1, -1); 
        }}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial ref={displayMatRef} />
      </mesh>
    </>
  );
};