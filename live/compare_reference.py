"""Compare archived GPU samples against the double-precision reference.
Run from the bundle root: g++ -O3 -fopenmp -std=c++17 live/reference.cpp -o live/reference
Then: PYTHONNOUSERSITE=1 python3 live/compare_reference.py
"""
import numpy as np,json,subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
samples=json.load(open(ROOT / 'live/reference-samples.json'));p=subprocess.Popen([str(ROOT / 'live/reference')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True);reports=[];angle=np.deg2rad(13)
for j in samples:
 err=[];mismatch=0
 for s in j['samples']:
  x=(s['x']+.5-.55*128)*j['field']/128;y=(s['y']+.5-.46*80)*j['field']/128
  al=np.cos(angle)*x+np.sin(angle)*y;be=-np.sin(angle)*x+np.cos(angle)*y
  p.stdin.write(f'{al} {be} {j["inclination"]}\n');p.stdin.flush();ref=np.fromstring(p.stdout.readline(),sep=' ')
  status=s['path'][0]
  if status!=ref[7]:mismatch+=1;continue
  if status==1:
   if s['path'][1]!=ref[4]:mismatch+=1;continue
   v=np.array(s['hit'])-ref[:4];v[1]=np.arctan2(np.sin(v[1]),np.cos(v[1]));err.append(np.abs(v))
 a=np.array(err)
 reports.append({'inclination_degrees':j['inclination'],'field_rg':j['field'],'grid_rays':j['width']*j['height'],'unresolved_grid_rays':j['failed'],'compared_rays':len(j['samples']),'classification_mismatches':mismatch,'disk_comparisons':len(err),'max_abs_error_r_phi_t_g':a.max(axis=0).tolist(),'median_abs_error_r_phi_t_g':np.median(a,axis=0).tolist()})
p.terminate();report={'solver':'GPU RK4 with regular polar phase and analytic singular azimuth integral','reference':'Double-precision mu-coordinate RK4 at step scale 0.125','step_coefficient':.028,'camera_tests':reports,'limitations':'Sampled grids, not a certification of all camera configurations or all higher-order subrings.'};open(ROOT / 'live-verification.json','w').write(json.dumps(report,indent=2));print(json.dumps(reports,indent=2))
