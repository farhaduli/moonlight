import * as THREE from 'three';

/**
 * Procedural Night Sky Dome with:
 * - Deep Prussian / midnight blue zenith transitioning to misty slate horizon
 * - Glowing full moon disc + atmospheric silver-cream halo
 * - Multi-layered drifting cumulus clouds rim-lit by the moon
 * - Subtle faint stars in clear sky patches
 */
export function createMoonlitSky(scene, moonDirection) {
  const skyGeo = new THREE.SphereGeometry(1400, 48, 32);

  const uniforms = {
    uTime: { value: 0 },
    uMoonDir: { value: moonDirection.clone().normalize() },
    uZenithColor: { value: new THREE.Color('#091529') },
    uMidSkyColor: { value: new THREE.Color('#132642') },
    uHorizonColor: { value: new THREE.Color('#1d314f') },
    uMoonColor: { value: new THREE.Color('#fff7de') }
  };

  const vertexShader = /* glsl */ `
    varying vec3 vWorldDir;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldDir = normalize(worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uMoonDir;
    uniform vec3 uZenithColor;
    uniform vec3 uMidSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uMoonColor;

    varying vec3 vWorldDir;

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

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.04;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldDir);
      vec3 moonDir = normalize(uMoonDir);
      float elev = clamp(dir.y, 0.0, 1.0);

      // Sky vertical gradient
      vec3 sky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, elev));
      sky = mix(sky, uZenithColor, smoothstep(0.25, 0.85, elev));

      // Moon angular distance
      float cosAngle = dot(dir, moonDir);
      float angle = acos(clamp(cosAngle, -1.0, 1.0));

      // Soft atmospheric moonlight halo
      float outerHalo = exp(-angle * 4.5) * 0.34;
      float innerHalo = exp(-angle * 16.0) * 0.55;
      sky += uMoonColor * (outerHalo + innerHalo);

      // Crisp luminous full moon disc (radius ~ 0.026 rad)
      float moonDisc = 1.0 - smoothstep(0.022, 0.026, angle);
      // Subtle lunar maria (surface mottling)
      float maria = fbm(dir.xy * 65.0 + 3.0);
      vec3 moonSurface = uMoonColor * (1.28 - 0.16 * maria);
      sky = mix(sky, moonSurface, moonDisc);

      // Subtle stars in higher dark sky
      if (elev > 0.12 && moonDisc < 0.1) {
        vec2 starGrid = floor(dir.xz / (dir.y + 0.35) * 140.0);
        float starVal = hash(starGrid);
        if (starVal > 0.9965) {
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + starVal * 100.0);
          sky += vec3(0.75, 0.82, 0.95) * twinkle * smoothstep(0.12, 0.45, elev) * 0.45;
        }
      }

      // Billowing nocturnal clouds projected onto upper hemisphere
      if (dir.y > 0.02) {
        vec2 cloudUv = dir.xz / (dir.y + 0.16) * 1.15;
        cloudUv += vec2(uTime * 0.0045, uTime * 0.0018);

        float n1 = fbm(cloudUv);
        float n2 = fbm(cloudUv * 2.3 - vec2(uTime * 0.003, 0.0));
        float cloudDensity = smoothstep(0.47, 0.78, n1 * 0.75 + n2 * 0.3);

        // Fade clouds softly near the horizon
        cloudDensity *= smoothstep(0.02, 0.16, dir.y);

        // Silver-cream rim lighting on clouds near the moon
        float moonProximity = exp(-angle * 3.8);
        float edgeLight = smoothstep(0.76, 0.46, n1 * 0.75 + n2 * 0.3);

        vec3 cloudShadow = vec3(0.07, 0.12, 0.21);
        vec3 cloudMid = vec3(0.22, 0.30, 0.42);
        vec3 cloudRim = uMoonColor * (0.45 + 0.85 * moonProximity);

        vec3 cloudColor = mix(cloudShadow, cloudMid, 0.45 + 0.55 * moonProximity);
        cloudColor = mix(cloudColor, cloudRim, edgeLight * (0.28 + 0.72 * moonProximity));

        // Let the bright moon disc shine subtly through thin cloud edges
        float occlusion = cloudDensity * (1.0 - moonDisc * 0.65);
        sky = mix(sky, cloudColor, occlusion * 0.92);
      }

      gl_FragColor = vec4(sky, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false
  });

  const dome = new THREE.Mesh(skyGeo, material);
  scene.add(dome);

  return {
    dome,
    update(elapsedTime) {
      uniforms.uTime.value = elapsedTime;
    }
  };
}
