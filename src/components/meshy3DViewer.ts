// src/components/meshy3DViewer.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Meshy3DViewer {
    private container: HTMLElement;
    private modelUrl: string;
    private viewerElement: HTMLElement | null = null;
    private currentRenderer: any = null;
    private currentControls: any = null;
    private resizeHandler: (() => void) | null = null;

    constructor(container: HTMLElement, modelUrl: string) {
        this.container = container;
        this.modelUrl = modelUrl;
    }

    /**
     * Create and inject the 3D viewer into the page
     */
    async createViewer(): Promise<void> {
        try {
            // Create viewer container
            this.viewerElement = document.createElement('div');
            this.viewerElement.className = 'meshy-3d-viewer';
            this.viewerElement.style.cssText = `
                width: 100%;
                height: 500px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                background: #f8f9fa;
                position: relative;
                overflow: hidden;
            `;

            // Add loading state
            this.viewerElement.innerHTML = `
                <div class="viewer-loading" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #666;
                ">
                    <div style="font-size: 24px; margin-bottom: 16px;">🔄</div>
                    <div style="font-size: 16px; margin-bottom: 8px;">Loading 3D Model...</div>
                    <div style="font-size: 12px; color: #999;">This may take a few moments</div>
                </div>
            `;

            // Add to container
            this.container.appendChild(this.viewerElement);

            // Try to load the model
            await this.loadModel();

        } catch (error) {
            console.error('Error creating 3D viewer:', error);
            this.showError('Failed to create 3D viewer');
        }
    }

    /**
     * Load the 3D model
     */
    private async loadModel(): Promise<void> {
        try {
            // Check if the model URL is accessible
            const response = await fetch(this.modelUrl, { method: 'HEAD' });
            
            if (!response.ok) {
                throw new Error(`Model not accessible: ${response.status}`);
            }

            // Create 3D model viewer using Three.js
            await this.create3DViewer();

        } catch (error) {
            console.error('Error loading 3D model:', error);
            this.showError('Failed to load 3D model');
        }
    }

    /**
     * Create 3D model viewer using Three.js
     */
    private async create3DViewer(): Promise<void> {
        if (!this.viewerElement) return;

        try {
            // Create scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf0f0f0);

            // Create camera
            const camera = new THREE.PerspectiveCamera(75, this.viewerElement.clientWidth / this.viewerElement.clientHeight, 0.1, 1000);
            camera.position.set(0, 0, 5);

            // Create renderer
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(this.viewerElement.clientWidth, this.viewerElement.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            directionalLight.castShadow = true;
            scene.add(directionalLight);

            // Load the 3D model
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(this.modelUrl);
            
            // Add model to scene
            scene.add(gltf.scene);

            // Auto-adjust camera to fit model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            
            camera.position.z = cameraZ * 1.5;
            camera.lookAt(center);

            // Add controls
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.screenSpacePanning = false;
            controls.minDistance = 1;
            controls.maxDistance = 50;

            // Animation loop
            const animate = () => {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            };
            animate();

            // Handle window resize
            const handleResize = () => {
                const width = this.viewerElement!.clientWidth;
                const height = this.viewerElement!.clientHeight;
                
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            };
            window.addEventListener('resize', handleResize);

            // Clear loading state and add renderer
            this.viewerElement.innerHTML = '';
            this.viewerElement.appendChild(renderer.domElement);

            // Store references for cleanup
            this.currentRenderer = renderer;
            this.currentControls = controls;
            this.resizeHandler = handleResize;

        } catch (error) {
            console.error('Error creating 3D viewer:', error);
            this.showError('Failed to load 3D model');
        }
    }



    /**
     * Show error message
     */
    private showError(message: string): void {
        if (!this.viewerElement) return;

        this.viewerElement.innerHTML = `
            <div class="viewer-error" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #d32f2f;
                text-align: center;
                padding: 20px;
            ">
                <div style="font-size: 24px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 16px; margin-bottom: 8px;">Error Loading 3D Model</div>
                <div style="font-size: 12px; color: #666; line-height: 1.4;">${message}</div>
                <div style="font-size: 11px; margin-top: 8px; color: #999; font-style: italic; line-height: 1.3;">
                    If you just created this model, it may take a few minutes to generate. Please try again later.
                </div>
                <button class="retry-btn" style="
                    margin-top: 16px;
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">🔄 Retry</button>
            </div>
        `;

        // Add retry functionality
        const retryBtn = this.viewerElement.querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadModel();
            });
        }
    }

    /**
     * Destroy the viewer
     */
    destroy(): void {
        // Clean up Three.js resources
        if (this.currentRenderer) {
            this.currentRenderer.dispose();
            this.currentRenderer = null;
        }
        
        if (this.currentControls) {
            this.currentControls.dispose();
            this.currentControls = null;
        }
        
        // Remove resize handler
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        // Remove viewer element
        if (this.viewerElement && this.viewerElement.parentNode) {
            this.viewerElement.parentNode.removeChild(this.viewerElement);
        }
        this.viewerElement = null;
    }
}
