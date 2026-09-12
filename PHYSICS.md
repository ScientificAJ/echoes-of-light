# ECHOES OF LIGHT

These notes document the numerical 6K reference still and its separately traced close view. The fully interactive observatory is now `index.html`; [LIVE-NOTES.md](LIVE-NOTES.md) documents its controls, animation, GPU solver, validation, and rendering differences. This is a controlled physical visualization with a procedural emitting disk, not an observational image or a radiation-magnetohydrodynamic simulation. No image generator, painted lensing arcs, synthetic horizon glow, or decorative rings are used.

## The physical scene

| Quantity | Value / assumption |
|---|---|
| Mass | 100 million solar masses |
| Dimensionless spin | a* = +0.9 |
| Metric | Stationary, uncharged Kerr; Boyer–Lindquist coordinates |
| Observer | Static, asymptotically distant; inclination 75° to the spin axis, hence 15° above the disk |
| Camera roll | 13°; a rotation of the image coordinates |
| Gravitational radius, GM/c² | 1.476669691 × 10¹¹ m, about 0.987 AU |
| Gravitational time, GM/c³ | 492.563989 s |
| Outer horizon coordinate radius | 1.435889894 GM/c² |
| Prograde ISCO | 2.320883042 GM/c² |
| Disk | Equatorial, infinitesimally thin, opaque, two emitting faces |
| Disk extent | ISCO ≤ r ≤ 38 GM/c²; no emission inside the ISCO |
| Velocity | Prograde circular Kerr geodesics; negligible radial inflow |
| Baseline accretion rate | 3.143121504 × 10²¹ kg/s, about 0.0499 solar masses/year |
| Baseline luminosity convention | 0.035 L_Edd using efficiency 1 − E_ISCO = 0.155753, before texture perturbations and ignoring photon recapture |
| Mean profile peak temperature | 93,827 K |
| Orbital period at ISCO | 3.81334 hours in the distant coordinate time |
| Orbital period at r = 5.4 GM/c² | 11.56146 hours |

The reference still is a single observation time. The live observatory adds interactive time evolution and observer views as specified in LIVE-NOTES.md. Neither version has a soundtrack. Material motion enters through the retarded emission field, so the different light paths sample different phases of the same evolving disk.

## Light propagation and the shadow

