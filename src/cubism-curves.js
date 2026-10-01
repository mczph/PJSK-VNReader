// Cubism motion3 segments: linear, Bezier, stepped, inverse stepped.
export function sampleCurve(segments,time) {
  let x=segments[0],y=segments[1],i=2;
  if(time<=x)return y;
  while(i<segments.length){
    const kind=segments[i++];
    if(kind===1){const [x1,y1,x2,y2,x3,y3]=segments.slice(i,i+6);i+=6;
      if(time<=x3){let lo=0,hi=1;const bez=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;for(let n=0;n<16;n++){const mid=(lo+hi)/2;if(bez(x,x1,x2,x3,mid)<time)lo=mid;else hi=mid;}return bez(y,y1,y2,y3,(lo+hi)/2);}x=x3;y=y3;
    }else{const nx=segments[i++],ny=segments[i++];if(time<=nx){if(kind===2)return y;if(kind===3)return ny;return y+(ny-y)*Math.max(0,Math.min(1,(time-x)/(nx-x || 1)));}x=nx;y=ny;}
  }
  return y;
}
