let isMonitoring = false;
let audioCtx;
let analyser;
let microphone;
let mediaRecorder;
let recordedChunks = [];
let silenceTimer = null;
let isRecordingClip = false;

const toggleBtn = document.getElementById('toggleBtn');
const thresholdInput = document.getElementById('threshold');
const thresholdVal = document.getElementById('thresholdVal');
const meterBar = document.getElementById('meterBar');
const clipList = document.getElementById('clipList');
const emptyMsg = document.getElementById('emptyMsg');

thresholdInput.addEventListener('input', (e) => {
  thresholdVal.textContent = e.target.value;
});

toggleBtn.addEventListener('click', async () => {
  if (!isMonitoring) {
    await startMonitoring();
  } else {
    stopMonitoring();
  }
});

async function startMonitoring() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    microphone = audioCtx.createMediaStreamSource(stream);
    
    analyser.fftSize = 512;
    microphone.connect(analyser);

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = saveClip;

    isMonitoring = true;
    toggleBtn.textContent = 'Stop Monitoring';
    toggleBtn.classList.add('recording');

    monitorVolume();
  } catch (err) {
    alert('Microphone access is required for this app to work.');
    console.error(err);
  }
}

function stopMonitoring() {
  isMonitoring = false;
  toggleBtn.textContent = 'Start Night Monitoring';
  toggleBtn.classList.remove('recording');

  if (isRecordingClip) {
    mediaRecorder.stop();
    isRecordingClip = false;
  }

  if (audioCtx) audioCtx.close();
  meterBar.style.width = '0%';
}

function monitorVolume() {
  if (!isMonitoring) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const average = sum / dataArray.length;
  const volumePercentage = Math.min(100, Math.round((average / 128) * 100));

  meterBar.style.width = volumePercentage + '%';

  const selectedThreshold = parseInt(thresholdInput.value, 10);

  if (volumePercentage > selectedThreshold) {
    if (!isRecordingClip) {
      startRecordingClip();
    }
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (isRecordingClip) {
        stopRecordingClip();
      }
    }, 2500); // Waits 2.5 seconds of silence before stopping the clip
  }

  requestAnimationFrame(monitorVolume);
}

function startRecordingClip() {
  isRecordingClip = true;
  recordedChunks = [];
  mediaRecorder.start();
}

function stopRecordingClip() {
  isRecordingClip = false;
  mediaRecorder.stop();
}

function saveClip() {
  if (recordedChunks.length === 0) return;

  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const audioUrl = URL.createObjectURL(blob);
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (emptyMsg) emptyMsg.style.display = 'none';

  const clipContainer = document.createElement('div');
  clipContainer.className = 'clip-item';

  const timeLabel = document.createElement('div');
  timeLabel.className = 'clip-info';
  timeLabel.textContent = `Recorded at ${timestamp}`;

  const audioElement = document.createElement('audio');
  audioElement.controls = true;
  audioElement.src = audioUrl;

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'clip-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = () => clipContainer.remove();

  actionsContainer.appendChild(deleteBtn);
  clipContainer.appendChild(timeLabel);
  clipContainer.appendChild(audioElement);
  clipContainer.appendChild(actionsContainer);

  clipList.prepend(clipContainer);
}