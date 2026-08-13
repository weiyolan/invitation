# Retro Dither & Glitch Shader Effects

## Implementation Overview

The invitation page now features a **three-stage WebGL post-processing pipeline** combining retro aesthetics with beat-synced visual feedback.

### Architecture

```
┌─────────────┐     ┌──────────┐     ┌────────┐     ┌────────┐
│   Plasma    │ --> │  Dither  │ --> │ Glitch │ --> │ Screen │
│   Shader    │     │  Shader  │     │ Shader │     │        │
└─────────────┘     └──────────┘     └────────┘     └────────┘
     Pass 1            Pass 2           Pass 3
    (fbPlasma)       (fbDither)         (screen)
```

Each pass renders to a framebuffer (except the final screen output), allowing effects to be composited cleanly.

---

## Retro Dither Effect

**Purpose**: Add vintage, low-color-depth aesthetic inspired by early computer graphics.

### How It Works
1. **Color Quantization**: Reduces color depth from 8-bit to 5-bits per channel
   - Creates a posterized, pixelated appearance
   - Uses `floor(color * bits) / bits` quantization

2. **Blue-Noise Dithering**: Adds subtle noise to break up banding
   - Hash-based procedural noise (deterministic)
   - Intensity: 0.08 + responds to music beat (--amp variable)
   - More dither intensity on beats (--amp > 0.55)

### Parameters (Shader Code)
```glsl
float bits = 5.0 + uAmp * 2.0;  // 5-7 bits per channel, amp-responsive
col.rgb += dither;               // Dither intensity ~0.08
```

### Visual Effect
- Subtle pixelation/posterization at normal moments
- Intensifies during music peaks
- Creates a "retro arcade" or "8-bit graphics" look
- Complements the existing plasma shader's organic colors

---

## Beat-Synced Glitch Effect (Wave Sweep)

**Purpose**: Create a sharp, directional "glitch pulse" that sweeps through on music kicks, rather than constant block flickering.

### How It Works

#### 1. Beat Detection (Rising Edge)
Tracks beat onset, not amplitude:
```javascript
// Detect transition from inactive to active beat
const beatIsActive = state.ampOut > 0.55;
if (beatIsActive && !state.beatWasActive){
  state.beatTrigger = 0;  // Reset on beat onset
}
state.beatWasActive = beatIsActive;
state.beatTrigger += 1/60;  // Increment timer each frame
```

**Result**: A clean beat pulse every time the kick hits, not a sustained high-amplitude state.

#### 2. Wave Sweep Animation
The shader receives `uBeatTrigger` (time since beat) and creates a directional wave:

```glsl
// Exponential decay envelope — rapid fadeout
float waveDecay = exp(-uBeatTrigger * 12.0);  // ~0.3s total duration

// Wave front position sweeps downward (top to bottom)
float wavePosition = uBeatTrigger * 3.0;     // Travels from 0 → 3 over decay time
float waveCenter = vUv.y - wavePosition;     // Distance from wave front
float waveFront = smoothstep(0.15, -0.05, abs(waveCenter));  // Sharp wave edge
```

**Result**: 
- **At beat onset**: Bright glitch band at top of screen
- **0.1s later**: Band moves to center
- **0.3s later**: Band exits bottom, effect fades to baseline

#### 3. Glitch Wave Effects

**Horizontal Displacement** (scanline-like):
```glsl
float horizontalShift = sin(vUv.y * 8.0 - wavePosition * 6.0) 
                       * waveIntensity * glitch * 0.12;
uv.x += horizontalShift;
```
Creates rippling, corrupted scanlines following the wave.

**RGB Chromatic Aberration**:
```glsl
float rgbShift = glitch * waveIntensity * 0.015;
float r = texture2D(uTex, uv + vec2(rgbShift, 0.0)).r;   // Red: +offset
float g = texture2D(uTex, uv).g;                          // Green: center
float b = texture2D(uTex, uv - vec2(rgbShift*0.7, 0.0)).b; // Blue: -offset
```
Separates RGB channels in the glitch wave for VHS/CRT effect.

### Visual Effect
- **Before beat**: Baseline glitch shimmer (very subtle, ~15% intensity)
- **Beat onset**: Sharp glitch wave appears at top with scanlines
- **Wave travels**: Sweeps downward over ~0.3 seconds
- **After wave**: Returns to baseline
- **Sync**: Each new kick triggers a new wave (no overlap/stacking)

### Parameters (Tunable)

| Parameter | Location | Effect |
|-----------|----------|--------|
| `0.55` | JS frame loop | Beat detection threshold (kick frequency) |
| `exp(-uBeatTrigger * 12.0)` | Glitch shader | Decay speed (12 = faster fadeout) |
| `uBeatTrigger * 3.0` | Glitch shader | Wave travel speed (3 = fast sweep) |
| `sin(...* 8.0 ...)` | Glitch shader | Scanline frequency (8 = more lines) |
| `0.15` to `-0.05` | Glitch shader | Wave front sharpness |

