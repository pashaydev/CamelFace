import * as THREE from 'three';
import vertexShader from './vertexShader.glsl';
import fragmentShader from './fragmentShader.glsl';
// import GUI from 'lil-gui';
import type { Media, Post } from '../types';
// import { gsap } from 'gsap/all';

const calculateEuler = (isMobile: boolean) => {
	return isMobile
		? { y: 0, x: 0, z: 0 }
		: {
				x: -0.1,
				y: -0.7,
				z: -0.2
		  };
};
const calculatePosition = (isMobile: boolean) => {
	return isMobile
		? { y: -0.02, x: 0, z: -1 }
		: {
				x: window.innerWidth * 0.0012,
				y: 0,
				z: 0
		  };
};

const createGeometry = (isMobile: boolean) => {
	return new THREE.PlaneGeometry(
		isMobile ? 0.58 : window.innerWidth * 0.0016,
		isMobile ? 1.05 : window.innerWidth * 0.0014,
		10,
		10
	);
};

class TravelGalleryScene {
	public isMobile = window.innerWidth < 768;
	private scene: THREE.Scene = new THREE.Scene();
	public camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
		55,
		window.innerWidth / window.innerHeight,
		0.1,
		1000
	);
	// private light: THREE.Light | null = null;
	private raycaster = new THREE.Raycaster();
	public renderer: THREE.WebGLRenderer | null = null;
	private materials: THREE.ShaderMaterial[] = [];
	private material: THREE.ShaderMaterial | null = null;
	public geometry: THREE.PlaneGeometry = createGeometry(this.isMobile);
	// private gui = new GUI();
	public loaderManager = new THREE.LoadingManager();
	private textureLoader = new THREE.TextureLoader(this.loaderManager);
	public groups: THREE.Group[] = [];
	public meshes: THREE.Mesh[] = [];
	public mouse = new THREE.Vector2();
	private width = window.innerWidth;
	private height = window.innerHeight;
	public intersected: THREE.Intersection<THREE.Object3D<THREE.Event>>[] = [];
	private hovered: Record<string, THREE.Intersection> = {};

	public eulerValues = calculateEuler(this.isMobile);
	public positionValues = calculatePosition(this.isMobile);
	private time = 0;
	public backgroundColors: string[] = [];
	public textColors: string[] = [];
	public onClickEvent: ((meshIndex: number) => void) | null = null;
	public handleHoverIn: (() => void) | null = null;
	public handleHoverOut: (() => void) | null = null;

	constructor(canvasElement: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas: canvasElement,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance',
			precision: 'highp'
		});

		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		this.camera.position.set(0, 0, this.isMobile ? 0 : 4);
		this.renderer.setSize(
			window.innerWidth,
			this.isMobile ? window.innerHeight * 0.35 : window.innerHeight
		);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.addObjects();

		this.animate();

		this.scene.add(this.camera);

		window.addEventListener('mousemove', (e) => this.onMouseMove(e));
		window.addEventListener('resize', () => this.resize());
		window.addEventListener('click', (e) => this.onClick(e));
	}

	public onClick(e: MouseEvent) {
		this.intersected.forEach((hit) => {
			const obj = hit.object as THREE.Mesh;
			const meshIndex = this.meshes.findIndex((mesh) => mesh.uuid === obj.uuid);
			if (obj.material instanceof THREE.ShaderMaterial) {
				if (e.target instanceof HTMLElement && e.target.closest('nav')) {
					return;
				}

				if (this.onClickEvent) this.onClickEvent(meshIndex);
			}
		});
	}

	private addObjects() {
		this.material = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			uniforms: {
				time: { value: 0 } as THREE.IUniform,
				texture1: { value: null, type: 't' } as THREE.IUniform,
				resolutions: { value: new THREE.Vector4(), type: 'v4' } as THREE.IUniform,
				distanceFromCenter: { value: 0, type: 'f' } as THREE.IUniform,
				pixels: { value: new THREE.Vector2(1, 1), type: 'v2' } as THREE.IUniform,
				mouse: { value: new THREE.Vector2(0, 0), type: 'v2' } as THREE.IUniform,
				iResolution: { value: new THREE.Vector3(1, 1, 1), type: 'v3' } as THREE.IUniform,
				u_resolution: { value: new THREE.Vector2(1, 1), type: 'v2' } as THREE.IUniform,
				u_mouse: { value: new THREE.Vector2(0, 0), type: 'v2' } as THREE.IUniform,
				u_time: { value: 0, type: 'f' } as THREE.IUniform,
				isMobile: { value: this.isMobile, type: 'b' } as THREE.IUniform
			},
			vertexShader,
			fragmentShader,
			transparent: true
		});
	}

	public async addGallery({ posts }: { posts: Post[] }) {
		const textures = [];

		for (let i = 0; i < posts.length; i++) {
			const texture = this.textureLoader.load(
				(posts[i].backgroundImage as Media).url ?? '',
				(texture) => {
					this.setBackground(texture);
				}
			);

			textures.push(texture);
		}

		textures.forEach((t) => {
			if (!this.material || !this.geometry) return;

			const texture = t;
			const material = this.material.clone();

			const group = new THREE.Group();

			material.uniforms.texture1.value = texture;
			material.uniforms.texture1.value.needsUpdate = true;

			material.uniforms.u_resolution.value = new THREE.Vector3(
				window.innerWidth,
				window.innerHeight,
				1
			);

			const mesh = new THREE.Mesh(this.geometry, material);

			group.add(mesh);

			group.rotation.set(this.eulerValues.x, this.eulerValues.y, this.eulerValues.z);
			mesh.position.set(this.positionValues.x, this.positionValues.y, this.positionValues.z);

			this.scene.add(group);

			this.meshes.push(mesh);
			this.materials.push(material);
			this.groups.push(group);
		});
	}

	public setBackground(texture: THREE.Texture) {
		const imgRatio = texture.image.width / texture.image.height;
		const planeRatio = innerWidth / innerHeight;
		const ratio = planeRatio / imgRatio;

		texture.repeat.x = ratio;
		texture.offset.x = 0.5 * (1 - ratio);
	}

	public resize() {
		this.isMobile = window.innerWidth < 768;

		this.width = window.innerWidth;
		this.height = this.isMobile ? window.innerHeight * 0.35 : window.innerHeight;
		this.camera.aspect = this.width / this.height;

		this.positionValues = calculatePosition(this.isMobile);
		this.eulerValues = calculateEuler(this.isMobile);
		this.geometry = createGeometry(this.isMobile);

		const newPositions: [x: number, y: number, z: number] = [
			this.positionValues.x,
			this.positionValues.y,
			this.positionValues.z
		];
		const newEuler: [x: number, y: number, z: number] = [
			this.eulerValues.x,
			this.eulerValues.y,
			this.eulerValues.z
		];

		this.groups.forEach((group, idx) => {
			group.rotation.set(...newEuler);
			this.meshes[idx].position.set(...newPositions);
			this.meshes[idx].geometry = this.geometry;
		});

		if (this.renderer) this.renderer.setSize(this.width, this.height);
	}

	public onMouseMove(e: MouseEvent) {
		// events
		this.mouse.set((e.clientX / this.width) * 2 - 1, -(e.clientY / this.height) * 2 + 1);
		this.raycaster.setFromCamera(this.mouse, this.camera);
		this.intersected = this.raycaster.intersectObjects(this.scene.children, true);

		// If a previously hovered item is not among the hits we must call onPointerOut
		Object.keys(this.hovered).forEach((key) => {
			const hit = this.intersected.find((hit) => hit.object.uuid === key);
			if (hit === undefined) {
				document.body.style.cursor = '';
				if (this.handleHoverOut) {
					if (e.target instanceof HTMLElement && e.target.closest('nav')) {
						return;
					}
					this.handleHoverOut();
				}
				// const hoveredItem = this.hovered[key];
				delete this.hovered[key];
			}
		});

		this.intersected.forEach((hit) => {
			document.body.style.cursor = 'pointer';
			// If a hit has not been flagged as hovered we must call onPointerOver
			if (!this.hovered[hit.object.uuid]) {
				this.hovered[hit.object.uuid] = hit;

				if (this.handleHoverIn) {
					this.handleHoverIn();
				}
			}
			const obj = hit.object as THREE.Mesh;
			if (obj.material instanceof THREE.ShaderMaterial) {
				obj.material.uniforms.mouse.value = this.mouse;
				obj.material.uniforms.u_mouse.value = this.mouse;
			}
		});
	}

	private animate() {
		requestAnimationFrame(() => this.animate());

		if (this.renderer) this.renderer.render(this.scene, this.camera);

		this.time += 0.05;

		this.materials.forEach((material) => {
			material.uniforms.time.value = this.time;
			material.uniforms.u_time.value = this.time;
		});
	}
}

export default TravelGalleryScene;
