export class Recorder {
        constructor(canvas, audioStream) {
                this.canvas = canvas;
                this.audioStream = audioStream; // Optional microphone stream
                this.mediaRecorder = null;
                this.chunks = [];
                this.isRecording = false;
        }

        start() {
                if (this.isRecording) return;

                const canvasStream = this.canvas.captureStream(60); // 60 FPS for smooth motion

                // Combine streams if audio exists
                const tracks = [...canvasStream.getVideoTracks()];
                if (this.audioStream) {
                        tracks.push(...this.audioStream.getAudioTracks());
                }

                const combinedStream = new MediaStream(tracks);

                // Prefer mp4 if available
                const mimeTypes = [
                        'video/mp4',
                        'video/mp4;codecs=avc1',
                        'video/webm;codecs=vp9,opus',
                        'video/webm'
                ];

                let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

                // Increase bitrate for high quality HD/60fps (15 Mbps)
                const options = {
                        mimeType: selectedMime,
                        videoBitsPerSecond: 15000000 // 15 Mbps
                };

                this.mediaRecorder = new MediaRecorder(combinedStream, options);

                this.mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                                this.chunks.push(e.data);
                        }
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                this.chunks = [];

                console.log("Recording started with mime:", selectedMime);
        }

        async stop() {
                if (!this.isRecording) return;

                return new Promise((resolve) => {
                        this.mediaRecorder.onstop = () => {
                                const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
                                this.isRecording = false;
                                this.save(blob);
                                resolve(blob);
                        };
                        this.mediaRecorder.stop();
                });
        }

        save(blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                document.body.appendChild(a);
                a.style = 'display: none';
                a.href = url;
                // Use a generic name with basic timestamp
                const ext = this.mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
                a.download = `ar-filter-${Date.now()}.${ext}`;
                a.click();
                window.URL.revokeObjectURL(url);
        }
}
