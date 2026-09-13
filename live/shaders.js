/* Numerical Kerr transfer shader and retarded spectral emission. WebGL 2. */
window.ECHO_SHADERS = {
vertex: `#version 300 es
precision highp float;
out vec2 uv;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1); }
`,
trace: `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
layout(location=0) out vec4 hitData;
layout(location=1) out vec4 pathData;
uniform vec2 uSize;
uniform float uWidth,uInclination,uRoll,uStep;
const float a=.9, rp=1.435889894354,rm=.564110105646,isco=2.320883041762,PI=3.14159265359;
// Explicit polynomials avoid implementation-dependent GPU trig accuracy.
vec2 trig(float t){
 float x=mod(t+PI,2.*PI)-PI,sg=1.;
 if(x>PI*.5){x=PI-x;sg=-1.;}else if(x< -PI*.5){x=-PI-x;sg=-1.;}
 float z=x*x;
 float sn=x*(1.+z*(-.1666666666667+z*(.00833333333333+z*(-.000198412698413+z*(.0000027557319224-z*.00000002505210839)))));
 float cs=1.+z*(-.5+z*(.0416666666667+z*(-.00138888888889+z*(.0000248015873016+z*(-.00000027557319224+z*.0000000020876757)))));
 return vec2(sn,sg*cs);
}
float atanAcc(float y,float x){
 float ay=abs(y),ax=abs(x),z=min(ax,ay)/max(max(ax,ay),1.e-30),offset=0.;
 if(z>.41421356237){z=(z-1.)/(z+1.);offset=PI*.25;}
 float q=z*z,t=offset+z*(1.+q*(-.333333333333+q*(.2+q*(-.142857142857+q*(.111111111111+q*(-.090909090909+q*(.076923076923+q*(-.066666666667+q*.058823529412))))))));
 if(ay>ax)t=PI*.5-t;if(x<0.)t=PI-t;if(y<0.)t=-t;return t;
}
// Polar phase removes the coordinate singularity at the spin axis.
float K,rootK,epsilonPolar,wMax,poleCoefficient,initialChi;
struct State {vec4 z;vec2 pt;};
State addS(State s,State d,float h){return State(s.z+d.z*h,s.pt+d.pt*h);}
float muAt(float chi){return rootK*trig(chi).y;}
float poleAngle(float chi){vec2 sc=trig(chi);float sn=sc.x,cs=sc.y;return chi+atanAcc((1.-epsilonPolar)*sn*cs,epsilonPolar*cs*cs+sn*sn);}
float phiAt(State s){return s.pt.x-poleCoefficient*(poleAngle(s.z.z)-poleAngle(initialChi));}
State deriv(State s,float l,float q){
 float u=s.z.x,v=s.z.y,chi=s.z.z;vec2 sc=trig(chi);float sn=sc.x,cs=sc.y;
 float ss=epsilonPolar*epsilonPolar+K*sn*sn,D=max(1.-2.*u+a*a*u*u,1.e-6);
 float P=1.+(a*a-a*l)*u*u,chiSpeed=sqrt(a*a*K*cs*cs+q/K);
 float dif=v>0.?((a*a-l*l-q)+2.*((l-a)*(l-a)+q)*u-a*a*q*u*u)/(v+1.)-(a*a-a*l):(v-P)/max(u*u,1.e-12);
 float residual=l*a*a*K*sn*sn/(max(ss,1.e-20)*wMax*(wMax+chiSpeed));
 return State(vec4(v,(a*a-l*l-q)*u+3.*((l-a)*(l-a)+q)*u*u-2.*a*a*q*u*u*u,chiSpeed,0),
  vec2(-(a*P/D-a)-residual,(1.+a*a*u*u)/D*dif-a*(l-a*ss)));
}
State rk(State s,float h,float l,float q){
 State k1=deriv(s,l,q),k2=deriv(addS(s,k1,.5*h),l,q),k3=deriv(addS(s,k2,.5*h),l,q),k4=deriv(addS(s,k3,h),l,q);
 return State(s.z+h*(k1.z+2.*k2.z+2.*k3.z+k4.z)/6.,s.pt+h*(k1.pt+2.*k2.pt+2.*k3.pt+k4.pt)/6.);
}
float rstar(float r){return r+2.*rp/(rp-rm)*log((r-rp)/2.)-2.*rm/(rp-rm)*log((r-rm)/2.);}
// Positive Bernstein coefficients certify U>0 all the way to the horizon.
// Below the ISCO, an inward ray with no remaining radial root cannot hit the disk.
bool certifiedCapture(float u,float l,float q){
 float c=a*a-l*l-q,d=(l-a)*(l-a)+q,e=-a*a*q;
 float span=1./rp-u;
 float f=1.+u*u*(c+u*(2.*d+u*e));
 float f1=2.*c*u+6.*d*u*u+4.*e*u*u*u;
 float f2=2.*c+12.*d*u+12.*e*u*u,f3=12.*d+24.*e*u;
 vec4 b=vec4(f,f+span*f1*.25,f+span*f1*.5+span*span*f2/12.,
  f+span*f1*.75+span*span*f2*.25+span*span*span*f3/24.);
 float h=1./rp,endpoint=1.+h*h*(c+h*(2.*d+h*e));
 float scale=max(1.,max(abs(c)*h*h,max(2.*abs(d)*h*h*h,abs(e)*h*h*h*h)));
 return min(min(b.x,b.y),min(min(b.z,b.w),endpoint))>1.e-5*scale;
}
void main(){
 vec2 xy=(uv-vec2(.55,.46))*vec2(uWidth,uWidth*uSize.y/uSize.x);
 vec2 rc=trig(uRoll);float al=rc.y*xy.x+rc.x*xy.y,be=-rc.x*xy.x+rc.y*xy.y;
 vec2 ic=trig(uInclination);float si=ic.x,ci=ic.y;if(abs(ci)<1.e-6)ci=0.;float l=-al*si,q=be*be+(al*al-a*a)*ci*ci;
 hitData=vec4(0);pathData=vec4(-1,0,0,0);
 // Here q<0 implies impact radius <a and a positive radial polynomial: capture.
 if(q<0.){pathData=vec4(0);return;}
 q=max(q,1.e-12);float B=a*a-q-l*l,disc=sqrt(B*B+4.*a*a*q);
 K=clamp(B<0.?2.*q/(disc-B):(B+disc)/(2.*a*a),1.e-12,1.);
 rootK=sqrt(K);epsilonPolar=max(abs(l)*sqrt(K/(q+a*a*K)),1.e-10);
 wMax=sqrt(a*a*K+q/K);poleCoefficient=(l<0.?-1.:1.)*sqrt((q+a*a*K)/K)/wMax;
 initialChi=atanAcc(-si*be/sqrt(a*a*ci*ci+q/K),ci);
 State s=State(vec4(0,1,initialChi,0),vec2(0));float order=0.;
 float base=uStep/sqrt(al*al+be*be+1.);
 for(int it=0;it<1400;++it){
  float h=base;
  if(s.z.y>0.)h=min(h,.16*max(1.e-6,1./rp-s.z.x)/max(s.z.y,1.e-7));
  if(s.z.x>0.&&s.z.y<0.)h=min(h,.35*s.z.x/abs(s.z.y));
  State n=rk(s,h,l,q);float ms=muAt(s.z.z),mn=muAt(n.z.z);
  if(ms*mn<0.){
   float lo=min(s.z.x,n.z.x),hi=max(s.z.x,n.z.x);
   bool outsideDisk=s.z.y*n.z.y>0.&&lo>1.e-6&&(hi<1./38.||lo>1./isco);
   if(outsideDisk){order+=1.;}else{
   float hh=h*ms/(ms-mn);State event=rk(s,hh,l,q);
   for(int j=0;j<3;++j){vec2 ec=trig(event.z.z);float w=-rootK*ec.x*sqrt(a*a*K*ec.y*ec.y+q/K);hh=clamp(hh-muAt(event.z.z)/w,0.,h);event=rk(s,hh,l,q);}
   float r=1./event.z.x;
   if(r>=isco&&r<=38.){
    float r15=r*sqrt(r),omega=1./(r15+a),ut=(r15+a)/sqrt(r*r*r-3.*r*r+2.*a*r15);
    hitData=vec4(r,mod(phiAt(event)+PI,2.*PI)-PI,event.pt.y+rstar(r),1./(ut*(1.-omega*l)));
    pathData=vec4(1,order,0,0);return;
   }if(event.z.x>1.e-6)order+=1.;
   }
  }
  if(n.z.x>=1./(rp+.0001)){pathData=vec4(0,order,0,0);return;}
  bool captureCheck=s.z.x<=1./isco||(s.z.x<1./1.65&&n.z.x>=1./1.65);
  if(n.z.x>1./isco&&n.z.y>0.&&captureCheck&&certifiedCapture(n.z.x,l,q)){pathData=vec4(0,order,0,0);return;}
  if(n.z.x<.00005&&n.z.y<0.){
   State sky=rk(n,n.z.x/-n.z.y,l,q);
   pathData=vec4(2,order,clamp(muAt(sky.z.z),-1.,1.),mod(phiAt(sky)+PI,2.*PI)-PI);return;
  }
  if(any(isnan(n.z))||any(isinf(n.z)))return;
  s=n;
 }
}
`,
shade: `#version 300 es
precision highp float;precision highp int;
in vec2 uv;out vec4 color;
uniform sampler2D uHit,uPath,uProfile,uSpectrum,uSky;
uniform float uTime,uAzimuth,uExposure,uHighlight,uStars;
uniform int uMode;
const float PI=3.14159265359,isco=2.320883041762;
float wrap(float x){return atan(sin(x),cos(x));}
uint hashGrid(ivec2 p,uint seed){uint h=(uint(p.x)*73856093u)^(uint(p.y)*19349663u)^seed;return (h^(h>>13u))*1274126177u;}
float value(ivec2 p,int period){p.y=(p.y%period+period)%period;return float(hashGrid(p,1783u)&65535u)/32767.5-1.;}
float noise2(vec2 p,int period){ivec2 i=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(value(i,period),value(i+ivec2(1,0),period),f.x),mix(value(i+ivec2(0,1),period),value(i+ivec2(1,1),period),f.x),f.y);}
vec2 field(float r,float phi,float t){
 float phase=phi-(t+160.)/(r*sqrt(r)+.9),lr=log(r),warp=noise2(vec2(7.*lr,phase*4./(2.*PI)),4);
 float n=.75*noise2(vec2(16.*lr+1.4*warp,phase*8./(2.*PI)),8)
  +.55*noise2(vec2(39.*lr+1.4*warp,phase*16./(2.*PI)),16)
  +.36*noise2(vec2(87.*lr+1.4*warp,phase*32./(2.*PI)),32)
  +.24*noise2(vec2(181.*lr+1.4*warp,phase*64./(2.*PI)),64)
  +.16*noise2(vec2(379.*lr+1.4*warp,phase*128./(2.*PI)),128)
  +.10*noise2(vec2(773.*lr+1.4*warp,phase*256./(2.*PI)),256)
  +.12*sin(141.*lr+4.*phase+6.*warp);
 // Integer azimuthal harmonic keeps the source continuous over a full orbit.
 float az=wrap(phase-1.),rr=5.4+.45*sin(2.*phase+1.);
 float f=exp(-.5*pow((r-rr)/.07,2.)-.5*pow(az/.65,2.))+.45*exp(-.5*pow((r-rr-.14)/.035,2.)-.5*pow(az/.55,2.));
 f*=1.+.35*cos(13.*phase);f*=exp(-.5*pow((t+5.)/220.,2.));
 float hot=exp(-.5*pow((r-8.3)/.33,2.)-.5*pow(wrap(phase+1.9)/.20,2.));
 return vec2(exp(n-.16)*(1.+5.*f+1.5*hot),f);
}
vec4 lookup(sampler2D tex,float x,int count){float p=clamp(x,0.,1.)*float(count-1);int i=int(floor(p));return mix(texelFetch(tex,ivec2(i,0),0),texelFetch(tex,ivec2(min(i+1,count-1),0),0),fract(p));}
vec3 spectrum(float t){return lookup(uSpectrum,log(max(t,1000.)/1000.)/log(500.),2048).rgb;}
void main(){
 vec4 path=texture(uPath,uv),hit=texture(uHit,uv);vec3 rgb=vec3(0);
 if(path.x>.5&&path.x<1.5){
  vec2 material=field(hit.x,hit.y+uAzimuth,hit.z+uTime);
  float te=lookup(uProfile,log(hit.x/isco)/log(38./isco),4096).r*pow(material.x,.25);
  rgb=spectrum(te*hit.w);
  if(uHighlight>.5)rgb*=.045+.955*smoothstep(.06,.65,material.y);
  if(uMode==1&&path.y>.5)rgb=vec3(0);
  if(uMode==2&&path.y<.5)rgb=vec3(0);
  if(uMode==3){float k=clamp((hit.w-.2)/1.2,0.,1.);rgb=mix(vec3(.38,.025,.005),vec3(.05,.32,.55),k);if(hit.w>.98&&hit.w<1.02)rgb=vec3(.35);}
  if(uMode==4){rgb=path.y<.5?vec3(.22,.15,.07):path.y<1.5?vec3(.04,.4,.48):vec3(.5,.13,.29);}
 }else if(path.x>1.5&&uMode<1)rgb=texture(uSky,uv).rgb*uStars;
 // Unresolved rays remain marked in the transfer data and are never invented.
 rgb*=uExposure;color=vec4(rgb/(1.+max(rgb.r,max(rgb.g,rgb.b))),1);
}
`,
sky: `#version 300 es
precision highp float;precision highp int;
in vec2 uv;out vec4 color;
uniform sampler2D uPath,uSpectrum;uniform float uAzimuth;
const float PI=3.14159265359;
uint hashGrid(ivec2 p,uint seed){uint h=(uint(p.x)*73856093u)^(uint(p.y)*19349663u)^seed;return (h^(h>>13u))*1274126177u;}
vec3 spectrum(float t){float p=clamp(log(t/1000.)/log(500.),0.,1.)*2047.;int i=int(floor(p));return mix(texelFetch(uSpectrum,ivec2(i,0),0),texelFetch(uSpectrum,ivec2(min(i+1,2047),0),0),fract(p)).rgb;}
void main(){
 vec4 path=texture(uPath,uv);
 vec2 p=vec2(mod(path.w+uAzimuth+PI,2.*PI)/(2.*PI)*1200.,acos(clamp(path.z,-1.,1.))/PI*600.);
 vec2 dx=dFdx(p),dy=dFdy(p);dx.x=mod(dx.x+600.,1200.)-600.;dy.x=mod(dy.x+600.,1200.)-600.;
 // Integrate finite Gaussian sources over an approximate elliptical pixel footprint.
 // Derivatives are bounded where a finite ray map cannot resolve a caustic.
 float latitude=sin(clamp(p.y/600.*PI,.1,PI-.1));dx.x*=latitude;dy.x*=latitude;
 dx=clamp(dx,vec2(-.75),vec2(.75));dy=clamp(dy,vec2(-.75),vec2(.75));
 vec3 rgb=vec3(0);
 if(path.x>1.5){
  for(int j=-1;j<=1;++j)for(int i=-1;i<=1;++i){
   ivec2 cell=ivec2(floor(p))+ivec2(i,j);cell.x=(cell.x%1200+1200)%1200;
   if(cell.y<0||cell.y>=600)continue;uint h=hashGrid(cell,1977u);if(h%1000u>=28u)continue;
   vec2 offset=vec2(float((h>>8u)&255u),float((h>>16u)&255u))/255.;
   vec2 d=p-(floor(p)+vec2(i,j)+offset);d.x*=latitude;
   float sigma=.065+.025*float((h>>24u)&255u)/255.,s2=sigma*sigma;
   float xx=s2+(dx.x*dx.x+dy.x*dy.x)/12.,yy=s2+(dx.y*dx.y+dy.y*dy.y)/12.,xy=(dx.x*dx.y+dy.x*dy.y)/12.;
   float det=max(xx*yy-xy*xy,1.e-12),distance=(yy*d.x*d.x-2.*xy*d.x*d.y+xx*d.y*d.y)/det;
   float amp=(.022+.75*pow(float((h>>18u)&1023u)/1023.,6.))*exp(-.5*distance)*s2/sqrt(det);
   vec3 c=spectrum(45000.+float((h>>5u)&1023u)/1023.*80000.);rgb+=amp*c/max(max(c.r,c.g),max(c.b,1.e-8));
  }
 }
 color=vec4(rgb,1);
}
`,
post: `#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
uniform sampler2D uColor;uniform vec2 uSize;uniform float uBloom;
vec3 exposed(vec2 p){return texture(uColor,p).rgb;}
void main(){
 vec3 c=exposed(uv),glow=vec3(0);vec2 d=1./uSize;
 if(uBloom>0.)for(int j=0;j<8;++j){float ang=float(j)*.785398163;vec2 v=vec2(cos(ang),sin(ang));
 glow+=max(exposed(uv+v*d*2.)-.18,0.)*.075+max(exposed(uv+v*d*7.)-.18,0.)*.025;}
 c+=glow*uBloom;c=clamp(c,0.,1.);color=vec4(mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c)),1);
}
`
};
