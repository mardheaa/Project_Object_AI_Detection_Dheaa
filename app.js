// FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBLsOB-gk7M_Z8zTRvt7MO5GhOcKq526X0",
  authDomain: "object-detection-011026.firebaseapp.com",
  projectId: "object-detection-011026",
  storageBucket: "object-detection-011026.firebasestorage.app",
  messagingSenderId: "678449863529",
  appId: "1:678449863529:web:99e7f4b18244dc151b7bf8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase dan Firestore terhubung");

// ELEMENT
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const btnCamera = document.getElementById("btn-camera");
const btnSwitch = document.getElementById("btn-switch");
const btnFlash = document.getElementById("btn-flash");
const btnCapture = document.getElementById("btn-capture");
const btnAI = document.getElementById("btn-ai");

const cameraStatus = document.getElementById("camera-status");
const statusDot = document.getElementById("status-dot");
const cameraPlaceholder = document.getElementById("camera-placeholder");

const objectCount = document.getElementById("object-count");
const personCount = document.getElementById("person-count");

const infoTitle = document.getElementById("info-title");
const infoDescription = document.getElementById("info-description");

const flashIcon = document.getElementById("flash-icon");
const flashScreen = document.getElementById("flash-screen");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const cameraType = document.getElementById("camera-type");

// NAVIGATION
const scannerPage = document.getElementById("scanner-page");
const logPage = document.getElementById("log-page");
const navScanner = document.getElementById("nav-scanner");
const navLog = document.getElementById("nav-log");

const logList = document.getElementById("log-list");
const logBadge = document.getElementById("log-badge");
const btnClearLog = document.getElementById("btn-clear-log");

// STATE
let stream = null;
let facingMode = "environment";
let torchOn = false;
let model = null;
let isDetecting = false;
let animationId = null;
let lastSaveTime = 0;
let toastTimeout;

const COLLECTION_NAME = "aiScannerLogs";
const SAVE_THROTTLE_MS = 3000;
const CONFIDENCE_THRESHOLD = 0.6;

// COCO-SSD OBJECT CLASSES
const TARGET_CLASSES = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
];

// LOAD MODEL
async function loadModel() {
  infoTitle.textContent = "Menyiapkan scanner...";
  infoDescription.textContent = "Model sedang dimuat, tunggu sebentar.";

  try {
    if (!window.cocoSsd) {
      throw new Error("Library COCO-SSD tidak ditemukan");
    }

    model = await window.cocoSsd.load({
      base: "lite_mobilenet_v2",
    });

    console.log("COCO-SSD berhasil dimuat");
    infoTitle.textContent = "Scanner siap";
    infoDescription.textContent = "Aktifkan kamera untuk mulai.";
  } catch (error) {
    console.error("Gagal memuat model:", error);
    infoTitle.textContent = "Model tidak tersedia";
    infoDescription.textContent =
      "Periksa koneksi internet lalu muat ulang halaman.";
  }
}

// START CAMERA
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("Buka aplikasi melalui koneksi HTTPS");
    return;
  }

  try {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    if (isDetecting) {
      stopDetection();
    }

    const constraints = {
      video: {
        facingMode: {
          ideal: facingMode,
        },
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
      },
      audio: false,
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    cameraPlaceholder.style.display = "none";
    statusDot.classList.add("active");

    cameraStatus.textContent =
      facingMode === "environment"
        ? "Kamera belakang aktif"
        : "Kamera depan aktif";

    cameraType.textContent =
      facingMode === "environment" ? "Belakang" : "Depan";

    infoTitle.textContent = "Kamera aktif";
    infoDescription.textContent = "Tekan Scan untuk mendeteksi objek.";

    torchOn = false;
    flashIcon.textContent = "⚡";

    showToast("Kamera berhasil diaktifkan");
  } catch (error) {
    console.error("Camera error:", error);

    cameraStatus.textContent = "Kamera tidak dapat diakses";
    statusDot.classList.remove("active");

    if (error.name === "NotAllowedError") {
      showToast("Izinkan akses kamera di browser");
    } else if (error.name === "NotFoundError") {
      showToast("Kamera tidak ditemukan");
    } else if (error.name === "NotReadableError") {
      showToast("Kamera sedang digunakan aplikasi lain");
    } else {
      showToast("Tidak dapat mengakses kamera");
    }
  }
}

// SWITCH CAMERA
async function switchCamera() {
  if (!stream) {
    showToast("Aktifkan kamera terlebih dahulu");
    return;
  }

  facingMode = facingMode === "environment" ? "user" : "environment";

  await startCamera();
}

