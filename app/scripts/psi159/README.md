The canonical generator is `../build_flame_data.py`.

Run from the app directory with Python 3.11+ containing NumPy and Pillow
(`requirements.txt` pins the tested versions) and Node 24:

```sh
python3 scripts/build_flame_data.py --raw-dir /path/to/INTNS/archives
node --test tests/flame.test.mjs
python3 scripts/psi159/test_reconstruction.py
```

The three archives must retain their NASA names, for example
`PSI-159_Raw Data_21088A1_INTNS_ALL.zip`. Before rebuilding, download the raw
sensor files `21088A1_data.csv`, `21088B1_data.csv`, and `21088C1_data.csv`
from the [PSI-159 source folder](https://drive.google.com/drive/folders/1WIvup-SYEZczCj3ah7J99Y7SQdwymBHC)
and place them in the repository's `data/psi-159-drive/` directory. Source
archives and sensor CSVs are not included in the repository.

Every source exposure is reconstructed (2017 / 1944 / 1829 frames). Acquisition
wall-clock timestamps drive field playback, reference selection and sensor
alignment. The raw MFC signal supplies sustained on/off transition times;
the reported extinction time does not truncate the reconstructed sequence.

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

The browser renders the reconstructed emission field in linear space with a
fixed display exposure and the active eye camera. Metal sphere/support
intersections stop ray integration while retaining gas in front. The scene is
deliberately enlarged and reports its magnification; XR scene coordinates use
a floor reference. No physical flame simulation is included. The visualization
does not claim absolute radiometry, temperature, chemistry, or predictive
behaviour.

For raw HALCON HOBJ camera-image files, see the short
[HOBJ → Fireline VR guide](../README.md). The importer produces the scalar-field
format rendered in VR and an optional inspection OBJ mesh.

Scientific references:
- NASA CFI-G overview and burner geometry: https://www1.grc.nasa.gov/wp-content/uploads/ACME-CSSCI-20220509.pdf
- Hot/cool flame identification: https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/
- Spherical-flame experimental context: https://www.sciencedirect.com/science/article/pii/S0010218021000821
