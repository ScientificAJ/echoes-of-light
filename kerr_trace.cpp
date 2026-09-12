// ECHOES OF LIGHT. Backward null geodesics in Kerr, G=M=c=1.
// Build: g++ -O3 -fopenmp -std=c++17 kerr_trace.cpp -o kerr_trace
// Run: kerr_trace WIDTH HEIGHT OUTPUT.bin STEP_SCALE [VIEW_WIDTH CX CY ROLL_DEG]
// Output: row-major float32 records [r, phi, t_ret, g, crossings, sky_mu, sky_phi, status].
// status: 1 opaque disk, 2 celestial sphere, 0 horizon, -1 numerical failure.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <algorithm>
#include <vector>
#include <chrono>
#include <omp.h>
constexpr double a=.9, pi=3.14159265358979323846;
const double rp=1+std::sqrt(1-a*a), rm=1-std::sqrt(1-a*a);
const double z1=1+std::cbrt(1-a*a)*(std::cbrt(1+a)+std::cbrt(1-a));
const double z2=std::sqrt(3*a*a+z1*z1);
const double risco=3+z2-std::sqrt((3-z1)*(3+z1+2*z2));
constexpr double rout=38., incl=75*pi/180.;
struct S {double u,v,m,w,p,t;};
S add(S x,S y,double h){return {x.u+h*y.u,x.v+h*y.v,x.m+h*y.m,x.w+h*y.w,x.p+h*y.p,x.t+h*y.t};}
double U(double u,double l,double q){return 1+(a*a-l*l-q)*u*u+2*((l-a)*(l-a)+q)*u*u*u-a*a*q*u*u*u*u;}
S deriv(S s,double l,double q){
  double u=s.u, m=s.m, ss=std::max(1e-16,1-m*m), D=1-2*u+a*a*u*u;
  double P=1+(a*a-a*l)*u*u;
  // Rationalized subtraction avoids catastrophic cancellation at infinity.
  double diff;
  if(s.v>0){
    double up=(a*a-l*l-q)+2*((l-a)*(l-a)+q)*u-a*a*q*u*u;
    diff=up/(s.v+1)-(a*a-a*l);
  }else diff=(s.v-P)/(u*u);
  return {s.v,(a*a-l*l-q)*u+3*((l-a)*(l-a)+q)*u*u-2*a*a*q*u*u*u,
    s.w,(a*a-q-l*l)*m-2*a*a*m*m*m,
    -(a*P/D+l/ss-a), (1+a*a*u*u)/D*diff-a*(l-a*ss)};
}
S step(S s,double h,double l,double q){
  S k1=deriv(s,l,q),k2=deriv(add(s,k1,h/2),l,q),k3=deriv(add(s,k2,h/2),l,q),k4=deriv(add(s,k3,h),l,q);
  return {s.u+h*(k1.u+2*k2.u+2*k3.u+k4.u)/6,
    s.v+h*(k1.v+2*k2.v+2*k3.v+k4.v)/6,
    s.m+h*(k1.m+2*k2.m+2*k3.m+k4.m)/6,
    s.w+h*(k1.w+2*k2.w+2*k3.w+k4.w)/6,
    s.p+h*(k1.p+2*k2.p+2*k3.p+k4.p)/6,
    s.t+h*(k1.t+2*k2.t+2*k3.t+k4.t)/6};
}
double rstar(double r){return r+2*rp/(rp-rm)*std::log((r-rp)/2)-2*rm/(rp-rm)*std::log((r-rm)/2);}
struct Audit {double radial=0,polar=0;int steps=0;};
void trace(double alpha,double beta,double scale,float *o,bool vacuum=false,Audit *audit=nullptr){
  double si=std::sin(incl),ci=std::cos(incl),l=-alpha*si,q=beta*beta+(alpha*alpha-a*a)*ci*ci;
  S s={0,1,ci,si*beta,0,0};
  int crossings=0;
  double hbase=.028*scale/std::sqrt(alpha*alpha+beta*beta+1);
  for(int it=0;it<50000;++it){
    double ss=std::max(1e-14,1-s.m*s.m);
    double h=std::min(hbase,.055*scale*ss/(std::abs(l)+std::abs(s.w)+1e-12));
    // Do not integrate through a horizon or too far beyond celestial infinity.
    if(s.v>0) h=std::min(h,.08*std::max(1e-7,1/rp-s.u)/std::max(s.v,1e-8));
    if(s.u>0 && s.v<0) h=std::min(h,.2*s.u/std::abs(s.v));
    S n=step(s,h,l,q);
    if(s.m*n.m<0){
      double hh=h*s.m/(s.m-n.m); S hit=step(s,hh,l,q);
      for(int j=0;j<3;++j){hh=std::clamp(hh-hit.m/hit.w,0.,h);hit=step(s,hh,l,q);}
      double r=1/hit.u;
      if(r>=risco && r<=rout && !vacuum){
        double om=1/(std::pow(r,1.5)+a);
        double ut=(std::pow(r,1.5)+a)/std::sqrt(r*r*r-3*r*r+2*a*std::pow(r,1.5));
        o[0]=r;o[1]=std::remainder(hit.p,2*pi);o[2]=hit.t+rstar(r);
        o[3]=1/(ut*(1-om*l));o[4]=crossings;o[7]=1;return;
      }
      if(hit.u>1e-6) ++crossings;
    }
    if(audit){
      double pot=U(n.u,l,q), mp=q+(a*a-q-l*l)*n.m*n.m-a*a*std::pow(n.m,4);
      audit->radial=std::max(audit->radial,std::abs(n.v*n.v-pot)/(1+std::abs(pot)));
      audit->polar=std::max(audit->polar,std::abs(n.w*n.w-mp)/(1+std::abs(q)+l*l));
      audit->steps++;
    }
    if(n.u>=1/(rp+1e-5)){o[7]=0;return;}
    if(n.u<1e-5 && n.v<0){
      // Extrapolate the small remaining Mino interval to infinity.
      double he=n.u/-n.v; S sky=step(n,he,l,q);
      o[5]=std::clamp(sky.m,-1.,1.);o[6]=std::remainder(sky.p,2*pi);o[4]=crossings;o[7]=2;return;
    }
    if(!std::isfinite(n.u)||!std::isfinite(n.p)||std::abs(n.m)>1.0000001){o[7]=-1;return;}
    s=n;
  }
  o[7]=-1;
}
int main(int argc,char**argv){
  if(argc<5){fprintf(stderr,"usage: kerr_trace W H out.bin step_scale [width cx cy roll]\n");return 1;}
  int W=atoi(argv[1]),H=atoi(argv[2]);double scale=atof(argv[4]);
  double width=argc>5?atof(argv[5]):55.,cx=argc>6?atof(argv[6]):.55,cy=argc>7?atof(argv[7]):.54;
  double roll=(argc>8?atof(argv[8]):13)*pi/180.;
  std::vector<float> data((size_t)W*H*8,0);auto start=std::chrono::steady_clock::now();
  #pragma omp parallel for schedule(dynamic,2)
  for(int y=0;y<H;++y){for(int x=0;x<W;++x){
    double xx=(x+.5-cx*W)*width/W, yy=(cy*H-y-.5)*width/W;
    double al=std::cos(roll)*xx+std::sin(roll)*yy,be=-std::sin(roll)*xx+std::cos(roll)*yy;
    float* out=&data[((size_t)y*W+x)*8];trace(al,be,scale,out);
    // Near the coordinate poles, rare rays need a smaller numerical step.
    for(int retry=1;out[7]<0 && retry<=3;++retry){
      std::fill(out,out+8,0.f);trace(al,be,scale/std::pow(4.,retry),out);
    }
  }}
  FILE*f=fopen(argv[3],"wb");if(!f)return 2;fwrite(data.data(),sizeof(float),data.size(),f);fclose(f);
  size_t count[4]={};for(size_t k=0;k<(size_t)W*H;++k){int v=data[k*8+7];count[v<0?3:v]++;}
  fprintf(stderr,"%dx%d in %.2f s; horizon=%zu disk=%zu sky=%zu failed=%zu; ISCO=%.12f horizon=%.12f\n",W,H,std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count(),count[0],count[1],count[2],count[3],risco,rp);
  return 0;
}