// FLASH
async function toggleFlash() {
  if (!stream) {
    showToast("Aktifkan kamera terlebih dahulu");
    return;
  }

  const videoTrack = stream.getVideoTracks()[0];

  if (!videoTrack) {
    showToast("Kamera tidak ditemukan");
    return;
  }

  try {
    const capabilities =
      typeof videoTrack.getCapabilities === "function"
        ? videoTrack.getCapabilities()
        : {};

    if (capabilities.torch !== true) {
      screenFlash();
      showToast("Flash fisik tidak didukung browser ini");
      return;
    }

    const nextTorchState = !torchOn;

    await videoTrack.applyConstraints({
      advanced: [{ torch: nextTorchState }],
    });

    torchOn = nextTorchState;
    flashIcon.textContent = torchOn ? "☼" : "⚡";

    showToast(torchOn ? "Flash kamera aktif" : "Flash kamera mati");
  } catch (error) {
    console.error("Flash error:", error);
    showToast("Flash gagal: " + error.name);
  }
}

// SCREEN FLASH
function screenFlash() {
  if (!flashScreen) return;

  flashScreen.classList.add("active");

  setTimeout(() => {
    flashScreen.classList.remove("active");
  }, 150);
}

// CAPTURE PHOTO
function capturePhoto() {
  if (!stream) {
    showToast("Aktifkan kamera terlebih dahulu");
    return;
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;

  const captureContext = captureCanvas.getContext("2d");

  if (facingMode === "user") {
    captureContext.translate(captureCanvas.width, 0);
    captureContext.scale(-1, 1);
  }

  captureContext.drawImage(
    video,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height,
  );

  screenFlash();

  const image = captureCanvas.toDataURL("image/jpeg", 0.9);
  const link = document.createElement("a");

  link.href = image;
  link.download = `Scanner-${Date.now()}.jpg`;
  link.click();

  showToast("Foto berhasil diambil");
}

// AI DETECTION
async function detectLoop() {
  if (!isDetecting || !stream || !model) return;

  try {
    console.log("Status video:", video.readyState);
    console.log("Ukuran video:", video.videoWidth, video.videoHeight);
    console.log("Model tersedia:", !!model);

    const predictions = await model.detect(video);

    console.log("Hasil deteksi:", predictions);
    
    console.table(
      predictions.map((p) => ({
        objek: p.class,
        keyakinan: (p.score * 100).toFixed(1) + "%",
        bbox: JSON.stringify(p.bbox),
      })),
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const detectedTargets = [];

    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox;
      const confidence = prediction.score;

      if (
        TARGET_CLASSES.includes(prediction.class) &&
        confidence >= CONFIDENCE_THRESHOLD
      ) {
        const confidencePercent = Number((confidence * 100).toFixed(1));

        detectedTargets.push({
          class: prediction.class,
          confidence: confidencePercent,
          bbox: prediction.bbox,
        });

        ctx.strokeStyle = "#38b87c";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        const label = `${prediction.class} ${confidencePercent}%`;

        ctx.font = "600 14px Arial";

        const labelWidth = ctx.measureText(label).width + 12;

        const labelHeight = 24;
        const labelY = Math.max(0, y - labelHeight);

        ctx.fillStyle = "#38b87c";
        ctx.fillRect(x, labelY, labelWidth, labelHeight);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x + 6, labelY + 16);
      }
    });

    objectCount.textContent = detectedTargets.length;

    personCount.textContent = detectedTargets.filter(
      (item) => item.class === "person",
    ).length;

    infoTitle.textContent =
      detectedTargets.length > 0
        ? `${detectedTargets.length} objek terdeteksi`
        : "Tidak ada objek";

    if (
      detectedTargets.length > 0 &&
      Date.now() - lastSaveTime >= SAVE_THROTTLE_MS
    ) {
      lastSaveTime = Date.now();
      await saveToDatabase(detectedTargets);
    }
  } catch (error) {
    console.error("Detection error:", error);
  }

  if (isDetecting) {
    animationId = requestAnimationFrame(detectLoop);
  }
}

// START AI
function startDetection() {
  if (!model) {
    showToast("Scanner masih dimuat...");
    return;
  }

  if (!stream) {
    showToast("Aktifkan kamera terlebih dahulu");
    return;
  }

  if (isDetecting) return;

  isDetecting = true;
  btnAI.classList.add("active");

  infoTitle.textContent = "Sedang memindai";
  infoDescription.textContent = "Mendeteksi objek secara realtime.";

  cameraStatus.textContent = "Scanning";

  detectLoop();
  showToast("Scan dimulai");
}

