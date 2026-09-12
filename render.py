"""Spectral, retarded-time thin-disk renderer. See PHYSICS.md for approximations.
Run with numpy, scipy and Pillow: python3 render.py MAP W H OUTPUT [--ss 1]
"""
import argparse, json
from functools import lru_cache
from pathlib import Path
import numpy as np
from scipy.integrate import cumulative_trapezoid
from scipy.ndimage import gaussian_filter
from PIL import Image, ImageDraw, ImageFont

A=.9
G=6.67430e-11; C=299792458.; MSUN=1.98847e30; SIGMA=5.670374419e-8
M=1e8*MSUN; RG=G*M/C**2; TG=RG/C
Z1=1+np.cbrt(1-A*A)*(np.cbrt(1+A)+np.cbrt(1-A))
Z2=np.sqrt(3*A*A+Z1*Z1)
ISCO=3+Z2-np.sqrt((3-Z1)*(3+Z1+2*Z2))
RP=1+np.sqrt(1-A*A)

def profile():
    r=np.geomspace(ISCO,38,40000)
    den=r**.75*np.sqrt(r**1.5-3*np.sqrt(r)+2*A)
    E=(r**1.5-2*np.sqrt(r)+A)/den
    L=(r*r-2*A*np.sqrt(r)+A*A)/den
    om=1/(r**1.5+A)
    dom=-1.5*np.sqrt(r)/(r**1.5+A)**2
    integral=cumulative_trapezoid((E-om*L)*np.gradient(L,r),r,initial=0)
    # Novikov-Thorne zero torque surface flux; cylindrical sqrt(-g)=r.
    eta=1-E[0]
    ledd=4*np.pi*G*M*1.67262192369e-27*C/6.6524587321e-29
    mdot=.035*ledd/(eta*C*C)
    f=mdot*C*C/(4*np.pi*RG*RG)*(-dom)/(r*(E-om*L)**2)*integral
    return r,(np.maximum(f,0)/SIGMA)**.25,dict(eta=float(eta),mdot_kg_s=float(mdot),mean_peak_temperature_K=float((f.max()/SIGMA)**.25))

def cmf(w):
    def gauss(center,left,right):
        t=(w-center)*np.where(w<center,left,right)
        return np.exp(-.5*t*t)
    x=1.056*gauss(599.8,.0264,.0323)+.362*gauss(442,.0624,.0374)-.065*gauss(501.1,.049,.0382)
    y=.821*gauss(568.8,.0213,.0247)+.286*gauss(530.9,.0613,.0322)
    z=1.217*gauss(437,.0845,.0278)+.681*gauss(459,.0385,.0725)
    return np.array([x,y,z])

@lru_cache(maxsize=4)
def spectral_lut(stretch=18):
    T=np.geomspace(1000,500000,6000)
    w=np.arange(380,781,2.)
    # Fixed wavelength stretch, identical for every source and ray.
    physical=w*1e-9/stretch
    B=(physical[None,:]**-5)/np.expm1(np.clip(.01438776877/(T[:,None]*physical[None,:]),0,700))
    xyz=B@cmf(w).T
    matrix=np.array([[3.2406,-1.5372,-.4986],[-.9689,1.8758,.0415],[.0557,-.204,1.057]])
    rgb=np.maximum(xyz@matrix.T,0)
    reference=np.interp(100000,T,xyz[:,1])
    return T,rgb/reference

def wrap(x):return np.arctan2(np.sin(x),np.cos(x))

def noise2(x,y,period):
    ix=np.floor(x).astype(np.int64);iy=np.floor(y).astype(np.int64)
    tx=x-ix;ty=y-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
    def v(dx,dy):
        h=(((ix+dx)*73856093)^(((iy+dy)%period)*19349663)^1783)&0xffffffff
        h=(h^(h>>13))*1274126177&0xffffffff
        return (h&65535)/32767.5-1
    return (v(0,0)*(1-tx)+v(1,0)*tx)*(1-ty)+(v(0,1)*(1-tx)+v(1,1)*tx)*ty

