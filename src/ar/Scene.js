import * as THREE from 'three';

export class Scene {
        constructor(canvasElement, videoElement) {
                this.canvas = canvasElement;
                this.video = videoElement;

                // Setup Renderer
                this.renderer = new THREE.WebGLRenderer({
                        canvas: this.canvas,
                        alpha: true, // Transparent bg so we can see video behind if needed, but we'll use a video plane
                        antialias: true
                });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(window.devicePixelRatio);

                // Setup Scene & Camera
                this.scene = new THREE.Scene();

                // Orthographic camera for 1:1 mapping with video feed if possible, 
                // but PerspectiveCamera is better for 3D attachment.
                // We'll use a PerspectiveCamera and try to match the MediaPipe FOV.
                const fov = 63; // Approximate MediaPipe FOV
                this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.z = 10; // Start back a bit

                // Lighting
                const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
                this.scene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
                directionalLight.position.set(0, 5, 5);
                this.scene.add(directionalLight);

                // Filter Text Group (The "Hat")
                this.filterGroup = new THREE.Group();
                this.scene.add(this.filterGroup);

                // Text Sprite
                this.textSprite = this.createTextSprite("NOD TO START");
                this.filterGroup.add(this.textSprite);
                this.textSprite.position.y = 2; // Offset above head (approx, will tune)

                // Resize Handler
                window.addEventListener('resize', this.onResize.bind(this));

                // Background Video Plane
                this.videoTexture = new THREE.VideoTexture(this.video);
                this.videoTexture.colorSpace = THREE.SRGBColorSpace;
                this.videoTexture.minFilter = THREE.LinearFilter;
                this.videoTexture.magFilter = THREE.LinearFilter;

                // We need a plane that fills the screen. 
                // A simple approach effectively is to render the video as a background, 
                // or use a full-screen quad. 
                // Detailed "Instagram-like" requires the video to FILL screen (object-fit: cover).
                // We used to set scene.background here but we now use a plane for full control.

                // Note: scene.background with videoTexture will stretch to fit the viewport 
                // if we don't handle aspect ratio carefully.
                // A better approach for exact alignment is a PlaneGeometry that scales to match aspect.
                this.setupBackgroundPlane();
        }

        setupBackgroundPlane() {
                this.scene.background = null; // Clear background property

                const geometry = new THREE.PlaneGeometry(1, 1);
                const material = new THREE.MeshBasicMaterial({ map: this.videoTexture });
                this.bgPlane = new THREE.Mesh(geometry, material);
                this.bgPlane.position.z = -100; // Far back
                this.bgPlane.name = "background_video";
                this.scene.add(this.bgPlane);
        }

        updateBackgroundDimensions() {
                // Force the plane to cover the screen at its depth
                // Plane is at z = -100
                // Camera is perspective at z = 10
                const distance = 100 + 10;
                const vFov = this.camera.fov * Math.PI / 180;
                const planeHeight = 2 * Math.tan(vFov / 2) * distance;
                const planeWidth = planeHeight * this.camera.aspect;

                // Video aspect
                if (!this.video.videoWidth) return;

                const videoAspect = this.video.videoWidth / this.video.videoHeight;
                const planeAspect = planeWidth / planeHeight; // Should match camera aspect? Yes.

                // To COVER: ensure both dimensions are >= plane dimensions

                let scaleX, scaleY;

                if (planeAspect > videoAspect) {
                        // Screen is wider than video
                        // Fit width, crop height? No, for COVER we need to fit the LARGER dimension relative to aspect

                        // If screen is super wide, we need video to match width.
                        // planeWidth / videoWidth (scaled) must be 1?

                        // Let's standard logic:
                        // if (screenAspect > videoAspect) scale based on Width
                        // else scale based on Height

                        scaleX = planeWidth;
                        scaleY = planeWidth / videoAspect;
                } else {
                        // Screen is taller than video
                        scaleY = planeHeight;
                        scaleX = planeHeight * videoAspect;
                }

                this.bgPlane.scale.set(scaleX, scaleY, 1);
        }

        createTextSprite(message) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Canvas size
                canvas.width = 1200; // Wider canvas to prevent cutoff
                canvas.height = 512;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Simple White Arial Text
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const fontSize = 120; // Slightly smaller to ensure fit

                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = "white";

                // Add a slight drop shadow just for legibility against video
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowBlur = 10;
                ctx.fillText(message, centerX, centerY);

                // Create Texture
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({
                        map: texture,
                        transparent: true,
                        depthTest: false,
                        depthWrite: false
                });
                const sprite = new THREE.Sprite(material);

                // Scale sprite
                const width = 40; // Wider in 3D space too
                const height = width * (canvas.height / canvas.width); // Match aspect

                // NO MIRRORING:
                // User requested "Discard the flipping... treat is a normal video."
                // So we use POSITIVE scale.
                sprite.scale.set(width, height, 1);

                return sprite;
        }

        updateText(text) {
                const newSprite = this.createTextSprite(text);

                // Nuclear cleanup to prevent "ghost" double text
                // Clear the entire group to be safe (since it only holds the text)
                this.filterGroup.clear();

                this.textSprite = newSprite;
                this.filterGroup.add(this.textSprite);

                // Reset position (updateAnchor logic will move it, but good defaults help)
                this.textSprite.position.set(0, 20, 0);
        }

        updateAnchor(matrix) {
                // matrix is a 4x4 matrix from MediaPipe (column-major)
                // We need to apply it to filterGroup
                // Note: MediaPipe matrix might need conversion to Three.js coordinate system

                const m = new THREE.Matrix4();
                m.fromArray(matrix);

                // Decompose to get pos, quat, scale
                const position = new THREE.Vector3();
                const quaternion = new THREE.Quaternion();
                const scale = new THREE.Vector3();
                m.decompose(position, quaternion, scale);

                // Update Group
                // Coordinate systems are tricky. MediaPipe often assumes Z forward or similar.
                // Three.js is Y up, -Z forward.
                // Also MediaPipe coords are often normalized or in a specific range.
                // For FaceLandmarker with facialTransformationMatrixes:
                // "The matrix is a 4x4 OpenGL primitive transformation matrix... 
                // It transforms a point from the face coordinate system to the input image coordinate system."
                // Input image coord system: X right, Y down, Z into screen (sometimes).

                // Let's rely on empirical adjustment or standard conversion.
                // Standard webgl: X right, Y up, Z out.
                // Video/Image: X right, Y down.

                // We might just use the matrix directly if we flip Y?

                this.filterGroup.position.copy(position);
                this.filterGroup.quaternion.copy(quaternion);
                this.filterGroup.scale.copy(scale);

                // Heuristic Adjustments
                // MediaPipe Z might be negative
                // Also we often need to invert X for mirrored view

                // Offset text ABOVE head (in local space of the head?)
                // Originally 30, user said "too far ahead from forehead" (meaning too high? or Z?)
                // "Too far ahead" usually means Z, but attached to face center means it might form a large radius.
                // If it's Y offset in face local space, it is "above" the head.
                // Let's reduce height to be closer to forehead.
                this.textSprite.position.set(0, 25, 0); // Tweaked to be visually pleasing above head
        }

        render() {
                if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
                        this.videoTexture.needsUpdate = true;
                        this.updateBackgroundDimensions();
                }
                this.renderer.render(this.scene, this.camera);
        }

        onResize() {
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.renderer.setSize(w, h);
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
        }
}
