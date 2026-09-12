"""Memory-bounded spectral rendering of a supersampled transfer map."""
import argparse,json
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image
import render as R

p=argparse.ArgumentParser();p.add_argument('map');p.add_argument('width',type=int);p.add_argument('height',type=int);p.add_argument('output')
p.add_argument('--ss',type=int,default=2);p.add_argument('--stretch',type=float,default=18);p.add_argument('--exposure',type=float,default=1.25);p.add_argument('--no-title',action='store_true')
args=p.parse_args();W=args.width;H=args.height;ss=args.ss
m=np.memmap(args.map,dtype='float32',mode='r',shape=(H,W,8))
linear=np.zeros((H//ss,W//ss,3),np.float32)
radii,temp,meta=R.profile();T,lut=R.spectral_lut(args.stretch)
counts={};gmin=10.;gmax=0;fail=0;td=[]
for y in range(0,H,64):
    data=m[y:y+64];disk=data[...,7]==1;sky=data[...,7]==2
    r=np.where(disk,data[...,0],R.ISCO+1).astype(np.float64)
    mod,_=R.texture(r,data[...,1],data[...,2]);observed=np.interp(r,radii,temp)*mod**.25*data[...,3]
    rgb=np.empty(data.shape[:2]+(3,),np.float32)
    for ch in range(3):rgb[...,ch]=np.interp(observed,T,lut[:,ch])*disk
    rgb+=R.sky_radiance(data[...,5],data[...,6],args.stretch)*sky[...,None]
    linear[y//ss:(y+len(data))//ss]=rgb.reshape(len(data)//ss,ss,W//ss,ss,3).mean(axis=(1,3))
    if disk.any():
        gmin=min(gmin,float(data[...,3][disk].min()));gmax=max(gmax,float(data[...,3][disk].max()))
        td.extend(observed[disk][::200].tolist())
    for n in np.unique(data[...,4][disk]):counts[str(int(n))]=counts.get(str(int(n)),0)+int(((data[...,4]==n)&disk).sum())
    fail+=int((data[...,7]<0).sum())
    if y%1024==0:print(f'Spectral tiles {y}/{H}',flush=True)
linear*=args.exposure
mx=linear.max(axis=-1,keepdims=True);linear/=1+mx;del mx
bright=np.maximum(linear-.18,0)
# PSF widths proportional to output width, matching the chosen 1800px preview.
psf=W/ss/1800
linear+=.045*gaussian_filter(bright,(1.0*psf,1.0*psf,0))+.016*gaussian_filter(bright,(5*psf,5*psf,0))
del bright
im=Image.fromarray((np.clip(R.srgb(linear),0,1)*255+.5).astype(np.uint8));path=Path(args.output)
im.save(path);im.resize((1800,round(im.height*1800/im.width)),Image.Resampling.LANCZOS).save(path.with_suffix('.jpg'),quality=94)
if not args.no_title:
    titled=R.lettering(im);titled.save(path.with_stem(path.stem+'-titled'))
    titled.resize((1800,round(im.height*1800/im.width)),Image.Resampling.LANCZOS).save(path.with_stem(path.stem+'-preview').with_suffix('.jpg'),quality=94)
meta.update(mass_solar=1e8,spin=R.A,rg_m=R.RG,tg_seconds=R.TG,isco_rg=R.ISCO,horizon_bl_radius_rg=R.RP,
    isco_period_hours=2*np.pi*(R.ISCO**1.5+R.A)*R.TG/3600,r54_period_hours=2*np.pi*(5.4**1.5+R.A)*R.TG/3600,
    stretch=args.stretch,physical_band_nm=[380/args.stretch,780/args.stretch],exposure=args.exposure,
    traced_rays=W*H,output_size=list(im.size),samples_per_pixel=ss*ss,image_orders=counts,failed_ray_count=fail,g_range=[gmin,gmax],
    sampled_observed_temperature_percentiles_K=np.percentile(td,[1,50,99,100]).tolist())
path.with_suffix('.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2))
