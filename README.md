# three-material-regress-harness

> Takes a screenshot of a Three.js / R3F scene, compares it to a reference image from another renderer (KeyShot, Fusion, Rhino, KeyShot-neutral studio shots), and reports exactly how close they match. Use it to tune Three.js materials until they reproduce the reference, then run the same harness in CI to catch any drift.

An installable, cloneable, dual-mode visual regression harness that diffs a `@react-three/fiber` scene against external-renderer baselines. The GUI lets you scrub a `MaterialDefinition` slider and watch the pixel metric update in real time; the CLI runs the same pipeline headlessly (Playwright-managed Chromium) and exits non-zero on tolerance breach.

## How it works (one paragraph)

Constructs a `THREE.WebGLRenderer` on an `OffscreenCanvas` at an explicit framebuffer size, renders the target mesh + material + pose + HDRI in two passes (shader warm-up + capture), reads RGBA pixels via `gl.readPixels`, then compares to a reference PNG. Four metrics are computed over the **union of the candidate and reference object silhouettes** (so the arbitrary background never contaminates the score): per-channel RGB RMSE, pixel-mismatch percentage with antialias guard, mean SSIM on Rec.709 luma across 8×8 tiles, and max per-channel Δ. A verdict is `pass` iff every metric is at or below its configured tolerance.

## What lives in this repo

| Layer | Path | Purpose |
| ----- | ---- | ------- |
| Harness | `src/harness/` | `Harness`, `HarnessController`, pose math, schema, config, realtime diff, parameter sweep, CMA-ES solver |
| Recorder | `src/recorder/` | PNG encode/decode, `diffImages`, `makeDiffPng`, silhouette mask, SSIM, tolerances |
| Runner | `src/runner/` | `run()`, per-test runner, duration, watch mode, CLI (`tmrh`), JSON/HTML/JUnit reporters |
| Stores | `src/stores/` | Six zustand stores (harness, renderer, recording, regression, screenshot, test) |
| Components | `src/components/` | React/R3F GUI (`App`, `Renderer`, `Material`, `Scene`, `ShaderTypeRegistry`, GUI panels) |
| Shaders | `src/shaders/` | Ported KeyShot-fidelity shader handlers (lux_toon, metallic_paint, lux_translucent, lux_velvet, lux_anisotropic, lux_glass, lux_gem, lux_xray, lux_flat) with auto-registration |

## Install

```sh
npm install three-material-regress-harness
```

Peer dependencies (declared, expected in the consumer tree):

- `three` ^0.184.0
- `@react-three/fiber` ^9.6.0
- `@react-three/drei` ^10.0.0
- `react` ^19.2.0
- `react-dom` ^19.2.0
- `zustand` ^5.0.12
- `kmp-three-suite` — optional (only needed if consuming `.kmp` inputs)

## Quick start — GUI

```sh
git clone <this repo>
cd three-material-regress-harness
npm install
npm run dev                # Vite on http://127.0.0.1:4175
```

Three-column live GUI:

- **Left:** test tree (variants × views, loaded from a manifest or drag-and-drop).
- **Centre:** live R3F canvas + external-renderer reference + composite diff.
- **Right:** `MaterialDefinition` inspector, metrics panel, sweep panel, CMA-ES solver panel. Drag a slider, the diff metric refreshes at ≥ 4 Hz.

Drag a `.kmp` or a `materialDefinition.json` onto the window to load a new material.

## Quick start — headless regression

```sh
npm ci
npx playwright install chromium           # one-time
npx tmrh run \
  --corpus samples-to-match-identically-kmp-files \
  --baseline baselines \
  --out out/runs \
  --report all
```

Exit code `0` on pass, `1` on tolerance breach. Reports land in `out/runs/<timestamp>-<git-sha>/`:

- `report.json` — canonical structured report
- `report.html` — human-facing side-by-side with thumbnails
- `report.junit.xml` — CI-consumable
- `captures/<testId>.png` — Three.js-rendered candidate
- `diffs/<testId>.diff.png` — three-pane `[candidate | reference | diff-highlighted]` for every failing test

## Programmatic API

