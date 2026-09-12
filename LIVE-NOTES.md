# ECHOES OF LIGHT — interactive observatory

Open `index.html` in a browser with WebGL 2 and floating-point color buffers. The complete experience runs locally, including when the files are opened directly. It has no external scripts, API requests, account requirements, or runtime Python dependency.

## Interaction

- Drag to orbit through 360° of azimuth and from 85° above to 85° below the disk. Mouse, touch, and pen pointer input are supported.
- Scroll, pinch, or use +/− to change the optical field of view from 100 to 10 gravitational radii. Double-click for a close view.
- Play/pause or scrub observation time. The initial time window is −24 to +48 hours; it expands as playback continues. Time is not looped or silently reset.
- Select real time, 60×, 600×, 1,800×, or 3,600× compression. The displayed ratio is the simulated coordinate time per wall-clock second. Default: 1 second = 30 minutes.
- Inspect a ray by tapping/clicking without dragging. Disk hits show emission radius, the combined frequency ratio, retarded emission coordinate, and image order. Captured and escaped rays are identified separately.
- Adjust exposure and bloom. Choose the EUV false-color camera or the actual visible spectral band.
- Isolate direct light, lensed echoes, or the evolving filament. Frequency-shift and image-order views are explicitly diagnostic color maps. The source-isolation control dims the rest of the field; it does not create new rays or widen echoes.
- Choose a preset view, start the guided orbit, hide controls, enter fullscreen, or export the current canvas as a PNG.
- Keyboard: arrows orbit, +/− zoom, Space pauses, R resets, H hides controls. Native sliders and buttons are keyboard accessible. Reduced-motion users start paused.

The mass and spin remain the requested 10⁸ solar masses and a* = 0.9. They are not exposed as independent cosmetic controls.

## What is calculated live

Changing inclination, field of view, or roll computes a new Kerr null-geodesic transfer map on the GPU. The axisymmetry of the geometry allows azimuth changes to reuse that map while changing the absolute emitting azimuth and background coordinates. Each map stores first-hit radius, azimuth, retarded time, frequency shift, previous equatorial crossings, and capture/escape status.

The emitting field is evaluated again every frame at `t_em + t_observation`. All direct and delayed images sample that same field. The temperature profile and CIE spectral integrals are numerical lookup tables derived from the offline renderer, not color gradients painted onto a disk mesh. Animation is independent of the camera map calculation.

The baseline disk, opacity, circular orbital law, blackbody emission, and frequency transfer are specified in [PHYSICS.md](PHYSICS.md). For the interactive field, the bright strand uses the strictly periodic centerline

```text
r_strand = 5.4 + 0.45 sin(2 ψ + 1)
ψ = φ − Ω(r) [t_em + t_observation + 160]
```

This keeps the source periodic under a full 360° observer orbit. The broad transient envelope has a Gaussian width of 220 GM/c³. The texture is a procedural heating prescription, not an MHD calculation. The archived still and its exact marker correspondence retain their original emission prescription; their quoted 4.185-hour separation is not a universal delay for every viewpoint or moment.

## Robust angular integration

Single-precision integration of μ = cos θ directly can drift at a polar turning point. The live solver instead uses μ = √K cos χ, with K the positive polar-potential root:

```text
B = a² − q − λ²
K = [B + sqrt(B² + 4 a² q)] / (2 a²)
dχ/dγ = sqrt(a² K cos²χ + q/K)
ε² = λ² K / (q + a² K) = 1 − K
```

The azimuthal pole term is integrated analytically using an unwrapped angular primitive. A smooth residual and radial frame-dragging term are integrated by RK4. Explicit polynomial trigonometric functions avoid driver-dependent intrinsic approximations. Crossings at the observer’s asymptotic starting point are excluded from the image-order count, including at precisely edge-on inclination. For q < 0 in this camera construction, the impact radius is less than a and the radial potential admits no exterior turning point; those rays are classified as captured.

This is a numerical reformulation of the Kerr equations, not an artistic lensing approximation. The renderer still uses finite precision, steps, and spatial sampling.

## Resolution and display limits