def texture(r,phi,t):
    # A deterministic material coordinate, advected with local Kerr Omega.
    om=1/(r**1.5+A)
    phase=phi-om*(t+160.)
    lr=np.log(r)
    # Coherent, stretched multi-scale modes, shared by all image orders.
    warp=noise2(7*lr,phase*4/(2*np.pi),4)
    noise=np.zeros_like(r)
    for radial,azimuth,amp in [(16,8,.75),(39,16,.55),(87,32,.36),(181,64,.24),(379,128,.16),(773,256,.10)]:
        noise+=amp*noise2(radial*lr+1.4*warp,phase*azimuth/(2*np.pi),azimuth)
    noise+=.12*np.sin(141*lr+4*phase+6*warp)
    mod=np.exp(noise-.16)
    # One distinctive filament, two strands with an irregular along-filament knot.
    rr=5.4+.45*np.sin(2.5*phase+.5)
    az=wrap(phase-1.0)
    filament=np.exp(-.5*((r-rr)/.070)**2)*np.exp(-.5*(az/.65)**2)
    filament+=.45*np.exp(-.5*((r-rr-.14)/.035)**2)*np.exp(-.5*(az/.55)**2)
    filament*=1+.35*np.cos(13*phase)
    # Long-lived transient: lifetime measured in GM/c^3, evaluated at emission.
    lifetime=np.exp(-.5*((t+5)/220)**2)
    hot=np.exp(-.5*((r-8.3)/.33)**2-.5*(wrap(phase+1.9)/.20)**2)
    return mod*(1+5*filament*lifetime+1.5*hot),filament*lifetime

def sky_radiance(mu,phi,stretch=18):
    # Synthetic faint background on a celestial sphere; sample only after escape.
    # Hash a regular longitude/latitude source catalog; same coordinates = same star.
    rows=600; cols=1200
    v=(np.arccos(np.clip(mu,-1,1))/np.pi)*rows
    u=((phi+np.pi)/(2*np.pi))*cols
    total=np.zeros(mu.shape+(3,),dtype=np.float32)
    temperatures,lut=spectral_lut(stretch)
    source_T=np.linspace(45000,125000,1024)
    source_RGB=np.stack([np.interp(source_T,temperatures,lut[:,c]) for c in range(3)],axis=-1)
    source_RGB/=np.maximum(source_RGB.max(axis=-1,keepdims=True),1e-15)
    for dy in [-1,0,1]:
      for dx in [-1,0,1]:
        ix=(np.floor(u).astype(np.int64)+dx)%cols; iy=np.floor(v).astype(np.int64)+dy
        h=((ix*73856093)^(iy*19349663)^1977)&0xffffffff
        h=(h^(h>>13))*1274126177 & 0xffffffff
        exists=(h%1000)<13
        ox=((h>>8)&255)/255.;oy=((h>>16)&255)/255.
        du=u-(np.floor(u)+dx+ox);dv=v-(np.floor(v)+dy+oy)
        d2=(du*np.sin(np.clip(v/rows*np.pi,.1,np.pi-.1)))**2+dv*dv
        b=.004+.045*(((h>>18)&1023)/1023.)**5
        point=np.exp(-d2/(2*.075**2))*b*exists
        spectrum=source_RGB[(h>>5)&1023]
        total+=point[...,None]*spectrum
    return total

def srgb(a):return np.where(a<=.0031308,12.92*a,1.055*np.maximum(a,0)**(1/2.4)-.055)

