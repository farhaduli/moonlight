import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getTerrainHeight, WORLD_HALF_SIZE } from './terrain.js';

/**
 * First-person walkthrough controller supporting:
 * - Mouse look via PointerLockControls
 * - WASD / Arrow keys movement
 * - Shift to sprint, Space to jump
 * - Terrain-following height + waterline wading limit + 500m world boundary clamping
 */
export class WalkthroughController {
  constructor(camera, domElement, hudElements) {
    this.camera = camera;
    this.domElement = domElement;
    this.hud = hudElements;

    this.controls = new PointerLockControls(camera, domElement);

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.canJump = false;

    this.eyeHeight = 1.75;
    this.walkSpeed = 11.0;
    this.sprintSpeed = 24.0;
    this.gravity = 26.0;
    this.jumpImpulse = 10.5;
    this.bobTimer = 0;

    this._bindEvents();
    this.resetPosition();
  }

  resetPosition() {
    // Start on the scenic dirt trail approaching the rocky coastal overlook
    const startX = -11.5;
    const startZ = 94.0;
    const groundY = getTerrainHeight(startX, startZ);
    this.camera.position.set(startX, groundY + this.eyeHeight, startZ);
    this.velocity.set(0, 0, 0);

    // Face north-northeast toward the two seated figures, moonlit path, and full moon
    this.camera.lookAt(2.0, groundY + 4.5, -60.0);
  }

  _bindEvents() {
    const onKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'Space':
          if (this.canJump) {
            this.velocity.y = this.jumpImpulse;
            this.canJump = false;
          }
          break;
        case 'KeyR':
          this.resetPosition();
          break;
      }
    };

    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  lock() {
    this.controls.lock();
  }

  update(delta) {
    const dt = Math.min(delta, 0.05);

    if (this.controls.isLocked) {
      // Damping
      this.velocity.x -= this.velocity.x * 10.0 * dt;
      this.velocity.z -= this.velocity.z * 10.0 * dt;
      this.velocity.y -= this.gravity * dt;

      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
      this.direction.normalize();

      const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

      if (this.moveForward || this.moveBackward) {
        this.velocity.z -= this.direction.z * speed * 10.0 * dt;
      }
      if (this.moveLeft || this.moveRight) {
        this.velocity.x -= this.direction.x * speed * 10.0 * dt;
      }

      this.controls.moveRight(-this.velocity.x * dt);
      this.controls.moveForward(-this.velocity.z * dt);
      this.camera.position.y += this.velocity.y * dt;

      // Enforce 500m x 500m open-world playable boundary (-245m to +245m)
      const limit = WORLD_HALF_SIZE - 5.0;
      let hitBound = false;

      if (this.camera.position.x < -limit) {
        this.camera.position.x = -limit;
        hitBound = true;
      } else if (this.camera.position.x > limit) {
        this.camera.position.x = limit;
        hitBound = true;
      }

      if (this.camera.position.z < -limit) {
        this.camera.position.z = -limit;
        hitBound = true;
      } else if (this.camera.position.z > limit) {
        this.camera.position.z = limit;
        hitBound = true;
      }

      // Ground & shallow water floor collision
      const groundHeight = getTerrainHeight(this.camera.position.x, this.camera.position.z);
      const walkableFloor = Math.max(groundHeight, -0.35); // Allow wading in shallow surf, prevent drowning
      const minEyeY = walkableFloor + this.eyeHeight;

      if (this.camera.position.y <= minEyeY) {
        this.velocity.y = 0;
        this.camera.position.y = minEyeY;
        this.canJump = true;

        // Subtle head-bob while walking on ground
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 0.6) {
          this.bobTimer += dt * (this.isSprinting ? 13.0 : 8.5);
          this.camera.position.y += Math.sin(this.bobTimer) * 0.055;
        }
      }

      // Update HUD coordinates
      if (this.hud.coords) {
        const px = this.camera.position.x.toFixed(1);
        const pz = this.camera.position.z.toFixed(1);
        const elev = Math.max(0, groundHeight).toFixed(1);
        this.hud.coords.textContent = `Pos: ${px}m, ${pz}m  |  Elev: ${elev}m`;
      }
      if (this.hud.boundsMsg) {
        this.hud.boundsMsg.textContent = hitBound ? '500m World Boundary Reached' : '';
      }
    }
  }
}
