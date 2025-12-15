import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export class FaceTracker {
  constructor() {
    this.faceLandmarker = null;
    this.lastVideoTime = -1;
    this.results = undefined;
    this.isLoaded = false;
  }

  async init() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    );
    this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1
    });
    this.isLoaded = true;
    console.log('FaceLandmarker loaded');
  }

  detect(videoElement, time) {
    if (!this.isLoaded || !this.faceLandmarker) return null;

    if (time !== this.lastVideoTime) {
      this.lastVideoTime = time;
      this.results = this.faceLandmarker.detectForVideo(videoElement, time);
    }
    return this.results;
  }
}
