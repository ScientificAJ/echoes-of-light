"""Regenerate the live spectral and thin-disk tables from the reference model.
Run from any directory: PYTHONNOUSERSITE=1 python3 live/build_tables.py
Requires NumPy, SciPy, and Pillow through the shared render.py module.
"""
from pathlib import Path
import json
import sys
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from render import profile, spectral_lut, ISCO

radii, temperatures, _ = profile()
data = {"profile": np.interp(np.geomspace(ISCO, 38, 4096), radii, temperatures).round(3).tolist()}
for name, stretch in [("euv", 18), ("visible", 1)]:
    temperature, rgb = spectral_lut(stretch)
    sampled = np.stack([np.interp(np.geomspace(1000, 500000, 2048), temperature, rgb[:,c]) for c in range(3)], axis=-1)
    data[name] = sampled.round(7).ravel().tolist()
(ROOT / "live/spectra.js").write_text("window.ECHO_SPECTRA=" + json.dumps(data, separators=(",", ":")) + ";\n")
print("Rebuilt live/spectra.js from the physical profile and CIE response.")