The map keeps the selected working width (560, 1,000, or 1,600 pixels, limited by the canvas) and step coefficient 0.028 both at rest and during camera motion. There is no automatic motion-resolution drop or refinement delay. The coefficient is divided by √(α² + β² + 1) to set the base Mino-time step. Azimuth-only motion reuses the existing transfer map exactly; inclination, zoom, roll, and viewport dimensions determine when retracing is required. The horizon and escape regions further restrict the step. At most 1,400 integration steps are allowed per ray.

This display uses one ray per transfer-map pixel and a filtered display image. It is not the four-sample, double-precision 6K offline render. Thin higher-order subrings can be subpixel or absent at the selected working resolution. No missing subring is filled with a drawn halo. A ray that fails its numerical limit remains unresolved in the map; selecting that pixel reports the limit rather than calling it a physical horizon.

The live display uses the same fixed hue-preserving highlight shoulder and adjustable approximate optical bloom. EUV mode stretches 21.11–43.33 nm to 380–780 nm. Visible mode integrates the actual 380–780 nm band. Each mode is normalized relative to a 100,000 K reference in its own passband, so switching modes is not a calibrated measurement of the relative energy in those bands. Background sources remain synthetic blackbodies. Atmospheres, scattering, polarization, interstellar absorption, returning radiation, disk thickness, and backreaction are omitted.

## Camera and guided orbit

The observer is asymptotically distant. Interactive orbiting selects distant observer directions; zoom changes the impact-coordinate field of view. These are instantaneous observer views, not the integrated trajectory or Doppler response of a moving camera. The camera cannot enter the disk or horizon.

The optional 40-second guided orbit uses cubic smoothstep interpolation between these view parameters, then holds the final composition while disk evolution continues:

| Real seconds | Elevation above disk | Azimuth | Field width | Roll |
|---|---:|---:|---:|---:|
| 0 | 18° | 0° | 65 rg | 10° |
| 12 | 6° | 22° | 47 rg | 13° |
| 26 | −12° | 42° | 35 rg | 13° |
| 40 and later | 15° | 70° | 24 rg | 13° |

Manual camera input cancels the tour. This is a specified interpolation of observer views, not a solved timelike worldline. The selected time-compression factor continues to govern the disk. There is no soundtrack or implied sound propagation through space.

## Numerical verification

[live-verification.json](live-verification.json) contains the measured results. Seven 128 × 80 grids cover the initial view, a close view, the underside, a high view, the equator, and both near-polar limits. They comprise 71,680 GPU rays, with zero unresolved rays in those grids. All 1,939 comparison samples agreed with the double-precision reference on capture/escape/disk classification and disk image order.

Across the matched disk samples, the largest differences were approximately 0.000313 rg in radius, 3.58 × 10⁻⁶ rad in azimuth, 0.000355 gravitational times in retarded time (about 0.175 seconds), and 1.61 × 10⁻⁶ in the frequency ratio. This is sampled validation at the stationary step setting, not a guarantee for every ray, driver, camera configuration, or unresolved image order.

The desktop preview rendered at approximately 60 frames per second at a stationary viewpoint. After removing the resolution drop, one continuous guided-orbit sample rendered at 33 frames per second with a 1,000 × 716 ray map. Device performance and browser support vary; the displayed frame rate and ray-map dimensions describe the actual current session.

## Source

`live/shaders.js` contains the ray integrator, moving emission field, spectral response, and display pass. `live/app.js` provides interaction and GPU orchestration. `live/spectra.js` holds the numerically computed lookup tables. `live/style.css` and `index.html` provide the interface. `live/validate.html` exposes reproducible GPU samples; its `inclination`, `field`, and `step` URL parameters select the test camera.

`live/build_tables.py` regenerates the lookup tables from `render.py`. `live/reference.cpp`, `live/reference-samples.json`, and `live/compare_reference.py` preserve the sampled comparison inputs and reference calculation; the comparison script contains its build/run commands. The reference uses double-precision integration and float32 hit records.

The original 6K files remain available through `still-study.html`. No public hosting was performed.
