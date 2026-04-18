# three-material-regress-harness

> An installable, cloneable, dual-mode visual regression harness for Three.js materials. Drives a `@react-three/fiber` canvas against `MaterialDefinition` outputs from `kmp-three-suite`, captures deterministic screenshots, and diffs them against baselines from external renderers (KeyShot, Fusion, etc.).

**Used in conjunction with KMP-Three-Suite.** See `docs/specs/SPEC-10-three-material-regress-harness.md` for the full specification and `docs/plans/2026-04-18-three-material-regress-harness-implementation.md` for the implementation plan.

## MUST-haves (from SPEC-10)

- Recreate, render, and apply custom materials; capture to PNG; detect differences.
- Compare photos, recognise regression over time and in realtime.
- Detect properties inside a `MaterialDefinition` and how they are applied in the canvas.
- Compare external-renderer screenshots to Three.js captures, align object pose via diff comparison, then tune material application.

## Install

```sh
npm install three-material-regress-harness
```

Peer dependencies (expected in the consumer tree):

- `three` ^0.184.0
- `@react-three/fiber` ^9.6.0
- `@react-three/drei` ^10.0.0
- `react` ^19.2.0
- `react-dom` ^19.2.0
- `zustand` ^5.0.12
- `kmp-three-suite` (optional)

## Quick start — GUI

```sh
git clone <this repo>
cd three-material-regress-harness
npm install
npm run dev                # http://127.0.0.1:4175 — three-column live diff GUI
```

Drop a `.kmp` onto the page, pick a view, drag a slider — the diff metric updates at ≥ 4 Hz.

## Quick start — headless regression

```sh
npm ci
npx playwright install chromium   # one-time
npx tmrh run \
  --corpus samples-to-match-identically-kmp-files \
  --baseline baselines \
  --out out/runs \
  --report all
```

Exit code 0 on pass, 1 on tolerance breach. Reports written to `out/runs/<timestamp>-<git-sha>/`:

- `report.json` — canonical structured report
- `report.html` — human-facing side-by-side with thumbnails
- `report.junit.xml` — CI-consumable
- `captures/<testId>.png` — Three.js-rendered candidate
- `diffs/<testId>.diff.png` — 3-pane `[candidate | reference | diff]` for failures

## Programmatic API

```javascript
import { createHarness } from 'three-material-regress-harness'

const harness = createHarness({
  corpus: './samples-to-match-identically-kmp-files',
  baseline: './baselines',
  out: './out/runs',
  workers: 4,
  tolerances: { rmse: 0.5, pixelMismatchPct: 0.5, ssim: 0.005, maxChannelDiff: 10, silhouetteOnly: true },
  report: ['json', 'html', 'junit'],
  updateBaselines: false,
})

const report = await harness.run()
if (report.failCount > 0) process.exit(1)
```

### In-page capture

```javascript
import { Harness, diffImages } from 'three-material-regress-harness'

const h = new Harness({
  materialDefinition: { color: '#cc5500', roughness: 0.35, metalness: 0.0, kmpShaderType: null },
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

Environment variables: `EVTH_CORPUS`, `EVTH_BASELINE`, `EVTH_OUT`, `EVTH_WORKERS`, `EVTH_THRESHOLD`, `EVTH_REPORT`, `EVTH_FILTER`, `EVTH_UPDATE_BASELINES=1`, `EVTH_HEADED=1`, `EVTH_VERBOSE=1`, `EVTH_WATCH=1`, `EVTH_BASE_URL`.

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

`manifest.json` schema:

```json
[
  {
    "id": "toon-a",
    "variant": "Toon",
    "view": "A",
    "kmpPath": "SingleMaterial01Toon/DEFCAD STANDARD TOON.kmp",
    "geometryPath": "Required-Model-Baseline-For-Regression-Testing/Beretta PX4DB Storm Final.step",
    "posePath": "Toon/A/pose.json",
    "referenceImagePath": "Toon/A/reference.png"
  }
]
```

`pose.json` schema (all fields required except those marked optional):

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

Resolution order (later wins): global defaults → `baselines/tolerances.json` → `baselines/<variant>/tolerances.json` → `baselines/<variant>/<view>/tolerances.json` → programmatic override.

```json
{
  "rmse":              0.5,
  "pixelMismatchPct":  0.5,
  "ssim":              0.005,
  "maxChannelDiff":    10,
  "silhouetteOnly":    true
}
```

Regression = `rmse > tolerance.rmse` OR `pixelMismatchPct > tolerance.pixelMismatchPct` OR `(1 - ssim) > tolerance.ssim` OR `maxChannelDiff > tolerance.maxChannelDiff`.

## Registering custom shaders

The harness ships with a default `MeshPhysicalMaterial` fallback. For KeyShot-fidelity shaders (`lux_toon`, `metallic_paint`, `lux_translucent`, `lux_velvet`, `lux_anisotropic`, `lux_glass`, `lux_xray`), register handlers that match SPEC-07's signature:

```javascript
import { registerShaderType } from 'three-material-regress-harness'
import { YourToonShader } from './shaders/ToonShader'

registerShaderType('lux_toon', {
  createMaterial(def, textures) { /* return THREE.Material */ },
  updateMaterial(mat, def, textures) { /* mutate in place */ },
  dispose() { /* cleanup */ },
})
```

The harness does **not** implement these shaders itself (SPEC-10 FR-36). Consumers import the real handlers from `file-browser-client/app/lib/renderer/shaders/*` or provide their own.

## Modes

### Browser GUI

`npm run dev` → Vite on :4175 → `<App />` mounts with three columns:

- left: tree of variants × views
- centre: live R3F canvas + reference + diff
- right: parameter inspector + metrics panel

### Headless (Playwright Chromium)

`npx tmrh run` spawns Chromium, loads the same Vite bundle, drives captures through `page.evaluate()`. Identical render path in both modes — no "headless-gl" (which is WebGL1-only and incompatible with Three.js ≥ 0.163).

## Testing

```sh
npm test                 # vitest: unit tests (124+ cases — pure logic)
npm run test:browser     # playwright: GUI smoke + Harness.capture + diff end-to-end
npm run test:regression  # playwright + full corpus: regression suite
npm run build            # rollup: dist/three-material-regress-harness.mjs
```

Current bundle: ~17 KB gzipped (peer deps external).

## Architecture

See `docs/specs/SPEC-10-*.md` for the architectural ASCII diagram. Five layers:

```text
src/
├── harness/      # Harness, HarnessController, pose math, config, schema
├── recorder/     # PNG encode/decode, diff (pixelmatch + SSIM), silhouette mask, tolerances
├── runner/       # run() orchestrator, per-test runner, duration, CLI, reporters
├── stores/       # six zustand stores (harness, renderer, recording, regression, screenshot, test)
└── components/   # App, Renderer, Material, Scene, ShaderTypeRegistry (R3F)
```

## Security

- Pure JavaScript (no native code in hot path — `sharp` is opt-in).
- `npm audit --audit-level=high` gate in CI.
- Sandboxed Playwright Chromium (default-on).
- Archive handling (via `kmp-three-suite` peer): zip-slip + zip-bomb protected (256 MB cap).
- No network I/O from the library core.

## License

MIT.
