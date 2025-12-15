import * as THREE from 'three';

export class NodDetector {
        constructor() {
                this.pitchHistory = [];
                this.HISTORY_SIZE = 10;
                this.NOD_THRESHOLD = 0.05; // Radians change threshold
                this.consecutiveNods = 0;
                this.lastState = 'neutral'; // 'up', 'down', 'neutral'
                this.cooldown = 0;
        }

        update(matrix, timestamp) {
                if (this.cooldown > 0) {
                        this.cooldown--;
                        return false;
                }

                // Extract Pitch (Rotation around X axis)
                // Three.js Euler generic
                const m = new THREE.Matrix4();
                m.fromArray(matrix);

                const rotation = new THREE.Euler().setFromRotationMatrix(m);
                // rotation.x is roughly pitch if head is aligned

                const pitch = rotation.x;

                this.pitchHistory.push(pitch);
                if (this.pitchHistory.length > this.HISTORY_SIZE) {
                        this.pitchHistory.shift();
                }

                // Check for pattern: Neutral -> Down -> Up -> Neutral or similar
                // Simple heuristic: Delta between Max and Min in history > Threshold

                const min = Math.min(...this.pitchHistory);
                const max = Math.max(...this.pitchHistory);
                const delta = max - min;

                if (delta > 0.3) { // 0.3 rad is ~17 degrees, distinct nod
                        this.pitchHistory = []; // Reset
                        this.cooldown = 30; // 30 frames cooldown (0.5s at 60fps)
                        return true;
                }

                return false;
        }
}
