import './style.css';
import { FaceTracker } from './ar/FaceTracker.js';
import { Scene } from './ar/Scene.js';
import { NodDetector } from './ar/NodDetector.js';
import { Recorder } from './ui/Recorder.js';

const OPTIONS = [
  "B-BOY", "B-GIRL", "SASSY SALAD",
  "SLOUCHING SHRIMP", "BAG OF CHIPS", "COUCH POTATO",
  "DANCING QUEEN", "PARTY ANIMAL", "CHILL PILL", "ANXIOUS ARTICHOKE", "BAG OF POTATOS", "A$AP ROCKY", "BBOY AMBAL", "BBOY ZUIBOY", "BBOY OLIVER", "PHORESHO", "ANNOYING ORANGE", "SHREK", "HAGRID", "MICKEY MOUSE", "INSPECTOR GADGET", "PATRICK", "NEMO", "PAC PAC", "MENNO", "BBOY PHIL WIZARD", "COUCH POTATO", "BBOY MENNO", "BBOY PAC PAC", "PHORESHO", "A$AP ROCKY", "BBOY AMBAL", "BBOY ZUIBOY", "BBOY OLIVER", "PHORESHO", "ANNOYING ORANGE", "SHREK", "HAGRID", "MICKEY MOUSE", "INSPECTOR GADGET", "PATRICK", "NEMO", "BGIRL AYUMI", "BBOY KID KONG", "BGIRL 671", "BBOY HONG 10", "BBOY DIAS", "BBOY AMIR", "BBOY ISSIN", "BBOY HARUTO", "BBOY JIMMY", "BBOY ISSEI", "BBOY WIGOR", "BBOY ROXRITE", "BBOY VICTOR", "BBOY FULL OF SHIT", "BBOY BAG OF POTATOS", "HAGRID", "NEMO", "KID KOLUMBIA", "BBOY TAISUKE", "BBOY CASPER", "BBOY CLOUD", "BBOY BORN", "BBOY WING", "FULL-OUT FALAFAEL", "PRELIM PICKLE", "CONFUSED BANANA", "DIZZY TOMATO", "WASABI DUMPLING", "BAG OF ONIONS", "BAG OF FLOUR", "ICE ICE BABY", "HUMBLE SWAG"];

// App State
const state = {
  mode: 'IDLE', // IDLE, SPINNING, RESULT, PLAY_AGAIN
  currentOptionIndex: 0,
  spinSpeed: 0,
  spinTime: 0,
  resultTime: 0
};

async function main() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('output_canvas');
  // Hint text removed per request
  const recordBtn = document.getElementById('record-btn');

  // 1. Setup Camera
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: true
  });

  video.srcObject = stream;
  await video.play();

  // 2. Setup Modules
  const faceTracker = new FaceTracker();
  await faceTracker.init();

  const scene = new Scene(canvas, video);
  const nodDetector = new NodDetector();
  const recorder = new Recorder(canvas, stream); // Pass stream for audio

  // 3. UI logic
  recordBtn.addEventListener('click', () => {
    if (recorder.isRecording) {
      recorder.stop();
      recordBtn.classList.remove('recording');
    } else {
      recorder.start();
      recordBtn.classList.add('recording');
    }
  });

  // 4. Update Loop helper functions
  function startSpin() {
    state.mode = 'SPINNING';
    state.spinTime = 0;
  }

  function updateSpin(dt) {
    state.spinTime += dt;

    // Spin for 2 seconds (faster feel)
    if (state.spinTime > 2000) {
      state.mode = 'RESULT';
      state.resultTime = 0;
      // Pick a random winner that is NOT the current one (optional, but pure random is fine)
      const winnerIndex = Math.floor(Math.random() * OPTIONS.length);
      state.currentOptionIndex = winnerIndex;
      scene.updateText(OPTIONS[winnerIndex]);
      return;
    }

    // Cycle rate
    const rate = 80;
    // Random visual effect
    if (state.spinTime % rate < dt + 10) { // Update roughly every 'rate' ms
      const index = Math.floor(Math.random() * OPTIONS.length);
      if (index !== state.currentOptionIndex) {
        state.currentOptionIndex = index;
        scene.updateText(OPTIONS[index]);
      }
    }
  }

  function updateResult(dt) {
    state.resultTime += dt;
    // Show result for 3 seconds then go to PLAY_AGAIN
    if (state.resultTime > 3000) {
      goToPlayAgain();
    }
  }

  function goToPlayAgain() {
    state.mode = 'PLAY_AGAIN';
    scene.updateText("NOD TO PLAY AGAIN");
    // Don't show hint, the 3D text is the hint
  }

  // 5. Main Loop
  let lastTime = 0;

  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = time - lastTime;
    lastTime = time;

    // Detect Faces
    const results = faceTracker.detect(video, time);

    if (results && results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      const matrix = results.facialTransformationMatrixes[0].data;

      // Update AR Anchor
      scene.updateAnchor(matrix);

      // Handle Game Logic
      const nodded = nodDetector.update(matrix, time);

      if (state.mode === 'IDLE') {
        if (nodded) startSpin();
      }
      else if (state.mode === 'PLAY_AGAIN') {
        if (nodded) startSpin();
      }
      else if (state.mode === 'SPINNING') {
        updateSpin(dt);
      }
      else if (state.mode === 'RESULT') {
        updateResult(dt);
      }

      scene.filterGroup.visible = true;
    } else {
      scene.filterGroup.visible = false;
    }

    // Render
    scene.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
