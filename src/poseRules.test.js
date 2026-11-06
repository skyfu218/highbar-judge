import { describe, expect, it } from 'vitest';
import { matchFigRule, poseFeatures } from './poseRules';

describe('pose-to-FIG rule matching', () => {
  it('reserves the final high-bar action for a dismount candidate', () => {
    const result = matchFigRule({ keypoints: [], normalizedMotion: .8, position: .92, isLast: true });
    expect(result).toMatchObject({ code: 'IV.33', group: 'IV', nameEn: 'Double salto backward tucked with 1/1 turn' });
  });

  it('reports visible pose confidence', () => {
    const features = poseFeatures([{name:'left_shoulder',x:0,y:0,score:.8},{name:'right_shoulder',x:10,y:0,score:.8}]);
    expect(features.visibleCount).toBe(2);
    expect(features.confidence).toBeCloseTo(.8);
  });
});
