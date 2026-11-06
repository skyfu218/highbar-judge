import { describe, expect, it } from 'vitest';
import { acquireGymnast, correctSideView, selectLockedAthlete } from './athleteTracking';

const pose = ({ x, wristY, ankleY }) => ({ keypoints: [
  {name:'left_shoulder',x:x-10,y:150,score:.95},{name:'right_shoulder',x:x+10,y:150,score:.95},
  {name:'left_elbow',x:x-13,y:125,score:.9},{name:'right_elbow',x:x+13,y:125,score:.9},
  {name:'left_wrist',x:x-12,y:wristY,score:.95},{name:'right_wrist',x:x+12,y:wristY+1,score:.95},
  {name:'left_hip',x:x-7,y:210,score:.95},{name:'right_hip',x:x+7,y:210,score:.95},
  {name:'left_knee',x:x-7,y:(210+ankleY)/2,score:.9},{name:'right_knee',x:x+7,y:(210+ankleY)/2,score:.9},
  {name:'left_ankle',x:x-7,y:ankleY,score:.95},{name:'right_ankle',x:x+7,y:ankleY,score:.95},
] });

describe('gymnast acquisition and tracking', () => {
  it('locks the person who grips overhead and leaves the floor, not a floor bystander', () => {
    const samples = Array.from({length:7},(_,index)=>({time:index*.45,poses:[
      pose({x:320,wristY:100,ankleY:index<2?450:350}),
      pose({x:70,wristY:175,ankleY:455}),
    ]}));
    const lock = acquireGymnast(samples,640,480);
    expect(lock).not.toBeNull();
    expect(lock.centroid.x).toBeGreaterThan(250);
    expect(lock.gripDuration).toBeGreaterThan(1.5);
    const selected = selectLockedAthlete(samples[0].poses,lock,640,480);
    expect(selected.keypoints.find((point)=>point.name==='left_hip').x).toBeGreaterThan(250);
  });

  it('adds a bounded horizontal correction for an oblique side view', () => {
    const result = correctSideView(pose({x:300,wristY:100,ankleY:380}).keypoints);
    expect(result.offAxisDeg).toBeGreaterThan(0);
    expect(result.offAxisDeg).toBeLessThanOrEqual(35);
    expect(result.scaleX).toBeGreaterThan(1);
  });
});
