import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { themeState } from '../state/themeState.js';

export class HeroGlobe3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = this.container.clientWidth || 600;
    this.height = this.container.clientHeight || 600;
    this.isDark = themeState.isDark;
    this.animationFrameId = null;

    this.initScene();
    this.createGlobe();
    this.createMarkersAndRoute();
    this.setupLighting();
    this.setupEvents();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 5, 22);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false; // keep layout steady
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.maxPolarAngle = Math.PI / 1.7;
    this.controls.minPolarAngle = Math.PI / 3;

    this.globeGroup = new THREE.Group();
    this.scene.add(this.globeGroup);
  }

  // Convert Latitude & Longitude to 3D Cartesian Vector
  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  createGlobe() {
    const globeRadius = 6.8;
    this.globeRadius = globeRadius;

    // 1. Globe Base Sphere — real world map texture
    const sphereGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const earthTexture = new THREE.TextureLoader().load('../../assets/images/earth-texture.jpg');
    earthTexture.encoding = THREE.sRGBEncoding;

    this.sphereMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      color: this.isDark ? 0x8a8a8a : 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      wireframe: false
    });
    this.sphereMesh = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
    this.globeGroup.add(this.sphereMesh);

    // 2. Latitude & Longitude Grid Lines (subtle overlay on top of the map texture)
    const gridGeometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(globeRadius * 1.002, 24, 24));
    this.gridMaterial = new THREE.LineBasicMaterial({
      color: this.isDark ? 0x555555 : 0xffffff,
      transparent: true,
      opacity: this.isDark ? 0.18 : 0.22
    });
    this.gridMesh = new THREE.LineSegments(gridGeometry, this.gridMaterial);
    this.globeGroup.add(this.gridMesh);

    // 3. Glowing Atmosphere Outer Shell
    const atmosphereGeometry = new THREE.SphereGeometry(globeRadius * 1.15, 32, 32);
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(glowColor, intensity * 0.4);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(this.isDark ? 0xDE2910 : 0xC9A227) }
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    this.atmosphereMesh = new THREE.Mesh(atmosphereGeometry, this.atmosphereMaterial);
    this.scene.add(this.atmosphereMesh);

    // 4. Starfield / Ambient Particles
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 50;
      positions[i + 1] = (Math.random() - 0.5) * 50;
      positions[i + 2] = (Math.random() - 0.5) * 50;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleMaterial = new THREE.PointsMaterial({
      color: this.isDark ? 0xC9A227 : 0xDE2910,
      size: 0.18,
      transparent: true,
      opacity: 0.4
    });
    this.particles = new THREE.Points(particleGeometry, this.particleMaterial);
    this.scene.add(this.particles);
  }

  createMarkersAndRoute() {
    const r = this.globeRadius;

    // China Coordinates (Guangzhou / Yiwu: Lat 23.13, Lon 113.26)
    const chinaCoords = { lat: 23.13, lon: 113.26 };
    this.chinaPos = this.latLonToVector3(chinaCoords.lat, chinaCoords.lon, r);

    // Bangladesh Coordinates (Dhaka / Chittagong: Lat 23.81, Lon 90.41)
    const bdCoords = { lat: 23.81, lon: 90.41 };
    this.bdPos = this.latLonToVector3(bdCoords.lat, bdCoords.lon, r);

    // 1. Location Pin Helper
    const createPin = (pos, color, labelText) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Pin core sphere
      const pinGeom = new THREE.SphereGeometry(0.2, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: color });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      group.add(pinMesh);

      // Outer pulsing ring
      const ringGeom = new THREE.RingGeometry(0.25, 0.45, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      group.add(ringMesh);

      this.globeGroup.add(group);
      return { group, ringMesh };
    };

    this.chinaPin = createPin(this.chinaPos, 0xDE2910, "CHINA");
    this.bdPin = createPin(this.bdPos, 0xC9A227, "BANGLADESH");

    // 2. Arced Bézier 3D Logistics Route from China to Bangladesh
    // Calculate control midpoint elevated above surface
    const midPoint = new THREE.Vector3().addVectors(this.chinaPos, this.bdPos).multiplyScalar(0.5);
    const distance = this.chinaPos.distanceTo(this.bdPos);
    midPoint.normalize().multiplyScalar(r + distance * 0.45); // elevated arc

    this.routeCurve = new THREE.QuadraticBezierCurve3(this.chinaPos, midPoint, this.bdPos);
    const points = this.routeCurve.getPoints(50);
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);

    // Route Glow Line
    const routeMaterial = new THREE.LineBasicMaterial({
      color: 0xDE2910,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    this.routeLine = new THREE.Line(curveGeometry, routeMaterial);
    this.globeGroup.add(this.routeLine);

    // 3. Traveling 3D Cargo Parcel / Container
    const boxGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.25);
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: 0xC9A227, // Gold cargo crate
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xDE2910,
      emissiveIntensity: 0.3
    });
    this.cargoBox = new THREE.Mesh(boxGeometry, boxMaterial);
    this.globeGroup.add(this.cargoBox);

    // Initial globe rotation: face the camera at the China<->Bangladesh midpoint
    const routeMidpoint = this.chinaPos.clone().add(this.bdPos).multiplyScalar(0.5).normalize();
    this.globeGroup.rotation.y = -Math.atan2(routeMidpoint.x, routeMidpoint.z);
    this.globeGroup.rotation.x = 0.15;

    this.cargoProgress = 0;
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(this.isDark ? 0xffffff : 0xffffff, this.isDark ? 0.7 : 1.2);
    this.scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, this.isDark ? 1.5 : 1.2);
    this.dirLight1.position.set(15, 10, 15);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0xDE2910, this.isDark ? 0.8 : 0.4);
    this.dirLight2.position.set(-15, -10, -10);
    this.scene.add(this.dirLight2);
  }

  updateTheme(theme) {
    this.isDark = theme === 'dark';
    if (this.sphereMaterial) {
      this.sphereMaterial.color.setHex(this.isDark ? 0x8a8a8a : 0xffffff);
    }
    if (this.gridMaterial) {
      this.gridMaterial.color.setHex(this.isDark ? 0x555555 : 0xffffff);
      this.gridMaterial.opacity = this.isDark ? 0.18 : 0.22;
    }
    if (this.atmosphereMaterial) {
      this.atmosphereMaterial.uniforms.glowColor.value.setHex(this.isDark ? 0xDE2910 : 0xC9A227);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = this.isDark ? 0.7 : 1.2;
    }
  }

  setupEvents() {
    this.themeUnsub = themeState.subscribe((theme) => this.updateTheme(theme));

    this.resizeHandler = () => {
      if (!this.container) return;
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };

    window.addEventListener('resize', this.resizeHandler);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    // Pulse markers
    if (this.chinaPin && this.chinaPin.ringMesh) {
      const s = 1 + Math.sin(time * 4) * 0.25;
      this.chinaPin.ringMesh.scale.set(s, s, s);
    }
    if (this.bdPin && this.bdPin.ringMesh) {
      const s = 1 + Math.cos(time * 4) * 0.25;
      this.bdPin.ringMesh.scale.set(s, s, s);
    }

    // Animate Cargo Box along the 3D route
    if (this.routeCurve && this.cargoBox) {
      this.cargoProgress = (time * 0.22) % 1; // loop every ~4.5 seconds
      const pointOnCurve = this.routeCurve.getPoint(this.cargoProgress);
      const tangent = this.routeCurve.getTangent(this.cargoProgress);

      this.cargoBox.position.copy(pointOnCurve);
      this.cargoBox.lookAt(pointOnCurve.clone().add(tangent));
      this.cargoBox.rotateZ(time * 3); // subtle rotation
    }

    // Slow ambient starfield drift
    if (this.particles) {
      this.particles.rotation.y = time * 0.02;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.themeUnsub) this.themeUnsub();
    window.removeEventListener('resize', this.resizeHandler);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