The ray tracer integrates the separated null geodesic equations in the actual Kerr metric, using G = M = c = 1. The conserved photon quantities are λ = Lz/E and q = Q/E². At the distant observer, λ = −α sin i and q = β² + (α² − a²) cos² i. Thus lensing, spin-dependent displacement, and azimuthal frame dragging follow from the same metric. The underlying equations are described by [Gralla and Lupsasca, *Null geodesics of the Kerr exterior*](https://arxiv.org/abs/1910.12881).

For numerical integration, u = 1/r and μ = cos θ remove the radial singularity at infinity. In backward Mino time γ:

```text
(du/dγ)² = U(u)
U = 1 + (a² − λ² − q)u² + 2[(λ − a)² + q]u³ − a²q u⁴

(dμ/dγ)² = q + (a² − q − λ²)μ² − a²μ⁴

dφ/dγ = −{ a[1 + (a² − aλ)u²]/[1 − 2u + a²u²]
             + λ/(1 − μ²) − a }
```

The second-order radial and polar forms cross turning points continuously. Fourth-order Runge–Kutta integration uses a geometry-dependent step, with smaller steps near the poles and horizon. Disk crossings are refined within a step. A ray stops at its first opaque disk intersection, at the horizon cutoff r+ + 10⁻⁵, or after escape; escaped angular positions are extrapolated to infinity. The interior of the horizon is never traced as an emitter.

The horizon is a spacetime boundary, not the visible black surface in the image. For this observer, the **vacuum capture shadow** has approximate unrolled impact-coordinate extents α ∈ [−2.9064, 6.7708] and β ∈ [−5.1803, 5.1803] GM/c². Its boundary comes from unstable spherical photon orbits. It is much larger than the horizon coordinate radius, although screen impact distances and Boyer–Lindquist radii are different geometrical quantities.

With an opaque emitting disk present, foreground disk emission covers part of that capture region. The visible dark depression consequently need not outline the entire vacuum shadow. The high spin places the disk close to the horizon and hides much of the potential underside image. This is why the secondary arcs here are narrow. No black circle is composited over the ray-traced disk.

## Emission, opacity, and texture

The baseline surface flux uses the zero-torque relativistic thin-disk integral of [Page and Thorne, *Disk-Accretion onto a Black Hole. I. Time-Averaged Structure of Accretion Disk*](https://articles.adsabs.harvard.edu/pdf/1974ApJ...191..499P):

```text
F(r) = [Mdot c² / (4π rg²)]
       × [−Ω'(r) / {r [E(r) − Ω(r)L(r)]²}]
       × integral(ISCO to r) [(E − ΩL)L' dr]

Ω = 1/(r^(3/2) + a)
T_eff = [F/σ_SB]^(1/4)
```

Circular-orbit E and L are evaluated for the prograde Kerr solution. The integral is tabulated at 40,000 radial points. Each face emits isotropic blackbody specific intensity in its comoving frame. The first surface encountered absorbs the ray completely; there is no transparent stacking of successive disk intersections. This implements occultation by the thin disk itself.

The fine filaments and turbulent brightness are a deterministic, anisotropic, multiscale procedural heating field. All image orders call the identical function of radius, azimuth, and emission time. A pair of closely spaced bright strands and a localized hot region are embedded in that field. The material coordinate is

```text
ψ = φ − Ω(r) [t_em + 160]
```

with time in GM/c³. Differential Ω stretches the pattern. The chosen transient envelope has a Gaussian time width of 220 GM/c³, about 30.1 hours. Local heating modulates F, and therefore temperature through the fourth root. This is an emissivity prescription: it does not solve turbulence, magnetic stresses, radial advection, or energy conservation for the fluctuations. The normalization is approximate, so the perturbed disk is not claimed to retain an exact total luminosity of 0.035 L_Edd.

## Frequency shifts and the camera

For circular disk matter and a static observer at infinity, the total frequency ratio is

```text
g = ν_observed / ν_emitted = 1 / [u^t (1 − Ωλ)]
u^t = (r^(3/2) + a) / sqrt(r³ − 3r² + 2a r^(3/2))

Iν,observed(ν) = g³ Iν,emitted(ν/g)
```

This includes gravitational and kinematic shifts together. A blackbody therefore arrives as a blackbody with temperature g T_eff. No separate hand-painted approaching-side multiplier is used. The unprocessed transfer maps span approximately g = 0.1814 to 1.3701. At fixed emitted bolometric intensity the transformation is g⁴; the displayed contrast is also affected by the selected spectral band and highlight compression.

**The image uses false color.** Observed wavelengths 21.111–43.333 nm in the extreme ultraviolet are stretched by a fixed factor of 18 to 380–780 nm. After the relativistic spectral shift, the spectrum is integrated at 2 nm display intervals against the CIE 1931 XYZ matching functions, approximated using [Wyman, Sloan, and Shirley](https://research.nvidia.com/labs/rtr/publication/wyman2013simple/), then converted to linear sRGB. This mapping is fixed for every disk pixel and image order. It is not the color a human eye would see at the scene.

The synthetic background consists of sparse Gaussian hot-source profiles on a celestial sphere. Temperatures span 45,000–125,000 K. Their blackbody colors use the same false-color spectral response; apparent brightnesses and angular profiles are assigned for a sparse illustrative field, not taken from a catalog. Escaping geodesics determine their sampled source positions, so distortion and repeated images follow the lens map. There is no independently painted star layer over captured or disk-occluded rays. Source profiles are deliberately finite for sampling; their sizes are not realistic resolved stellar diameters. No interstellar absorption is included.

Radiance is averaged over a 2 × 2 subpixel grid before exposure. A fixed exposure of 1.25 relative to the LUT reference and the hue-preserving shoulder RGB/(1 + max RGB) preserve bright structure. A restrained display-space point-spread approximation adds 4.5% and 1.6% of the thresholded image with Gaussian widths proportional to 1 and 5 pixels at a reference image width of 1,800. It represents an optical/artistic bloom approximation, not emission from the horizon. Away from that narrow spill, captured dark pixels remain black. Final files are 8-bit sRGB PNGs; no physical rings are broadened or drawn in postprocessing.

## Time delays and repeated structures

Coordinate time is integrated along every disk ray. To remove the divergent common observer travel time, the code evolves a regularized variable t − r*(r) + r*(observer), where r* is the Kerr tortoise coordinate. The stored emission time is t_em + r*(observer). Only differences are physically relevant to this still; the common zero is a convention.

The emitting field is evaluated at that stored emission time, not at a shared frozen time for all light paths. Thus direct and lensed views contain different ages and azimuthal positions of the same material pattern. The arches are different views of the same disk, not duplicated or separately animated geometry.

Image order in the data means the number of previous equatorial-plane crossings before the first opaque hit. Order 0 includes both the near disk and its directly visible lensed far side; order 1 is a subsequent view after one unobstructed equatorial crossing; higher values indicate further crossings. This count is not an integer count of full photon orbits. Exponentially narrower repeated images are a property of Kerr lensing; see [Gralla and Lupsasca, *Lensing by Kerr Black Holes*](https://arxiv.org/abs/1910.12873).

The archived still-study markers identify the same material label at r = 5.393875599 rg and ψ = 1.0280157395 rad. Its direct image has g = 0.55370015, while the first echo has g = 0.89443541 and an emission time 4.185092 hours earlier. This is a comparison of the same moving material at different ages, not a duplicate of a single emission event. `filament-images.json` records the image coordinates, retarded times, and correspondence residuals. An exact matching material label was not established for order 2, so it is not annotated as another copy of this particular point. Other parts of the extended filament do occur among the higher-order samples.

The 6,000 × 3,375 master integrates 81 million rays over a 55 rg-wide screen. Its pixel width is 0.009167 rg. The separate 3,200 × 3,200 close view integrates 40.96 million rays over 14 rg, giving 0.004375 rg per output pixel. It is a fresh ray pass at the same viewpoint and observation time, not an AI enlargement. The broad first echo is supported. Parts of order 2 approach the sampling limit; many still higher orders contribute only subpixel samples. Their presence in the transfer data is **not** a claim that each is a resolved ring. No attempt is made to turn them into continuous decorative halos.

## Verification and limits

`verification.json` records the following numerical checks:

- 16,000 deterministic random rays, compared at step scales 0.5 and 0.25: no failed rays or image-classification changes.
- 12,625 matching disk hits: maximum differences 3.82 × 10⁻⁶ rg in radius, 4.77 × 10⁻⁷ rad in azimuth, 3.82 × 10⁻⁶ gravitational times in emission time, and 1.20 × 10⁻⁷ in g. Float32 storage contributes to this comparison floor.
- Maximum normalized separated-potential residuals along the sample: 7.12 × 10⁻⁹ radial and 3.35 × 10⁻¹⁰ polar.
- 3,824 rays immediately inside/outside the analytic spherical-orbit shadow curve: all agreed with the expected capture/escape classification.
- In the full passes, 13 master rays and 56 close-view rays near the polar coordinate singularity required tighter steps. They were recalculated successfully before final shading. The delivered metadata reports zero unresolved rays.

These are meaningful internal numerical checks, not independent certification by an established astrophysical ray-tracing package. Geometrical optics and a stationary Kerr vacuum are assumed. The disk has zero thickness, so finite-height rim occultation is absent. No scattering atmosphere, spectral lines, polarization, limb darkening, returning-radiation heating, gravitational backreaction, magnetohydrodynamics, corona, jets, interstellar extinction, or cosmological redshift is modeled. Bloom and tone mapping are display approximations. No unresolved order is asserted to be a measured physical ring.

## Files and reproduction

- `echoes-of-light-titled.png`: 6,000-pixel presentation master.
- `echoes-of-light.png`: the same image without lettering.
- `echoes-detail.png`: a separately traced close view.
- `index.html`, `live/`: fully interactive GPU observatory.
- `still-study.html`: reference viewing page with the close view and image annotations.
- `LIVE-NOTES.md`, `live-verification.json`: live rendering assumptions and numerical evidence.
- `kerr_trace.cpp`, `render.py`, `render_large.py`, `verify.cpp`: editable numerical source.
- `echoes-of-light.json`, `echoes-detail.json`, `verification.json`, `filament-images.json`: parameters and evidence.

Requirements: C++17 with OpenMP; Python 3 with NumPy, SciPy, and Pillow. The full raw master map uses about 2.6 GB of scratch space. Spectral shading is tiled. On the creation host, `PYTHONNOUSERSITE=1` selects the compatible system NumPy/SciPy pair. The lettering uses installed DejaVu fonts; adjust those paths on another system.

```bash
mkdir -p work
g++ -O3 -fopenmp -std=c++17 kerr_trace.cpp -o work/kerr_trace
OMP_NUM_THREADS=12 work/kerr_trace 12000 6750 work/master.bin .5 55 .55 .54 13
PYTHONNOUSERSITE=1 python3 render_large.py work/master.bin 12000 6750 echoes-of-light.png

OMP_NUM_THREADS=12 work/kerr_trace 6400 6400 work/detail.bin .5 14 .42 .52 13
PYTHONNOUSERSITE=1 python3 render_large.py work/detail.bin 6400 6400 echoes-detail.png --no-title

g++ -O3 -fopenmp -std=c++17 verify.cpp -o work/verify
work/verify
```
