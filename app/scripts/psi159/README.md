The canonical generator is `../build_flame_data.py`. Both notebooks call it;
there is no second HOBJ/INTNS reconstruction implementation.

Run from the app directory with Python 3.11+ containing NumPy and Pillow
(`requirements.txt` pins the tested versions) and Node 24:

```sh
python3 scripts/build_flame_data.py --raw-dir /path/to/INTNS/archives
node scripts/calibrate-flame.mjs
node --test tests/flame.test.mjs
python3 scripts/psi159/test_reconstruction.py
```

The three archives must retain their NASA names, for example
`PSI-159_Raw Data_21088A1_INTNS_ALL.zip`. Raw sensor CSVs are read from
`../data/psi-159-drive/`. Source archives remain outside the repository.

Every source exposure is reconstructed (2017 / 1944 / 1829 frames). Acquisition
wall-clock timestamps drive field playback, reference selection and sensor
alignment. The raw MFC signal supplies sustained on/off transition times;
the reported extinction time does not turn off the numerical solver.

`calibration.json` contains a fixed camera grid and a conservative hardware
exclusion band. The band and portions outside the camera are inferred using a
spherical prior plus nonnegative spatially regularized Abel fitting. They are
not independent 3D measurements. The camera's approximately spherical flame
and fixed view support this prior; a single view cannot determine arbitrary
asymmetry. The held-out synthetic-shell test checks the masked region as well
as the observed projection.

The source burner diameter is 6.35 mm. Its assumed 96 px image diameter is a
provisional scale estimate, explicitly marked `estimated`. The configured 25%
scale uncertainty is a working assumption, not a statistical confidence bound.
Replace it with an independent optical calibration before treating the mm
values as calibrated measurements. The conservative hardware mask also needs
independent annotation before quantitative publication.

Dark intensifier counts are sparse: temporal means estimate pre/post dark
fields, with interpolation between the actual dark-sample acquisition times for drift.
Detection uses five measured standard deviations of the dark-frame mean
over the same spatial mask, rather than an arbitrary brightness cutoff. Negative corrected observations remain
in the fitting loss; nonnegativity applies to the reconstructed emission.
Saturated observations are excluded from equality fitting and flagged in the
metadata. Frames with a projection residual above 10% use an explicitly
flagged spherical prior with a fitted linear amplitude, preventing unsupported
igniter/occluder transients from becoming disks in 3D. These frames are excluded
from the usable-frame median residual; the discarded assumptions are not hidden. The ignition flash is therefore not quantitatively reconstructed.
Exposure/gain settings are preserved in provenance; no gain-to-radiance
calibration is asserted.

The grid is 128 axial by 64 radial cells on the same domain throughout a test.
It contains linear IEEE binary16 values, compressed losslessly with gzip.
Emission units are `INTNS counts / 6000 / local path length`. A single display
exposure applies over time; no per-frame normalization or gamma is baked in.
Previews retain a common 0..6000 counts display transfer. Previews are sampled
every five source exposures and selected by time, independently of field FPS.

The forward Abel matrix contains path lengths in local volume units. Reported
NRMSE is a projection residual over usable, unmasked, unsaturated observations,
not a validation of hidden volume, absolute radiance, temperature or chemistry.
`metrics.json` preserves frame-level residuals, signal, radius and saturation.

The numerical model uses spherical finite volumes in SI units, a far-field
reservoir outside the camera crop, implicit advection/diffusion, conservative
species/enthalpy transport and a first-order low-Mach density projection.
It includes an ideal-gas EOS, one finite-rate global ethane reaction,
participating-product radiation and a burner thermal balance. There is one
finite-duration external ignition event and no prescribed pulse train.
The global reaction does not represent cool-flame/NTC chemistry.

`model-calibration.json` fits radiation/transport coefficients and a single emission-proxy scale to A1 only.
B1/C1 retain their actual conditions and serve as holdouts. Radius errors use
the provisional camera scale. The reported peak burner temperature is a weak
calibration target, not a synchronized end-of-run measurement. Neither a low
projection error nor this reduced-model fit establishes predictive validity.

The browser integrates emission and independently specified absorption in
linear space, applies a fixed exposure, and uses the active eye camera. Metal
sphere/support intersections stop ray integration while retaining gas in
front. The scene size is deliberately enlarged; its magnification is shown.
XR scene coordinates use a floor reference, and session setup errors are awaited and reported.
No physical headset or absolute radiometric validation is claimed.

Scientific references:
- NASA CFI-G overview and burner geometry: https://www1.grc.nasa.gov/wp-content/uploads/ACME-CSSCI-20220509.pdf
- Hot/cool flame identification: https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/
- Spherical-flame experimental context: https://www.sciencedirect.com/science/article/pii/S0010218021000821

The ethane lower heating value is 47.5 MJ/kg, consistent with [NPL MAT 114](https://eprintspublications.npl.co.uk/9635/1/MAT114.pdf). Effective heat capacity, diffusion and global reaction coefficients remain reduced-model approximations, rather than a detailed chemical mechanism.