```javascript
import { createHarness } from 'three-material-regress-harness'

const harness = createHarness({
  corpus:   './samples-to-match-identically-kmp-files',
  baseline: './baselines',
  out:      './out/runs',
  workers:  4,
  tolerances: {
    rmse: 0.5, pixelMismatchPct: 0.5, ssim: 0.005,
    maxChannelDiff: 10, silhouetteOnly: true,
  },
  report: ['json', 'html', 'junit'],
  updateBaselines: false,
})

const report = await harness.run()
if (report.failCount > 0) process.exit(1)
```

### One-shot in-page capture

```javascript
import { Harness, diffImages } from 'three-material-regress-harness'

const h = new Harness({
  materialDefinition: { color: '#cc5500', roughness: 0.35, metalness: 0, kmpShaderType: null },
  geometry: { type: 'sphere', radius: 1, widthSegments: 64, heightSegments: 64 },
  pose: {
    cameraPosition: [0, 0, 3], cameraTarget: [0, 0, 0], cameraUp: [0, 1, 0],
    cameraFov: 45, imageWidth: 1024, imageHeight: 1024,
  },
  environment: 'studio_small_2k',
})

const capture = await h.capture()
const diff = diffImages(capture.pixels, referencePixels, { width: 1024, height: 1024 })
h.dispose()
```

## CLI reference

```text
tmrh [command] [options]

Commands:
  run                       Run a regression pass (default)
  serve                     Start the Vite GUI dev server
  update-baselines          Promote the latest captures into baselines/
  align-poses               Pose-alignment pre-pass for missing pose.json files
  report <run-dir>          Re-render HTML/JUnit from an existing report.json

Options:
  --corpus <dir>            default: ./samples-to-match-identically-kmp-files
  --baseline <dir>          default: ./baselines
  --out <dir>               default: ./out/runs
  --filter <glob>           run only matching test ids / variants / views
  --workers <n>             default: 4
  --threshold <n>           override default tolerances.rmse
  --headed                  show the browser window (default: headless)
  --update-baselines        overwrite baselines with current captures
  --report <formats>        html,json,junit,all (default: all)
  --verbose                 log harness.* events at debug level
  --watch                   rerun on source changes (dev)
```

Environment variables (all optional; CLI flags win):

`TMRH_CORPUS`, `TMRH_BASELINE`, `TMRH_OUT`, `TMRH_WORKERS`, `TMRH_THRESHOLD`, `TMRH_REPORT`, `TMRH_FILTER`, `TMRH_UPDATE_BASELINES=1`, `TMRH_HEADED=1`, `TMRH_VERBOSE=1`, `TMRH_WATCH=1`, `TMRH_BASE_URL`.

## Baseline layout

```text
baselines/
├── manifest.json                 # TestManifest (array of Test)
├── tolerances.json               # global tolerances override (optional)
├── Toon/
│   ├── tolerances.json           # variant-level override (optional)
│   └── A/
│       ├── reference.png         # external-renderer PNG (ground truth)
│       ├── pose.json             # PoseManifest (camera + env + size)
│       └── tolerances.json       # test-level override (optional)
└── Gold/
    └── … etc.
```

### `manifest.json`

```json
[
  {
    "id":                 "toon-a",
    "variant":            "Toon",
    "view":               "A",
    "kmpPath":            "SingleMaterial01Toon/DEFCAD STANDARD TOON.kmp",
    "geometryPath":       "Required-Model-Baseline-For-Regression-Testing/Beretta PX4DB Storm Final.step",
    "posePath":           "Toon/A/pose.json",
    "referenceImagePath": "Toon/A/reference.png"
  }
]
```

### `pose.json`

```json
{
  "cameraPosition": [0, 0, 3],
  "cameraTarget":   [0, 0, 0],
  "cameraUp":       [0, 1, 0],
  "cameraFov":      45,
  "imageWidth":     1024,
  "imageHeight":    1024,
  "environment":    "studio_small_2k",
  "toneMapping":    "NeutralToneMapping",
  "background":     "#000000",
  "dpr":            1
}
```

## Tolerances

Resolution order (later wins):

1. Global defaults (below).
2. `<baseline>/tolerances.json`
3. `<baseline>/<variant>/tolerances.json`
4. `<baseline>/<variant>/<view>/tolerances.json`
5. Programmatic override passed to `createHarness({ tolerances })` or `--threshold`.