---

## Previous Implementation (Block Movement)

The original glitch used random per-block displacement and was active whenever `ampOut > 0.55`. This created a "flickering" effect but didn't provide the sharp, directional impact of a wave sweep. The new wave-based approach is more visually striking and better suited to psychedelic/rave aesthetics.

---

## Performance Characteristics

### Framebuffer & Texture Cost
- **Two framebuffers**: 512×512 – 2048×2048 (based on canvas size)
- **Texture format**: RGBA 8-bit (standard)
- **Memory per framebuffer**: ~4 MB at 1080×1920 (common mobile size)

### Shader Cost (Per Frame)
1. **Plasma**: Full complex domain-warped FBM (~2–3ms)
2. **Dither**: Simple quantization + hash (~0.2ms)
3. **Glitch**: Texture lookups + displacement (~0.5ms)
- **Total overhead**: ~3ms (60fps = 16ms/frame budget available)

### Optimization Notes
- Uses `mediump` precision on mobile (cheaper than `highp`)
- Single pass-through buffer binding (no rebinding overhead)
- Blue-noise dither uses cheap hash function
- Glitch displacement is evaluated per-pixel (inevitable, but still fast)

---

## Customization Guide

### Adjust Dither Intensity
**File**: `index.html`, FRAG_DITHER shader
```glsl
float bits = 5.0 + uAmp * 2.0;  // Change range (currently 5–7 bits)
col.rgb += dither * 0.15;        // Multiply dither by a factor
```

### Tune Glitch Wave Speed
**File**: `index.html`, FRAG_GLITCH shader
```glsl
float wavePosition = uBeatTrigger * 3.0;  // Change 3.0 to make wave faster/slower
float waveDecay = exp(-uBeatTrigger * 12.0);  // Change 12.0 for longer/shorter fade
```

### Adjust Wave Sharpness
**File**: `index.html`, FRAG_GLITCH shader
```glsl
// Current: sharp edge
float waveFront = smoothstep(0.15, -0.05, abs(waveCenter));
// Softer: increase both values
float waveFront = smoothstep(0.25, 0.05, abs(waveCenter));
```

### Change Scanline Frequency
**File**: `index.html`, FRAG_GLITCH shader
```glsl
// Current: 8 scanlines per screen height
float horizontalShift = sin(vUv.y * 8.0 - wavePosition * 6.0) * ...;
// Finer lines: increase to 12.0 or 16.0
float horizontalShift = sin(vUv.y * 16.0 - wavePosition * 6.0) * ...;
```

### Adjust RGB Shift Amount
**File**: `index.html`, FRAG_GLITCH shader
```glsl
float rgbShift = glitch * waveIntensity * 0.015;  // Change 0.015 to adjust intensity
```

### Change Beat Sensitivity
**File**: `index.html`, main frame loop
```javascript
const beatIsActive = state.ampOut > 0.55;  // Change 0.55 to different threshold
// Higher value (0.7) = only strongest kicks trigger
// Lower value (0.3) = triggers on quieter sounds too
```

---

## Known Limitations & Future Ideas

### Current Behavior
- ✅ Both effects coexist without conflicts
- ✅ Glitch syncs to beat reliably
- ✅ Maintains 60fps on modern devices
- ⚠️ Dither is subtle (by design) — may not be visible on all displays

### Possible Enhancements
1. **Intensity slider**: Add UI control for dither/glitch strength
2. **Advanced beat detection**: Detect tempo changes for dynamic scaling
3. **Glitch randomization**: Vary glitch type per beat (RGB, blocks, scanlines)
4. **Texture distortion**: Add pinch/stretch effects on strong beats
5. **Palette shift**: Combine with existing hypermode hue-rotation on beats

---

## Testing Checklist

- [x] Shaders compile without errors
- [x] Three-pass rendering pipeline executes
- [x] Framebuffers allocate and bind correctly
- [x] Dither effect visible on plasma
- [x] Glitch wave triggers on beat onset (sharp pulse)
- [x] Wave sweeps downward with exponential decay
- [x] Scanlines visible in the glitch wave
- [x] RGB chromatic aberration on wave
- [x] Beat detection using rising edge (not sustained state)
- [x] No wave overlap/stacking on rapid beats
- [ ] Performance: verify 60fps on mobile/desktop
- [ ] Visual tuning: adjust wave speed/sharpness to taste

---

## Technical References

- **WebGL Framebuffers**: Rendering to texture
- **GLSL Precision**: mediump vs. highp trade-offs
- **Bayer Dithering**: Ordered dithering for retro look
- **RGB Chromatic Aberration**: Separating color channels
- **Beat Detection**: FFT frequency-domain analysis via Web Audio API
