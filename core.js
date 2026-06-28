// ──────────────────────────────────────────────────────────────
//  EOSS Barcode Scanner — core.js
//  Mobile-first retail staff tool for End of Season Sale
// ──────────────────────────────────────────────────────────────

'use strict';

// ── State ──────────────────────────────────────────────────────
const state = {
  barcodeMap: new Map(),        // barcode → offer (fast O(1) lookup)
  scanHistory: [],              // [{barcode, offer, time}]
  scanning: false,
  videoStream: null,
  scanInterval: null,
  voiceEnabled: false,
  lastScanned: null,            // debounce duplicate scans
  lastScannedTime: 0,
};

// ── DOM refs ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  statusDot:       $('statusDot'),
  statusText:      $('statusText'),
  fileInput:       $('fileInput'),
  uploadBtn:       $('uploadBtn'),
  dataBadge:       $('dataBadge'),
  uploadSection:   $('uploadSection'),
  scanBtn:         $('scanBtn'),
  scanBtnText:     $('scanBtnText'),
  cameraContainer: $('cameraContainer'),
  video:           $('video'),
  manualInput:     $('manualInput'),
  manualSubmit:    $('manualSubmit'),
  resultCard:      $('resultCard'),
  resultEyebrow:   $('resultEyebrow'),
  resultOffer:     $('resultOffer'),
  resultBarcode:   $('resultBarcode'),
  resultTime:      $('resultTime'),
  historyList:     $('historyList'),
  clearBtn:        $('clearBtn'),
  exportBtn:       $('exportBtn'),
  toast:           $('toast'),
  voiceToggle:     $('voiceToggle'),
  toggleSwitch:    $('toggleSwitch'),
};

// ── Offer classification ───────────────────────────────────────
function classifyOffer(offer) {
  const o = (offer || '').toUpperCase().trim();
  if (o === 'B1G1') return 'b1g1';
  if (o === 'B1G2') return 'b1g2';
  if (o.startsWith('FLAT')) return 'flat';
  if (o === 'NOT FOUND') return 'error';
  return 'other';
}

