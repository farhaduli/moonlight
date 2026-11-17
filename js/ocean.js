import * as THREE from 'three';

/**
 * Custom GLSL Shader Ocean featuring:
 * - Multi-octave animated swells + high-frequency capillary ripples
 * - Crisp, glittering silver-gold moonlight path (glittering specular sparkle)
 * - Fresnel sky reflection & horizon atmospheric blend
 */
export function createMoonlitOcean(scene, moonDirection) {
  // Large ocean plane extending seamlessly to the horizon
  const geometry = new THREE.PlaneGeometry(2400, 2400, 220, 220);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uMoonDir: { value: moonDirection.clone().normalize() },
    uMoonColor: { value: new THREE.Color('#fff5d6') },
    uDeepWaterColor: { value: new THREE.Color('#071224') },
    uShallowWaterColor: { value: new THREE.Color('#132847') },
    uSkyHorizonColor: { value: new THREE.Color('#1d314f') }
  };

  const vertexShader = /* glsl */ `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);

      // Gentle rolling sea swells
      float dist = length(worldPosition.xz);
      float swell1 = sin(worldPosition.x * 0.045 + worldPosition.z * 0.06 + uTime * 0.75) * 0.28;
      float swell2 = cos(worldPosition.x * 0.09 - worldPosition.z * 0.04 + uTime * 0.55) * 0.16;
      float swell3 = sin(worldPosition.z * 0.18 + uTime * 1.1) * 0.07;

      // Attenuate waves slightly near distant horizon to prevent aliasing
      float damp = 1.0 - smoothstep(180.0, 950.0, dist);
      worldPosition.y += (swell1 + swell2 + swell3) * damp;

      vWorldPos = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uMoonDir;
    uniform vec3 uMoonColor;
    uniform vec3 uDeepWaterColor;
    uniform vec3 uShallowWaterColor;
    uniform vec3 uSkyHorizonColor;

    varying vec3 vWorldPos;
    varying vec2 vUv;

    // Fast procedural hash & value noise for glittering wavelets
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    // Multi-layered wave normal perturbation for realistic moonlit sparkles
    vec3 getWaveNormal(vec2 p, float t, float distFactor) {
      float eps = 0.12;

      // Broad swells
      float w0 = noise(p * 0.08 + vec2(t * 0.12, -t * 0.18)) * 1.4
               + noise(p * 0.22 + vec2(-t * 0.15, t * 0.22)) * 0.7;

      // Medium ripples
      float r0 = noise(p * 0.85 + vec2(t * 0.45, -t * 0.35)) * 0.35
               + noise(p * 2.10 + vec2(-t * 0.60, t * 0.50)) * 0.22;

      // Fine sparkling capillary facets
      float f0 = noise(p * 5.20 + vec2(t * 0.95, t * 0.75)) * 0.14 * (1.0 - distFactor * 0.65);

      float hC = w0 + r0 + f0;

      float wX = noise((p + vec2(eps, 0.0)) * 0.08 + vec2(t * 0.12, -t * 0.18)) * 1.4
               + noise((p + vec2(eps, 0.0)) * 0.22 + vec2(-t * 0.15, t * 0.22)) * 0.7;
      float rX = noise((p + vec2(eps, 0.0)) * 0.85 + vec2(t * 0.45, -t * 0.35)) * 0.35
               + noise((p + vec2(eps, 0.0)) * 2.10 + vec2(-t * 0.60, t * 0.50)) * 0.22;
      float fX = noise((p + vec2(eps, 0.0)) * 5.20 + vec2(t * 0.95, t * 0.75)) * 0.14 * (1.0 - distFactor * 0.65);

      float wZ = noise((p + vec2(0.0, eps)) * 0.08 + vec2(t * 0.12, -t * 0.18)) * 1.4
               + noise((p + vec2(0.0, eps)) * 0.22 + vec2(-t * 0.15, t * 0.22)) * 0.7;
      float rZ = noise((p + vec2(0.0, eps)) * 0.85 + vec2(t * 0.45, -t * 0.35)) * 0.35
               + noise((p + vec2(0.0, eps)) * 2.10 + vec2(-t * 0.60, t * 0.50)) * 0.22;
      float fZ = noise((p + vec2(0.0, eps)) * 5.20 + vec2(t * 0.95, t * 0.75)) * 0.14 * (1.0 - distFactor * 0.65);

      vec3 n = vec3((hC - (wX + rX + fX)) * 1.45, 1.0, (hC - (wZ + rZ + fZ)) * 1.45);
      return normalize(n);
    }

    void main() {
      vec3 viewVec = cameraPosition - vWorldPos;
      float dist = length(viewVec);
      vec3 V = viewVec / max(dist, 0.0001);
      float distFactor = smoothstep(40.0, 900.0, dist);

      vec3 N = getWaveNormal(vWorldPos.xz, uTime, distFactor);
      vec3 L = normalize(uMoonDir);
      vec3 H = normalize(L + V);

      // Fresnel term for grazing-angle sky reflection
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      fresnel = clamp(fresnel, 0.04, 0.88);

      // Base sea color
      vec3 waterBase = mix(uDeepWaterColor, uShallowWaterColor, 0.35 + 0.35 * N.x);
      vec3 color = mix(waterBase, uSkyHorizonColor, fresnel * 0.72);

      // Broad silver-blue moonlit sheen across the central water column
      float NdotH = max(dot(N, H), 0.0);
      float broadSheen = pow(NdotH, 28.0) * 0.48;

      // Intense shimmering moonlight path (painterly broken reflection column)
      float mediumGlint = pow(NdotH, 140.0) * 1.45;
      float sharpSparkle = pow(NdotH, 520.0) * 3.8;

      // Subtle dark horizontal cloud-shadow bands across the water reflection (as seen in painting)
      float bandWave = sin(vWorldPos.z * 0.032 + noise(vWorldPos.xz * 0.01) * 3.0);
      float shadowBand = smoothstep(-0.35, 0.45, bandWave) * 0.45 + 0.55;

      vec3 moonReflection = uMoonColor * (broadSheen + mediumGlint + sharpSparkle) * shadowBand;
      color += moonReflection;

      // Gentle shoreline foam / mist near z = 35..80
      float shoreGlow = exp(-pow((vWorldPos.z - 52.0) / 16.0, 2.0)) * 0.05;
      color += uMoonColor * shoreGlow;

      // Atmospheric horizon fog blend
      float fogFactor = smoothstep(180.0, 1150.0, dist);
      color = mix(color, uSkyHorizonColor, fogFactor);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.0;
  scene.add(mesh);

  return {
    mesh,
    update(elapsedTime) {
      uniforms.uTime.value = elapsedTime;
    }
  };
}
