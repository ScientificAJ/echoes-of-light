#define main renderer_main
#include "kerr_trace.cpp"
#undef main
#include <random>
int main(){
  std::mt19937 rng(90210);std::uniform_real_distribution<double> dx(-24,24),dy(-14,14);
  Audit audit;int fail=0,mismatch=0,compared=0;double dr=0,dp=0,dt=0,dg=0;
  for(int i=0;i<16000;++i){
    double x=dx(rng),y=dy(rng);float coarse[8]={},fine[8]={};
    trace(x,y,.5,coarse,false,&audit);trace(x,y,.25,fine);
    if(coarse[7]<0 || fine[7]<0) ++fail;
    if(coarse[7]!=fine[7] || coarse[4]!=fine[4]){++mismatch;continue;}
    if(coarse[7]==1){++compared;dr=std::max(dr,std::abs(double(coarse[0]-fine[0])));
      dp=std::max(dp,std::abs(std::remainder(double(coarse[1]-fine[1]),2*pi)));
      dt=std::max(dt,std::abs(double(coarse[2]-fine[2])));dg=std::max(dg,std::abs(double(coarse[3]-fine[3])));}
  }
  int edgecases=0,edgemismatch=0;
  for(int k=0;k<1000;++k){
    double r=1.55+2.4*(k+.5)/1000;
    double xi=(r*r*(r-3)+a*a*(r+1))/(a*(1-r));
    double eta=r*r*r*(4*a*a-r*(r-3)*(r-3))/(a*a*(r-1)*(r-1));
    double x=-xi/std::sin(incl),ysq=eta+a*a*std::pow(std::cos(incl),2)-xi*xi/std::pow(std::tan(incl),2);
    if(ysq<=0)continue;
    for(int sign:{-1,1})for(int side:{-1,1}){
      double scale=1+side*1e-4;float hit[8]={};
      trace(1.7+(x-1.7)*scale,sign*std::sqrt(ysq)*scale,.5,hit,true);
      int want=side<0?0:2;++edgecases;if(hit[7]!=want)++edgemismatch;
    }
  }
  printf("{\n  \"random_rays\":16000,\n  \"failed\":%d,\n  \"step_halving_classification_mismatches\":%d,\n  \"compared_disk_rays\":%d,\n  \"max_delta_r_rg\":%.10g,\n  \"max_delta_phi_rad\":%.10g,\n  \"max_delta_time_tg\":%.10g,\n  \"max_delta_g\":%.10g,\n  \"max_normalized_radial_constraint_error\":%.10g,\n  \"max_normalized_polar_constraint_error\":%.10g,\n  \"analytic_shadow_bracket_rays\":%d,\n  \"analytic_shadow_mismatches\":%d\n}\n",fail,mismatch,compared,dr,dp,dt,dg,audit.radial,audit.polar,edgecases,edgemismatch);
  return (fail || mismatch || edgemismatch)?1:0;
}