```json
{
  "rmse":             0.5,
  "pixelMismatchPct": 0.5,
  "ssim":             0.005,
  "maxChannelDiff":   10,
  "silhouetteOnly":   true
}
```

A test fails if **any** of:

- `rmse            > tolerance.rmse`
- `pixelMismatchPct > tolerance.pixelMismatchPct`
- `(1 - ssim)       > tolerance.ssim`
- `maxChannelDiff  > tolerance.maxChannelDiff`

## Architecture

```text
               ┌──────────────────┐
               │  CLI / GUI entry │
               └────────┬─────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │  runner/ : run(), runTest() │
         └─────┬──────────────┬────────┘
               │              │
               ▼              ▼
      ┌─────────────┐  ┌────────────────┐
      │ harness/    │  │ recorder/      │
      │  Harness,   │  │  diff, SSIM,   │
      │  Controller │  │  silhouette,   │
      │  pose,sweep │  │  PNG encode,   │
      │  solver,    │  │  tolerances    │
      │  realtime   │  └────────────────┘
      └──────┬──────┘
             │
             ▼
     ┌───────────────┐
     │ THREE.WebGL-  │
     │ Renderer on   │
     │ OffscreenCanv │
     └───────────────┘
             ▲
             │ (live browser mode)
     ┌───────┴──────────┐
     │ components/ R3F  │
     │  GUI: App,       │
     │  Renderer,       │
     │  Material,Scene, │
     │  GUI/* panels,   │
     │  ShaderTypeReg.  │
     └──────────────────┘
```

The GUI uses `@react-three/fiber`'s `<Canvas>` for interactive viewing. The capture path is independent: it instantiates a **vanilla `THREE.WebGLRenderer`** on an `OffscreenCanvas` so captures are deterministic and don't depend on any particular R3F scene being mounted. The same `ShaderTypeRegistry` backs both paths.

## Registering custom shaders

The harness ships with seven auto-registered shader handlers (`lux_toon`, `metallic_paint`, `lux_translucent`/`sss`, `lux_velvet`/`velvet`/`fabric`/`cloth`/`realcloth`, `lux_anisotropic`/`anisotropic`/`brushed_metal`, `lux_glass`/`glass`/`liquid`/`lux_dielectric`/`dielectric`, `lux_gem`/`gem`/`diamond`/`lux_diamond`, `lux_xray`/`xray`/`x-ray`, `lux_flat`/`flat`). Importing the library side-effect-registers all of them.

To register your own handler:

```javascript
import { registerShaderType } from 'three-material-regress-harness'

registerShaderType('my_shader', {
  createMaterial(def, textures) { /* return THREE.Material */ },
  updateMaterial(mat, def, textures) { /* mutate in place */ },
  dispose() { /* cleanup */ },
})
```

Handlers are looked up case-insensitively by `def.kmpShaderType`. Unregistered types fall back to `THREE.MeshPhysicalMaterial` with direct property mapping.

## Modes

### Browser GUI (`npm run dev`)

Vite on `:4175` → `<App />` mounts: left test tree, centre live R3F canvas + reference + live diff, right `MaterialDefinition` inspector + metrics + parameter sweep + CMA-ES solver. Drop a `.kmp` or JSON onto the window to load a material.

### Headless (`npx tmrh run`)

Spawns Playwright Chromium, loads the same Vite bundle, drives captures through `page.evaluate()`. Identical render path in both modes — no `headless-gl` (WebGL1-only, incompatible with Three.js ≥ 0.163).

## Testing

```sh
npm test                 # vitest: ~150 unit tests (pure logic + reporters + solver)
npm run test:browser     # playwright: GUI smoke + Harness.capture + diff end-to-end
npm run test:regression  # playwright + full corpus: regression suite
npm run build            # rollup → dist/three-material-regress-harness.mjs
```

Current bundle: ~33 KB gzipped (every peer dep externalised — no `three`, no `react`, no `@react-three/*`, no `zustand` inlined).

## Security

- Pure JavaScript (no native code on the hot path; `sharp` is an opt-in).
- `npm audit --audit-level=high` gate in CI.
- Sandboxed Playwright Chromium (default-on).
- Archive handling via the `kmp-three-suite` peer: zip-slip + zip-bomb protected (256 MB cap).
- No network I/O from the library core.

## License

MIT.
