# Development Setup

## Quick Start

### Option 1: Bash Script (No Dependencies)
```bash
# Make executable
chmod +x dev-server.sh

# Run
./dev-server.sh
```
Then open http://localhost:3000 in your browser.

### Option 2: Python (No Dependencies)
```bash
# Start server
python3 -m http.server 3000

# Open in browser
open http://localhost:3000  # macOS
# or
xdg-open http://localhost:3000  # Linux
# or paste into browser manually
```

### Option 3: Node.js Dev Server (With Live-Reload)
```bash
# Install optional file watcher (one-time)
npm install --save-dev chokidar

# Run server with live-reload
node dev-server.js
```
The page will auto-refresh when you save HTML, JS, or CSS files.

### Option 4: VS Code Live Server Extension
1. Install "Live Server" extension by Ritwick Dey
2. Right-click `index.html` → "Open with Live Server"
3. Automatically serves on port 5500 with live-reload

---

## Testing the Shaders

### Local Testing Workflow
1. Start the dev server (pick any option above)
2. Open http://localhost:3000 (or 5500 for Live Server)
3. **Edit shaders** in `index.html` — look for:
   - `FRAG_PLASMA` — domain-warped plasma
   - `FRAG_DITHER` — retro color quantization
   - `FRAG_GLITCH` — beat-triggered wave sweep
4. **Save the file**
5. **Refresh browser** (Cmd+R / Ctrl+R) to see changes

### Quick Shader Tuning
Edit these values in `index.html`:

**Glitch Wave Speed**: ~Line 660
```glsl
float wavePosition = uBeatTrigger * 3.0;  // Change 3.0 to speed up/slow down
```

**Glitch Decay Speed**: ~Line 658
```glsl
float waveDecay = exp(-uBeatTrigger * 12.0);  // Higher = faster decay
```

**Dither Intensity**: ~Line 625
```glsl
float bits = 5.0 + uAmp * 2.0;  // More/less posterization
```

**Beat Sensitivity**: ~Line 1175
```javascript
const beatIsActive = state.ampOut > 0.55;  // Adjust threshold
```

---

## Testing on Mobile (HTTPS Required)

The page needs HTTPS for:
- Device orientation (tilt)
- Web Audio API (music playback)

### Option 1: Deploy to GitHub Pages (Recommended)
Push to `main` branch — automatically deployed to https://weiyolan.github.io/invitation/

### Option 2: Local HTTPS with Self-Signed Cert
```bash
# Generate self-signed cert (macOS/Linux)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes

# Serve with HTTPS
python3 -m http.server 3000 --cert cert.pem --key key.pem
```
Then open https://localhost:3000 (browser will warn about untrusted cert — click through).

### Option 3: ngrok Tunnel
```bash
# Install ngrok: https://ngrok.com/
ngrok http 3000
# Share the https:// link with your phone
```

---

## Browser DevTools Tips

### Inspect WebGL
1. Open DevTools (F12 / Cmd+Option+I)
2. Go to **Console** tab
3. Type: `window.__hasWebGL` → should be `true`
4. Type: `state.ampOut` → watch music amplitude in real-time
5. Type: `state.beatTrigger` → watch glitch timer (0–0.5s)

### Debug Shader Performance
1. Open **Performance** tab
2. Record while music plays (▶ tap to begin)
3. Look for frame rate (should be 60fps)
4. Each frame should take <16ms

### Network Issues
1. Open **Network** tab
2. Check that `AudioCutter_astrix-deep-jungle-walk.mp3` loads
3. Fonts load from googleapis.com (or fall back to system fonts)

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use a different port
python3 -m http.server 8000
```

### Audio Not Playing
- Check browser console for errors (F12)
- Audio requires user interaction — tap "▶ TAP TO BEGIN"
- HTTPS required on mobile devices
- Check volume (page shows volume hint)

### Shaders Not Changing After Edit
- Make sure you saved the file
- Hard refresh: Cmd+Shift+R (macOS) or Ctrl+Shift+R (Windows/Linux)
- Check browser console for shader compile errors

### Performance Issues
- Close other tabs/apps
- Check GPU temperature (discrete GPU on laptop)
- Reduce canvas size (dev-server can scale viewport)
- Profile with Chrome DevTools Performance tab

---

## Helpful Commands

```bash
# Kill all Node processes
pkill -f node

# Kill specific port
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Watch file sizes
du -sh .

# Open URL in default browser (various OS)
open http://localhost:3000           # macOS
xdg-open http://localhost:3000       # Linux
start http://localhost:3000          # Windows PowerShell
```

---

## File Structure Reference

```
invitation/
├── index.html              # Main single-file app (shaders live here)
├── src/
│   └── AudioCutter_astrix-deep-jungle-walk.mp3
├── dev-server.sh           # Bash dev server (no deps)
├── dev-server.js           # Node dev server with live-reload
├── SHADER_EFFECTS.md       # Detailed shader docs
└── README.md               # Project README
```
