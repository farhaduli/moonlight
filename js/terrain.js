import * as THREE from 'three';
import { fbm, hash2D } from './noise.js';

// World spans 500m x 500m (-250 to +250 on X and Z)
export const WORLD_HALF_SIZE = 250;

/**
 * Evaluates terrain elevation at world coordinates (x, z).
 * - South (z > 0) rises into rugged coastal cliffs and headland overlooking the sea.
 * - North (z < 0) drops below sea level (y = 0) into the open moonlit sea.
 * - A winding dirt footpath leads out onto the rocky promontory tip near (0, 62).
 */
export function getTerrainHeight(x, z) {
  // Coastline curve: bends forward into a central rocky headland around x=0, z=55
  const headlandBulge = 42.0 * Math.exp(-(x * x) / (55.0 * 55.0));
  const bayCurve = 22.0 * Math.sin(x * 0.016) + 12.0 * Math.cos(x * 0.035);
  const coastZ = 75.0 - headlandBulge + bayCurve;

  // Distance inland from shoreline (positive = land, negative = sea)
  const inlandDist = z - coastZ;

  // Base coastal slope
  let height = inlandDist * 0.24;

  // Dramatic rocky cliff face near the shoreline
  if (inlandDist > -12 && inlandDist < 35) {
    const cliffFactor = Math.exp(-Math.pow((inlandDist - 8.0) / 14.0, 2.0));
    height += cliffFactor * 6.5;
  }

  // Rolling hills and rugged coastal ridges inland
  const macroNoise = fbm(x * 0.008 + 3.1, z * 0.008 + 7.4, 5);
  const detailNoise = fbm(x * 0.045 + 11.2, z * 0.045 + 2.8, 4);
  const cragNoise = Math.abs(fbm(x * 0.025, z * 0.025, 3) - 0.5) * 2.0;

  if (inlandDist > -15) {
    const landMask = THREE.MathUtils.smoothstep(inlandDist, -15, 25);
    height += landMask * (macroNoise * 24.0 + detailNoise * 3.8 + cragNoise * 5.5);
  } else {
    // Seafloor depth
    height = Math.max(-28.0, inlandDist * 0.28 - macroNoise * 4.0);
  }

  // Sculpt the iconic rocky promontory path from (x=-35, z=140) out to the cliff tip (x=2, z=48)
  const pathParam = THREE.MathUtils.clamp((145.0 - z) / 97.0, 0.0, 1.0);
  const pathCenterX = -32.0 * Math.pow(1.0 - pathParam, 1.4) + 3.5 * Math.sin(pathParam * Math.PI);
  const distToPath = Math.abs(x - pathCenterX);

  if (z >= 44 && z <= 155 && distToPath < 12.0) {
    // Gentle descending ridge height along the trail
    const targetTrailHeight = 14.5 - pathParam * 4.2 + Math.sin(pathParam * 8.0) * 0.35;
    const blend = 1.0 - THREE.MathUtils.smoothstep(distToPath, 1.8, 11.5);
    height = THREE.MathUtils.lerp(height, targetTrailHeight, blend * 0.92);
  }

  // Steep rise on the left (west) side of the trail like the painterly dark scrub mounds
  if (z >= 48 && z <= 145 && x < pathCenterX - 3.0 && x > pathCenterX - 36.0) {
    const moundProfile = Math.sin(((pathCenterX - 3.0 - x) / 33.0) * Math.PI);
    const bump = fbm(x * 0.06, z * 0.06, 3) * 4.5;
    height += moundProfile * (5.5 + bump);
  }

  return height;
}

/**
 * Returns [0..1] weight indicating whether (x, z) lies on the worn dirt footpath.
 */
export function getPathMask(x, z) {
  if (z < 45 || z > 160) return 0;
  const pathParam = THREE.MathUtils.clamp((145.0 - z) / 97.0, 0.0, 1.0);
  const pathCenterX = -32.0 * Math.pow(1.0 - pathParam, 1.4) + 3.5 * Math.sin(pathParam * Math.PI);
  const distToPath = Math.abs(x - pathCenterX) + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 1.4;
  return 1.0 - THREE.MathUtils.smoothstep(distToPath, 1.1, 2.7);
}

