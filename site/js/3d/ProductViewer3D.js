import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { themeState } from '../state/themeState.js';

export class ProductViewer3D {
  constructor(containerElement, modelType = 'headphones') {
    this.container = containerElement;
    this.modelType = modelType;
    this.width = this.container.clientWidth || 400;
    this.height = this.container.clientHeight || 400;
    this.isDark = themeState.isDark;
    this.isAutoSpin = true;
    this.isWireframe = false;
    this.animationFrameId = null;

    this.initScene();
    this.buildProductModel(this.modelType);
    this.setupLighting();
    this.setupEvents();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 1.5, 5.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 10;
    this.controls.minDistance = 2.5;

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
  }

  buildProductModel(type) {
    // Clear existing
    while (this.modelGroup.children.length > 0) {
      this.modelGroup.remove(this.modelGroup.children[0]);
    }

    const redMat = new THREE.MeshStandardMaterial({
      color: 0xDE2910,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: this.isWireframe
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1E1E1E,
      metalness: 0.6,
      roughness: 0.3,
      wireframe: this.isWireframe
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xC9A227,
      metalness: 0.9,
      roughness: 0.15,
      wireframe: this.isWireframe
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.9,
      opacity: 1,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
      wireframe: this.isWireframe
    });

    if (type === 'headphones') {
      // Headband
      const headbandGeom = new THREE.TorusGeometry(1.4, 0.12, 16, 64, Math.PI);
      const headbandMesh = new THREE.Mesh(headbandGeom, darkMat);
      headbandMesh.rotation.z = Math.PI;
      headbandMesh.position.y = 0.3;
      this.modelGroup.add(headbandMesh);

      // Earcups Left & Right
      [-1.4, 1.4].forEach(x => {
        const cupGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 32);
        const cupMesh = new THREE.Mesh(cupGeom, darkMat);
        cupMesh.rotation.z = Math.PI / 2;
        cupMesh.position.set(x, 0.3, 0);
        this.modelGroup.add(cupMesh);

        // Red Accent Ring
        const ringGeom = new THREE.TorusGeometry(0.56, 0.03, 16, 32);
        const ringMesh = new THREE.Mesh(ringGeom, redMat);
        ringMesh.rotation.y = Math.PI / 2;
        ringMesh.position.set(x > 0 ? x + 0.15 : x - 0.15, 0.3, 0);
        this.modelGroup.add(ringMesh);

        // Gold Trim
        const trimGeom = new THREE.TorusGeometry(0.35, 0.02, 16, 32);
        const trimMesh = new THREE.Mesh(trimGeom, goldMat);
        trimMesh.rotation.y = Math.PI / 2;
        trimMesh.position.set(x > 0 ? x + 0.2 : x - 0.2, 0.3, 0);
        this.modelGroup.add(trimMesh);
      });

    } else if (type === 'watch') {
      // Watch Body
      const bodyGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.35, 32);
      const bodyMesh = new THREE.Mesh(bodyGeom, darkMat);
      this.modelGroup.add(bodyMesh);

      // Gold Bezel
      const bezelGeom = new THREE.TorusGeometry(1.22, 0.06, 16, 32);
      const bezelMesh = new THREE.Mesh(bezelGeom, goldMat);
      bezelMesh.rotation.x = Math.PI / 2;
      this.modelGroup.add(bezelMesh);

      // Screen
      const screenGeom = new THREE.CircleGeometry(1.15, 32);
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        emissive: 0xDE2910,
        emissiveIntensity: 0.25,
        roughness: 0.1
      });
      const screenMesh = new THREE.Mesh(screenGeom, screenMat);
      screenMesh.rotation.x = -Math.PI / 2;
      screenMesh.position.y = 0.18;
      this.modelGroup.add(screenMesh);

      // Strap Top & Bottom
      [-1.3, 1.3].forEach(z => {
        const strapGeom = new THREE.BoxGeometry(0.8, 0.1, 1.4);
        const strapMesh = new THREE.Mesh(strapGeom, darkMat);
        strapMesh.position.set(0, 0, z);
        this.modelGroup.add(strapMesh);
      });

    } else if (type === 'lamp') {
      // Floating Moon Sphere
      const sphereGeom = new THREE.SphereGeometry(1.1, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0xFDFBF7,
        roughness: 0.5,
        emissive: 0xC9A227,
        emissiveIntensity: 0.4
      });
      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
      sphereMesh.position.y = 0.6;
      this.modelGroup.add(sphereMesh);

      // Base Pedestal
      const baseGeom = new THREE.CylinderGeometry(1.4, 1.5, 0.3, 32);
      const baseMesh = new THREE.Mesh(baseGeom, darkMat);
      baseMesh.position.y = -1.1;
      this.modelGroup.add(baseMesh);

      // Base Ring in China Red
      const ringGeom = new THREE.TorusGeometry(1.42, 0.03, 16, 32);
      const ringMesh = new THREE.Mesh(ringGeom, redMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -0.95;
      this.modelGroup.add(ringMesh);

    } else {
      // Default: High-tech container/device box
      const boxGeom = new THREE.BoxGeometry(2, 1.2, 1.5);
      const boxMesh = new THREE.Mesh(boxGeom, darkMat);
      this.modelGroup.add(boxMesh);

      const edgeGeom = new THREE.BoxGeometry(2.05, 0.1, 1.55);
      const edgeMesh = new THREE.Mesh(edgeGeom, redMat);
      this.modelGroup.add(edgeMesh);

      const emblemGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
      const emblemMesh = new THREE.Mesh(emblemGeom, goldMat);
      emblemMesh.rotation.x = Math.PI / 2;
      emblemMesh.position.z = 0.76;
      this.modelGroup.add(emblemMesh);
    }
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.mainLight.position.set(5, 8, 5);
    this.scene.add(this.mainLight);

    this.rimLight = new THREE.DirectionalLight(0xDE2910, 1.0);
    this.rimLight.position.set(-5, -3, -5);
    this.scene.add(this.rimLight);
  }

  toggleWireframe() {
    this.isWireframe = !this.isWireframe;
    this.buildProductModel(this.modelType);
  }

  toggleAutoSpin() {
    this.isAutoSpin = !this.isAutoSpin;
  }

  resetCamera() {
    this.camera.position.set(0, 1.5, 5.5);
    this.controls.reset();
  }

  setModel(type) {
    this.modelType = type;
    this.buildProductModel(type);
  }

  setupEvents() {
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

    if (this.isAutoSpin && this.modelGroup) {
      this.modelGroup.rotation.y += 0.01;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resizeHandler);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
