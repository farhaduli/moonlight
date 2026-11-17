import * as THREE from 'three';

/**
 * Distant 19th-century sailing ships silhouetted on the moonlit horizon,
 * gently bobbing with the sea swells (matching the two ships in the painting).
 */
export function createDistantShips(scene) {
  const shipsGroup = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: '#0e1622',
    roughness: 0.8,
    metalness: 0.1
  });

  const sailMat = new THREE.MeshStandardMaterial({
    color: '#2d3a4b',
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  function buildTallShip(scale = 1.0) {
    const ship = new THREE.Group();

    // Hull
    const hullGeo = new THREE.BoxGeometry(2.4, 1.1, 9.5);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.4;
    ship.add(hull);

    // Bowsprit
    const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 3.6, 6), hullMat);
    bowsprit.position.set(0, 1.1, 5.6);
    bowsprit.rotation.x = Math.PI / 2.4;
    ship.add(bowsprit);

    // Three masts with square & triangular sails
    const mastPositions = [-2.6, 0.2, 2.8];
    const mastHeights = [6.2, 7.6, 5.8];

    mastPositions.forEach((mz, idx) => {
      const mh = mastHeights[idx];
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, mh, 6), hullMat);
      mast.position.set(0, mh * 0.5 + 0.6, mz);
      ship.add(mast);

      // Lower & upper sails
      const sailW = idx === 1 ? 3.2 : 2.5;
      const lowerSail = new THREE.Mesh(new THREE.PlaneGeometry(sailW, mh * 0.36), sailMat);
      lowerSail.position.set(0, mh * 0.42 + 0.6, mz + 0.12);
      ship.add(lowerSail);

      const upperSail = new THREE.Mesh(new THREE.PlaneGeometry(sailW * 0.78, mh * 0.28), sailMat);
      upperSail.position.set(0, mh * 0.76 + 0.6, mz + 0.12);
      ship.add(upperSail);
    });

    ship.scale.setScalar(scale);
    return ship;
  }

  // Right-side three-masted barque clearly silhouetted near the moonlight path
  const mainShip = buildTallShip(1.55);
  mainShip.position.set(95, 0, -290);
  mainShip.rotation.y = Math.PI * 0.42;
  shipsGroup.add(mainShip);

  // Farther faint vessel near the center-left horizon
  const distantShip = buildTallShip(0.85);
  distantShip.position.set(-28, 0, -440);
  distantShip.rotation.y = -Math.PI * 0.35;
  shipsGroup.add(distantShip);

  scene.add(shipsGroup);

  return {
    update(elapsedTime) {
      mainShip.position.y = Math.sin(elapsedTime * 0.7) * 0.22;
      mainShip.rotation.z = Math.sin(elapsedTime * 0.55) * 0.035;
      mainShip.rotation.x = Math.cos(elapsedTime * 0.45) * 0.02;

      distantShip.position.y = Math.cos(elapsedTime * 0.65 + 1.2) * 0.18;
      distantShip.rotation.z = Math.cos(elapsedTime * 0.5 + 0.8) * 0.03;
    }
  };
}