export function createTerrainAndProps(scene) {
  const group = new THREE.Group();

  // 1. High-Resolution 500m x 500m Terrain Mesh
  const size = WORLD_HALF_SIZE * 2;
  const segments = 260;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const cDeepWaterBed = new THREE.Color('#09131f');
  const cWetRock = new THREE.Color('#181f26');
  const cCliffRock = new THREE.Color('#343736');
  const cDarkScrub = new THREE.Color('#172219');
  const cMossGrass = new THREE.Color('#273322');
  const cMoonlitDirt = new THREE.Color('#756852');
  const cMoonlitStone = new THREE.Color('#6b6c68');

  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    const n = fbm(x * 0.08, z * 0.08, 3);
    const pathWeight = getPathMask(x, z);

    if (y < 0.3) {
      tmpColor.copy(cDeepWaterBed).lerp(cWetRock, THREE.MathUtils.clamp((y + 3) / 3.3, 0, 1));
    } else if (y < 3.2) {
      tmpColor.copy(cWetRock).lerp(cCliffRock, (y - 0.3) / 2.9);
    } else {
      // Blend dark coastal vegetation, weathered rock, and warm moonlit footpath
      tmpColor.copy(cDarkScrub).lerp(cMossGrass, n);
      if (n > 0.58) {
        tmpColor.lerp(cCliffRock, (n - 0.58) * 1.8);
      }
      if (pathWeight > 0.01) {
        tmpColor.lerp(cMoonlitDirt, pathWeight * 0.88);
      }
    }

    // Subtle rim highlight on higher ridges facing the north moon
    if (y > 8.0 && z < 110) {
      tmpColor.lerp(cMoonlitStone, 0.14 * n);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
    flatShading: false
  });

  const terrainMesh = new THREE.Mesh(geometry, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  // 2. Instanced Coastal Rocks & Boulders along the cliff edge and trail
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  // Deform rock vertices slightly for organic craggy look
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const scale = 0.82 + 0.36 * hash2D(vx * 13.1 + vy * 7.7, vz * 19.3);
    rPos.setXYZ(i, vx * scale, vy * scale * 0.72, vz * scale);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#3c403e',
    roughness: 0.88,
    metalness: 0.06
  });

  const rockCount = 420;
  const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInstanced.castShadow = true;
  rockInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let placedRocks = 0;
  for (let attempt = 0; attempt < 2400 && placedRocks < rockCount; attempt++) {
    const rx = (hash2D(attempt, 1.3) - 0.5) * 460;
    const rz = 20 + hash2D(attempt, 9.7) * 220;
    const ry = getTerrainHeight(rx, rz);
    const onPath = getPathMask(rx, rz) > 0.45;

    // Concentrate rocks along cliff edges, promontory tip, and beside the path
    if (ry > 0.6 && !onPath) {
      const nearOverlook = Math.hypot(rx, rz - 55) < 40;
      if (nearOverlook || ry < 11.0 || hash2D(attempt, 4.1) > 0.65) {
        dummy.position.set(rx, ry - 0.15, rz);
        dummy.rotation.set(
          hash2D(attempt, 2.1) * Math.PI,
          hash2D(attempt, 3.4) * Math.PI,
          hash2D(attempt, 5.8) * Math.PI
        );
        const s = nearOverlook
          ? 0.35 + hash2D(attempt, 8.2) * 1.15
          : 0.5 + hash2D(attempt, 8.2) * 2.4;
        dummy.scale.set(s * 1.2, s * 0.75, s);
        dummy.updateMatrix();
        rockInstanced.setMatrixAt(placedRocks++, dummy.matrix);
      }
    }
  }
  rockInstanced.count = placedRocks;
  group.add(rockInstanced);

  // 3. Instanced Coastal Scrub Bushes (dark painterly foliage mounds on the cliffs)
  const bushGeo = new THREE.IcosahedronGeometry(1.0, 2);
  const bPos = bushGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i);
    const vy = bPos.getY(i);
    const vz = bPos.getZ(i);
    const n = 0.78 + 0.38 * fbm(vx * 2.5 + 4.0, vz * 2.5 + vy * 2.0, 3);
    bPos.setXYZ(i, vx * n, vy * n * 0.68, vz * n);
  }
  bushGeo.computeVertexNormals();

  const bushMat = new THREE.MeshStandardMaterial({
    color: '#182419',
    roughness: 0.95,
    metalness: 0.0
  });

  const bushCount = 650;
  const bushInstanced = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
  bushInstanced.castShadow = true;
  bushInstanced.receiveShadow = true;

  let placedBushes = 0;
  for (let attempt = 0; attempt < 3500 && placedBushes < bushCount; attempt++) {
    const bx = (hash2D(attempt, 14.2) - 0.5) * 470;
    const bz = 42 + hash2D(attempt, 27.9) * 200;
    const by = getTerrainHeight(bx, bz);
    const onPath = getPathMask(bx, bz) > 0.25;

    if (by > 4.2 && !onPath) {
      dummy.position.set(bx, by - 0.1, bz);
      dummy.rotation.set(0, hash2D(attempt, 31.1) * Math.PI * 2, 0);
      const s = 0.7 + hash2D(attempt, 19.6) * 2.2;
      dummy.scale.set(s * 1.35, s * 0.85, s * 1.25);
      dummy.updateMatrix();
      bushInstanced.setMatrixAt(placedBushes++, dummy.matrix);
    }
  }
  bushInstanced.count = placedBushes;
  group.add(bushInstanced);

  // 4. Two Contemplative Figures Seated at the Cliff Edge Overlook (matching the painting)
  const figuresGroup = createOverlookFigures();
  const figX = 0.4;
  const figZ = 48.2;
  const figY = getTerrainHeight(figX, figZ);
  figuresGroup.position.set(figX, figY, figZ);
  group.add(figuresGroup);

  scene.add(group);
  return group;
}

function createOverlookFigures() {
  const pair = new THREE.Group();
  const silhouetteMat = new THREE.MeshStandardMaterial({
    color: '#11161d',
    roughness: 0.85,
    metalness: 0.05
  });

  // Taller seated figure (left)
  const person1 = new THREE.Group();
  const torso1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 10), silhouetteMat);
  torso1.position.set(0, 0.42, 0);
  torso1.rotation.x = -0.12;
  const head1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), silhouetteMat);
  head1.position.set(0, 0.82, -0.04);
  const cloak1 = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.55, 10), silhouetteMat);
  cloak1.position.set(0, 0.28, 0.03);
  person1.add(torso1, head1, cloak1);

  // Companion seated beside (right)
  const person2 = new THREE.Group();
  const torso2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 6, 10), silhouetteMat);
  torso2.position.set(0.52, 0.34, 0.08);
  torso2.rotation.z = 0.14;
  const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), silhouetteMat);
  head2.position.set(0.49, 0.66, 0.05);
  const cloak2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.44, 10), silhouetteMat);
  cloak2.position.set(0.52, 0.22, 0.1);
  person2.add(torso2, head2, cloak2);

  pair.add(person1, person2);
  pair.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return pair;
}
