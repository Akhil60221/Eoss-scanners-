# EOSS Barcode Scanner
### Retail Staff Tool — End of Season Sale Stock Segregation

---

## 📁 Folder Structure

```
eoss-scanner/
├── index.html              ← Main app (open this in browser)
├── css/
│   └── style.css           ← All styles
├── js/
│   └── core.js             ← App logic, scanning, CSV parsing
├── data/
│   └── barcode_master.csv  ← Sample barcode data
└── README.md               ← This file
```

---

## ⚡ Quick Start (2 minutes)

### Option A — GitHub Pages (Recommended, Free)

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click **"New repository"** → name it `eoss-scanner` → set to **Public** → click **Create**
3. Click **"uploading an existing file"**
4. Drag all files/folders from this project into the upload area
5. Click **"Commit changes"**
6. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
7. After ~2 minutes, your app is live at:
   `https://YOUR-USERNAME.github.io/eoss-scanner/`

Share that URL with staff — they open it in **Chrome on Android**.

---

### Option B — Run Locally (No internet needed after first load)

1. Open the `eoss-scanner` folder
2. Double-click `index.html`
3. The app opens in your browser
4. **Note:** Camera scanning requires HTTPS (GitHub Pages). For local use, staff can use **manual barcode entry** or connect a Bluetooth barcode scanner (it types into the manual input field automatically).

---

## 📋 How to Use — Step-by-Step Guide for Staff

### First Time Setup

1. **Open the link** in Chrome on your Android phone
2. Tap **"📂 Choose CSV / Excel file"**
3. Select the `barcode_master.csv` file
4. Wait for the green badge: ✅ **X barcodes loaded**
5. The app is now ready — it remembers the data even if you close and reopen

### Scanning Products

**Method 1 — Camera Scan:**
1. Tap the big **"📷 Scan Barcode"** button
2. Allow camera permission when asked (one time only)
3. Point camera at the product barcode
4. The offer appears instantly in large text
5. Camera closes automatically after each scan

**Method 2 — Manual Entry:**
1. Type or paste the barcode in the text box at the bottom of the scanner
2. Tap **"Go →"** or press Enter
3. The offer appears instantly

**Method 3 — Bluetooth Scanner:**
1. Pair your Bluetooth barcode gun with the phone
2. Tap the manual entry box once
3. Scan with the gun — it auto-submits

### Understanding the Offer Display

| Colour | Offer |
|--------|-------|
| 🟢 Green | B1G1 — Buy 1 Get 1 Free |
| 🔵 Blue | B1G2 — Buy 1 Get 2 Free |
| 🟠 Orange | FLAT 60% (or any FLAT discount) |
| 🔴 Red | Other offers / Not Found |

### Voice Announcement
- Tap the **Voice toggle** to hear the offer read aloud after each scan
- Useful when hands are full sorting merchandise

### Session History
- Every scan is logged with timestamp automatically
- Tap **Export** to download a CSV of today's scans
- Tap **Clear** to reset history for a new session

---

## 📄 Barcode Master File Format

### CSV Format (Recommended)

Save as `.csv` with UTF-8 encoding:

```csv
Barcode,Offer
VM1949578,B1G2
VM1949579,B1G1
VM1949580,FLAT 60%
VM1949581,FLAT 50%
VM1949582,B1G2
```

### Rules
- **Column 1:** Barcode (any format — EAN13, Code128, alphanumeric)
- **Column 2:** Offer text exactly as you want it displayed
- First row must be the header: `Barcode,Offer`
- No spaces inside offer codes: use `B1G1` not `B1 G1`
- Supported offer values: `B1G1`, `B1G2`, `FLAT 60%`, `FLAT 50%`, `FLAT 30%`, or any custom text

### How to Export from Excel as CSV
1. Open your Excel file
2. **File → Save As → CSV UTF-8 (Comma delimited)**
3. Upload this `.csv` file in the app

### Updating the Barcode Master
Simply upload a new CSV file anytime — it replaces the previous data and saves to the phone's browser cache for offline use.

---

## 🔧 Technical Details

| Feature | Implementation |
|---------|---------------|
| Barcode scanning | ZXing library (free, open source) |
| Lookup speed | JavaScript Map — O(1), handles 50,000+ barcodes |
| Offline storage | Browser localStorage |
| Camera | getUserMedia API, rear-facing camera preferred |
| Supported formats | EAN-13, EAN-8, Code128, Code39, QR, DataMatrix, UPC |
| Hosting | GitHub Pages (free) |

### Supported Browsers
- ✅ Chrome on Android (recommended)
- ✅ Chrome on iOS
- ✅ Safari on iOS (camera may need permission reset)
- ✅ Any modern desktop browser (manual entry only if no camera)

---

## 🛠️ Customization

### Add new offer colour codes
In `css/style.css`, find the `:root` block and add new colour variables.
In `js/core.js`, update the `classifyOffer()` function:

```javascript
function classifyOffer(offer) {
  const o = (offer || '').toUpperCase().trim();
  if (o === 'B1G1') return 'b1g1';
  if (o === 'B1G2') return 'b1g2';
  if (o.startsWith('FLAT')) return 'flat';
  if (o === 'NOT FOUND') return 'error';
  return 'other';   // ← catches everything else in red
}
```

### Change app name / logo
Edit the header section in `index.html`:
```html
<div class="header-title">EOSS Scanner</div>   ← change this
<div class="header-logo">🏷️</div>               ← change emoji
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera permission denied | Go to Chrome Settings → Site Settings → Camera → Allow |
| Barcode not scanning | Clean camera lens; try manual entry as backup |
| "No data" after upload | Check CSV has `Barcode,Offer` header on row 1 |
| App slow on old phone | Close other apps; use manual entry (faster than camera) |
| Data lost after closing | Re-upload CSV; app caches it but browser may clear cache |
| Export not downloading | Check phone storage permissions for Chrome |

---

## 📞 Support

For issues with the app, contact your IT team and share:
1. Phone model and Android version
2. Chrome version (Settings → About Chrome)
3. Screenshot of the error
