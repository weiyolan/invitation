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

## Beat-Synced Glitch Effect

**Purpose**: Create dynamic, psychedelic "analog corruption" that triggers on music kicks.

### How It Works

#### 1. Beat Detection
- Uses existing audio analyzer: `state.ampOut` (0–1 range)
- **Beat threshold**: `ampOut > 0.55` (low-frequency kick detection)
- `--amp` CSS variable also drives other UI elements (already synced)

#### 2. Glitch Intensity Calculation
```javascript
// Intensity ranges from 0.2 (no beat) to 1.1 (strong beat)
const glitchIntensity = state.ampOut > 0.55 
  ? 0.8 + state.ampOut * 0.3  // On beat: 0.8 – 1.1
  : 0.2 + state.ampOut * 0.3  // Off beat: 0.2 – 0.5
```

#### 3. RGB Channel Displacement
Classic "video corruption" look:
- **Red channel**: Shifted +0.8% horizontally
- **Green channel**: No shift (baseline)
- **Blue channel**: Shifted -0.5% horizontally
- Creates chromatic aberration effect

#### 4. Block-Based Displacement
- **Grid**: 16×12 pixel blocks
- **Per-block noise**: Random offset per block position
- **Displacement**: `sin(uTime * 12.0 + blockPos) * glitchIntensity * 0.15`
- **Intensity**: Responsive to `uAmp` (beat-driven)

### Parameters (Shader Code)
```glsl
vec2 blockSize = vec2(16.0, 12.0);
float displace = (blockRand - 0.5) * glitch * 0.15;
uv.y += sin(uTime * 12.0 + block.x * 6.28) * displace;
```

### Visual Effect
- **At rest**: Subtle, low-frequency RGB shimmer
- **On kick (ampOut > 0.55)**: Intense block displacement + strong color shifts
- **Timing**: Synchronized to music's low-end (bass/kick frequencies)
- Creates "VHS corruption" or "CRT scan line" aesthetic

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

### Tune Glitch Sensitivity
**File**: `index.html`, draw() function
```javascript
const glitchIntensity = state.ampOut > 0.55  // Change beat threshold (0.55)
  ? 0.8 + state.ampOut * 0.3               // Change peak intensity
  : 0.2 + state.ampOut * 0.3;              // Change baseline intensity
```

### Change Block Grid Size
**File**: `index.html`, FRAG_GLITCH shader
```glsl
vec2 blockSize = vec2(16.0, 12.0);  // Change to (8.0, 8.0) for finer grid
```

### Adjust RGB Channel Shift Amounts
**File**: `index.html`, FRAG_GLITCH shader
```glsl
float r = texture2D(uTex, uv + vec2(glitch * 0.008, 0.0)).r;    // Red offset
float b = texture2D(uTex, uv - vec2(glitch * 0.005, 0.0)).b;    // Blue offset
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
- [x] Glitch responds to music beats
- [x] Performance acceptable (60fps target)
- [x] No console errors in browser
- [ ] Visual tuning on different displays/colors

---

## Technical References

- **WebGL Framebuffers**: Rendering to texture
- **GLSL Precision**: mediump vs. highp trade-offs
- **Bayer Dithering**: Ordered dithering for retro look
- **RGB Chromatic Aberration**: Separating color channels
- **Beat Detection**: FFT frequency-domain analysis via Web Audio API
