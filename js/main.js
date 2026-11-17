import * as THREE from 'three';
import { createMoonlitSky } from './sky.js';
import { createMoonlitOcean } from './ocean.js';
import { createTerrainAndProps } from './terrain.js';
import { createDistantShips } from './ships.js';
import { WalkthroughController } from './controls.js';

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene & Atmospheric Fog
const scene = new THREE.Scene();
scene.background = new THREE.Color('#091529');
scene.fog = new THREE.FogExp2('#152640', 0.00145);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);

// Moon position vector (centered slightly east of north, ~22 degrees elevation)
const moonDirection = new THREE.Vector3(0.06, 0.36, -0.93).normalize();

// Lighting: Crisp silvery moonlight + soft nocturnal sky fill
const moonLight = new THREE.DirectionalLight('#fff4d4', 2.45);
moonLight.position.copy(moonDirection).multiplyScalar(320);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 20;
moonLight.shadow.camera.far = 650;
const shadowExtent = 160;
moonLight.shadow.camera.left = -shadowExtent;
moonLight.shadow.camera.right = shadowExtent;
moonLight.shadow.camera.top = shadowExtent;
moonLight.shadow.camera.bottom = -shadowExtent;
moonLight.shadow.bias = -0.0005;
scene.add(moonLight);

const hemiLight = new THREE.HemisphereLight('#3b557a', '#101820', 0.65);
scene.add(hemiLight);

// Build World Modules
const sky = createMoonlitSky(scene, moonDirection);
const ocean = createMoonlitOcean(scene, moonDirection);
createTerrainAndProps(scene);
const ships = createDistantShips(scene);

// UI & First-Person Walkthrough Controls
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const hud = document.getElementById('hud');
const coordsEl = document.getElementById('coords');
const boundsMsgEl = document.getElementById('bounds-msg');

const walkthrough = new WalkthroughController(camera, renderer.domElement, {
  coords: coordsEl,
  boundsMsg: boundsMsgEl
});

startBtn.addEventListener('click', () => {
  walkthrough.lock();
});

walkthrough.controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
});

walkthrough.controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
  hud.classList.add('hidden');
});

// Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  sky.update(elapsed);
  ocean.update(elapsed);
  ships.update(elapsed);
  walkthrough.update(delta);

  renderer.render(scene, camera);
}

animate();