def compose(data,ss=1,exposure=1.25,stretch=18):
    H,W=data.shape[:2]; disk=data[...,7]==1; sky=data[...,7]==2
    r=np.where(disk,data[...,0],ISCO+1).astype(np.float64)
    phi=data[...,1];t=data[...,2]
    radii,temp,meta=profile()
    modulation,filament=texture(r,phi,t)
    emitted=np.interp(r,radii,temp)*modulation**.25
    observed=emitted*data[...,3]
    T,lut=spectral_lut(stretch)
    rgb=np.zeros((H,W,3),np.float32)
    for ch in range(3):rgb[...,ch]=np.interp(observed,T,lut[:,ch])*disk
    rgb+=sky_radiance(data[...,5],data[...,6],stretch)*sky[...,None]
    # Integrate radiance over subpixels before the camera response.
    if ss>1:rgb=rgb.reshape(H//ss,ss,W//ss,ss,3).mean(axis=(1,3))
    # Fixed exposure with a hue-preserving highlight shoulder.
    rgb*=exposure
    mx=rgb.max(axis=-1,keepdims=True)
    rgb=rgb/(1+mx)
    # Small optical PSF only. No geometrical rings or halo layers are drawn.
    bright=np.maximum(rgb-.18,0)
    rgb+=.045*gaussian_filter(bright,(1.0,1.0,0))+.016*gaussian_filter(bright,(5.,5.,0))
    out=(np.clip(srgb(rgb),0,1)*255+.5).astype(np.uint8)
    meta.update(mass_solar=1e8,spin=A,rg_m=RG,tg_seconds=TG,isco_rg=ISCO,horizon_bl_radius_rg=RP,
        isco_period_hours=2*np.pi*(ISCO**1.5+A)*TG/3600,
        r54_period_hours=2*np.pi*(5.4**1.5+A)*TG/3600,
        stretch=stretch,exposure=exposure,
        disk_ray_count=int(disk.sum()),failed_ray_count=int((data[...,7]<0).sum()),
        image_orders={str(int(n)):int(((data[...,4]==n)&disk).sum()) for n in np.unique(data[...,4][disk])},
        g_range=[float(data[...,3][disk].min()),float(data[...,3][disk].max())],
        observed_temperature_percentiles_K=np.percentile(observed[disk],[1,50,99,100]).tolist())
    return Image.fromarray(out),meta,filament

def lettering(im):
    im=im.copy();d=ImageDraw.Draw(im);W,H=im.size;s=W/3840
    font='/usr/share/fonts/truetype/dejavu/DejaVuSans-ExtraLight.ttf'
    mono='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
    def tracked(text,xy,size,spacing,color,fontpath=font):
        f=ImageFont.truetype(fontpath,max(9,int(size*s)));x,y=xy
        for c in text:
            d.text((x,y),c,font=f,fill=color);x+=d.textlength(c,font=f)+spacing*s
    tracked('ECHOES OF LIGHT',(W*.070,H*.103),66,13,(218,218,211))
    tracked('A STUDY IN CURVED SPACETIME',(W*.072,H*.158),15,4,(114,118,121),mono)
    tracked('KERR  /  10⁸ SOLAR MASSES  /  a* = 0.9',(W*.072,H*.904),16,1.5,(118,121,124),mono)
    tracked('EUV SPECTRUM · FALSE COLOR',(W*.729,H*.904),14,1.,(116,119,122),mono)
    return im

def main():
    p=argparse.ArgumentParser();p.add_argument('map');p.add_argument('width',type=int);p.add_argument('height',type=int);p.add_argument('output')
    p.add_argument('--ss',type=int,default=1);p.add_argument('--exposure',type=float,default=1.25);p.add_argument('--stretch',type=float,default=18)
    args=p.parse_args();data=np.memmap(args.map,dtype='float32',mode='r',shape=(args.height,args.width,8))
    im,meta,filament=compose(data,args.ss,args.exposure,args.stretch)
    path=Path(args.output);im.save(path);lettering(im).save(path.with_stem(path.stem+'-titled'))
    path.with_suffix('.json').write_text(json.dumps(meta,indent=2))
    print(json.dumps(meta,indent=2))
if __name__=='__main__':main()