// ── CSV Parser (handles quoted fields, CRLF, BOM) ─────────────
function parseCSV(text) {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/);
  const map = new Map();

  let headerSkipped = false;
  for (const line of lines) {
    if (!line.trim()) continue;

    // Split on comma (simple — barcodes & offers won't have commas)
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const barcode = parts[0].replace(/^["'\s]+|["'\s]+$/g, '').trim();
    const offer   = parts[1].replace(/^["'\s]+|["'\s]+$/g, '').trim();

    // Skip header row
    if (!headerSkipped && isNaN(barcode) && barcode.toUpperCase() === 'BARCODE') {
      headerSkipped = true;
      continue;
    }
    if (!barcode || !offer) continue;

    // Store with original case & uppercase for lookup
    map.set(barcode, offer);
    map.set(barcode.toUpperCase(), offer);
  }
  return map;
}

// ── File upload handler ────────────────────────────────────────
dom.uploadBtn.addEventListener('click', () => dom.fileInput.click());

dom.fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  dom.uploadBtn.innerHTML = '<span class="spinner"></span> Loading…';
  dom.uploadBtn.disabled = true;

  try {
    const text = await file.text();
    const map = parseCSV(text);

    if (map.size === 0) {
      showToast('⚠️ No valid data found in file');
      return;
    }

    state.barcodeMap = map;
    persistData(map);

    // Update UI
    const count = map.size / 2; // we store both cases
    dom.dataBadge.textContent = `✅ ${Math.round(count).toLocaleString()} barcodes loaded`;
    dom.dataBadge.classList.remove('hidden');
    dom.uploadSection.classList.add('has-data');
    setStatus('ready', 'Ready to scan');
    showToast(`✅ Loaded ${Math.round(count).toLocaleString()} barcodes`);

  } catch (err) {
    showToast('❌ Could not read file');
    console.error(err);
  } finally {
    dom.uploadBtn.innerHTML = '📂 Choose CSV / Excel file';
    dom.uploadBtn.disabled = false;
    dom.fileInput.value = '';
  }
});

// ── Persist to localStorage (offline) ─────────────────────────
function persistData(map) {
  try {
    // Store as JSON array of pairs to survive page refresh
    const pairs = [];
    const seen = new Set();
    for (const [k, v] of map) {
      // Only store lowercase/original version to halve size
      if (!seen.has(k.toUpperCase())) {
        pairs.push([k, v]);
        seen.add(k.toUpperCase());
      }
    }
    localStorage.setItem('eoss_barcodes', JSON.stringify(pairs));
  } catch (e) {
    // localStorage quota exceeded — skip silently
  }
}

function loadPersistedData() {
  try {
    const raw = localStorage.getItem('eoss_barcodes');
    if (!raw) return;
    const pairs = JSON.parse(raw);
    const map = new Map();
    for (const [k, v] of pairs) {
      map.set(k, v);
      map.set(k.toUpperCase(), v);
    }
    if (map.size > 0) {
      state.barcodeMap = map;
      const count = map.size / 2;
      dom.dataBadge.textContent = `✅ ${Math.round(count).toLocaleString()} barcodes (cached)`;
      dom.dataBadge.classList.remove('hidden');
      dom.uploadSection.classList.add('has-data');
      setStatus('ready', 'Ready · cached data');
    }
  } catch (e) { /* ignore */ }
}

// ── Barcode lookup ─────────────────────────────────────────────
function lookupBarcode(barcode) {
  const b = barcode.trim();
  return state.barcodeMap.get(b)
      || state.barcodeMap.get(b.toUpperCase())
      || null;
}

function processBarcode(barcode) {
  const b = barcode.trim();
  if (!b) return;

  // Debounce: ignore same barcode within 2s
  const now = Date.now();
  if (b === state.lastScanned && now - state.lastScannedTime < 2000) return;
  state.lastScanned = b;
  state.lastScannedTime = now;

  const offer = lookupBarcode(b);
  const time  = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (offer) {
    showResult(b, offer, time);
    addToHistory(b, offer, time);
    if (state.voiceEnabled) speakOffer(offer);
  } else {
    if (state.barcodeMap.size === 0) {
      showResult(b, 'NO DATA', time, true);
      showToast('⚠️ Upload a barcode master file first');
    } else {
      showResult(b, 'NOT FOUND', time, true);
      addToHistory(b, 'NOT FOUND', time);
      if (state.voiceEnabled) speakOffer('Not found');
    }
  }

  // Stop camera after successful scan
  if (state.scanning) stopCamera();
}

// ── Result display ─────────────────────────────────────────────
function showResult(barcode, offer, time, isError = false) {
  const card = dom.resultCard;

  // Remove all class variants
  card.className = 'result-card';

  if (!isError) {
    card.classList.add(classifyOffer(offer));
    dom.resultEyebrow.textContent = 'OFFER';
  } else {
    card.classList.add(offer === 'NO DATA' ? 'other' : 'error');
    dom.resultEyebrow.textContent = offer === 'NO DATA' ? 'ACTION NEEDED' : 'SCAN RESULT';
  }

  dom.resultOffer.textContent  = offer;
  dom.resultBarcode.textContent = barcode;
  dom.resultTime.textContent   = `Scanned at ${time}`;

  // Flash animation
  requestAnimationFrame(() => {
    card.classList.add('flash');
    card.addEventListener('animationend', () => card.classList.remove('flash'), { once: true });
  });
}

// ── History ────────────────────────────────────────────────────
function addToHistory(barcode, offer, time) {
  state.scanHistory.unshift({ barcode, offer, time });
  renderHistory();
}

function renderHistory() {
  const list = dom.historyList;

  if (state.scanHistory.length === 0) {
    list.innerHTML = '<div class="history-empty">No scans yet this session</div>';
    return;
  }

  list.innerHTML = state.scanHistory.map((item, i) => {
    const cls = classifyOffer(item.offer);
    return `
      <div class="history-item">
        <span class="history-offer-badge badge-${cls}">${item.offer}</span>
        <div class="history-detail">
          <div class="history-barcode">${item.barcode}</div>
          <div class="history-time">${item.time}</div>
        </div>
      </div>
    `;
  }).join('');
}

dom.clearBtn.addEventListener('click', () => {
  if (state.scanHistory.length === 0) return;
  state.scanHistory = [];
  state.lastScanned = null;
  renderHistory();
  showToast('🗑️ History cleared');
});

// ── Export CSV ─────────────────────────────────────────────────
dom.exportBtn.addEventListener('click', () => {
  if (state.scanHistory.length === 0) {
    showToast('No scans to export');
    return;
  }

  const rows = ['Barcode,Offer,Time', ...state.scanHistory.map(i => `${i.barcode},${i.offer},${i.time}`)];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `eoss_scan_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export downloaded');
});

// ── Camera scanning (Quagga2 — best for retail 1D barcodes) ────
dom.scanBtn.addEventListener('click', toggleCamera);

function toggleCamera() {
  if (state.scanning) {
    stopCamera();
    return;
  }

  state.scanning = true;
  dom.cameraContainer.classList.add('active');
  dom.scanBtn.classList.add('scanning');
  dom.scanBtnText.textContent = 'Stop Camera';

  Quagga.init({
    inputStream: {
      name: 'Live',
      type: 'LiveStream',
      target: dom.video,
      constraints: {
        facingMode: 'environment',
        width:  { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 },
      },
    },
    locator: {
      patchSize: 'medium',
      halfSample: false,
    },
    numOfWorkers: 0,
    frequency: 10,
    decoder: {
      readers: [
        'code_128_reader',
        'code_39_reader',
        'ean_reader',
        'ean_8_reader',
        'upc_reader',
        'upc_e_reader',
        'i2of5_reader',
      ],
    },
    locate: true,
  }, function(err) {
    if (err) {
      state.scanning = false;
      dom.cameraContainer.classList.remove('active');
      dom.scanBtn.classList.remove('scanning');
      dom.scanBtnText.textContent = 'Scan Barcode';
      if (err.name === 'NotAllowedError' || (err.message && err.message.includes('ermission'))) {
        showToast('📷 Camera permission denied — check site settings');
      } else {
        showToast('📷 Camera error — try manual entry');
      }
      console.error('Quagga init error:', err);
      return;
    }
    Quagga.start();
  });

  let lastCode = null, lastCount = 0;
  Quagga.onDetected(function(result) {
    if (!state.scanning) return;
    const code = result && result.codeResult && result.codeResult.code;
    if (!code) return;
    if (code === lastCode) { lastCount++; } else { lastCode = code; lastCount = 1; }
    if (lastCount >= 2) {
      lastCode = null; lastCount = 0;
      navigator.vibrate && navigator.vibrate(80);
      processBarcode(code);
    }
  });
}

function stopCamera() {
  state.scanning = false;
  try { Quagga.stop(); } catch(e) {}
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(t => t.stop());
    state.videoStream = null;
  }
  dom.video.srcObject = null;
  dom.cameraContainer.classList.remove('active');
  dom.scanBtn.classList.remove('scanning');
  dom.scanBtnText.textContent = 'Scan Barcode';
}

// Stop button inside viewfinder
$('stopCameraBtn').addEventListener('click', stopCamera);

// ── Manual entry ───────────────────────────────────────────────
dom.manualSubmit.addEventListener('click', submitManual);
dom.manualInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitManual();
});

function submitManual() {
  const val = dom.manualInput.value.trim();
  if (!val) return;
  processBarcode(val);
  dom.manualInput.value = '';
}

// ── Voice ──────────────────────────────────────────────────────
dom.voiceToggle.addEventListener('click', () => {
  state.voiceEnabled = !state.voiceEnabled;
  dom.toggleSwitch.classList.toggle('on', state.voiceEnabled);
  showToast(state.voiceEnabled ? '🔊 Voice on' : '🔇 Voice off');
});

function speakOffer(offer) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(`Offer: ${offer}`);
  utter.rate  = 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  window.speechSynthesis.speak(utter);
}

// ── Status helpers ─────────────────────────────────────────────
function setStatus(type, text) {
  dom.statusDot.className  = `status-dot${type === 'ready' ? ' ready' : ''}`;
  dom.statusText.textContent = text;
}

// ── Toast ──────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2800);
}

// ── Boot ───────────────────────────────────────────────────────
(function init() {
  loadPersistedData();
  renderHistory();

  // Check camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    dom.scanBtn.disabled = true;
    dom.scanBtn.title    = 'Camera not supported in this browser';
    showToast('📷 Camera not available — use manual entry');
  }

  // Focus manual input on page load for fast manual entry
  setTimeout(() => dom.manualInput.focus(), 300);
})();