// STOP AI
function stopDetection() {
  isDetecting = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  btnAI.classList.remove("active");
  objectCount.textContent = "0";
  personCount.textContent = "0";

  if (stream) {
    cameraStatus.textContent =
      facingMode === "environment"
        ? "Kamera belakang aktif"
        : "Kamera depan aktif";

    infoTitle.textContent = "Kamera aktif";
    infoDescription.textContent = "Tekan Scan untuk mendeteksi objek.";
  }
}

// SAVE TO FIRESTORE
async function saveToDatabase(data) {
  try {
    const itemsString = data
      .map((item) => `${item.class} (${item.confidence}%)`)
      .join(", ");

    const payload = {
      items: itemsString,
      count: data.length,
      device_id: "BROWSER-TEST",
      timestamp: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);

    console.log("Data tersimpan ke Firebase:", docRef.id);
    await renderLogs();
  } catch (error) {
    console.error("Gagal menyimpan ke Firebase:", error);
    showToast("Gagal menyimpan ke Firebase");
  }
}

// RENDER LOG
async function renderLogs() {
  try {
    const logsQuery = query(
      collection(db, COLLECTION_NAME),
      orderBy("timestamp", "desc"),
    );

    const snapshot = await getDocs(logsQuery);
    logBadge.textContent = snapshot.size;

    if (snapshot.empty) {
      logList.innerHTML = `
        <div class="empty-log">
          <div>—</div>
          <p>Belum ada data</p>
          <small>Hasil scan akan muncul di sini.</small>
        </div>
      `;
      return;
    }

    logList.innerHTML = "";

    snapshot.forEach((documentSnapshot) => {
      const log = documentSnapshot.data();
      const date = new Date(log.timestamp);
      const logItem = document.createElement("div");

      logItem.className = "log-item";

      logItem.innerHTML = `
        <div class="log-top">
          <div class="log-items">
            ${escapeHTML(log.items || "-")}
          </div>
          <div class="log-time">
            ${date.toLocaleTimeString("id-ID")}
          </div>
        </div>
        <div class="log-detail">
          <span>${log.count || 0} objek</span>
          <span>${escapeHTML(log.device_id || "-")}</span>
        </div>
      `;

      logList.appendChild(logItem);
    });
  } catch (error) {
    console.error("Gagal membaca Firestore:", error);

    logList.innerHTML = `
      <div class="empty-log">
        <div>!</div>
        <p>Gagal mengambil data</p>
        <small>Periksa konfigurasi Firebase.</small>
      </div>
    `;

    logBadge.textContent = "0";
  }
}

// ESCAPE HTML
function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

// CLEAR LOG
async function clearLogs() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));

    if (snapshot.empty) {
      showToast("Tidak ada data untuk dihapus");
      return;
    }

    const batch = writeBatch(db);

    snapshot.forEach((documentSnapshot) => {
      batch.delete(doc(db, COLLECTION_NAME, documentSnapshot.id));
    });

    await batch.commit();
    await renderLogs();

    showToast("Semua log berhasil dihapus");
  } catch (error) {
    console.error("Gagal menghapus log:", error);
    showToast("Gagal menghapus log");
  }
}

// NAVIGATION
function showScanner() {
  scannerPage.classList.add("active");
  logPage.classList.remove("active");
  navScanner.classList.add("active");
  navLog.classList.remove("active");
}

function showLogs() {
  scannerPage.classList.remove("active");
  logPage.classList.add("active");
  navScanner.classList.remove("active");
  navLog.classList.add("active");

  renderLogs();
}

// TOAST
function showToast(message) {
  clearTimeout(toastTimeout);

  toastMessage.textContent = message;
  toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// EVENT LISTENERS
btnCamera.addEventListener("click", startCamera);
btnSwitch.addEventListener("click", switchCamera);
btnFlash.addEventListener("click", toggleFlash);
btnCapture.addEventListener("click", capturePhoto);

btnAI.addEventListener("click", () => {
  if (isDetecting) {
    stopDetection();
  } else {
    startDetection();
  }
});

navScanner.addEventListener("click", showScanner);
navLog.addEventListener("click", showLogs);
btnClearLog.addEventListener("click", clearLogs);

// INITIALIZE
renderLogs();
loadModel();
