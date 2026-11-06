export const POSE_CONNECTIONS = [
  ['left_shoulder','right_shoulder'],['left_shoulder','left_elbow'],['left_elbow','left_wrist'],
  ['right_shoulder','right_elbow'],['right_elbow','right_wrist'],['left_shoulder','left_hip'],
  ['right_shoulder','right_hip'],['left_hip','right_hip'],['left_hip','left_knee'],
  ['left_knee','left_ankle'],['right_hip','right_knee'],['right_knee','right_ankle'],
];

export const FIG_RULE_REFERENCES = {
  giant: { code:'I.31', nameEn:'Giant swing backward', nameZh:'後大迴環', group:'I', difficulty:'A', value:.1, figure:'straight' },
  stalder: { code:'III.38', nameEn:'Stalder through handstand', nameZh:'施塔德近槓迴環至倒立', group:'III', difficulty:'B', value:.2, figure:'pike' },
  kovacs: { code:'II.88', nameEn:'Kovacs', nameZh:'科瓦克斯騰越', group:'II', difficulty:'D', value:.4, figure:'tuck' },
  kolman: { code:'II.89', nameEn:'Kolman', nameZh:'科爾曼騰越', group:'II', difficulty:'E', value:.5, figure:'twist' },
  kovacsStraight: { code:'II.95', nameEn:'Kovacs piked or straight', nameZh:'屈體／直體科瓦克斯', group:'II', difficulty:'E', value:.5, figure:'flight' },
  dismount: { code:'IV.33', nameEn:'Double salto backward tucked with 1/1 turn', nameZh:'團身後空翻兩周轉體一周下法', group:'IV', difficulty:'C', value:.3, figure:'dismount' },
};

const point = (map, name) => map.get(name);
const distance = (a, b) => a && b ? Math.hypot(a.x-b.x, a.y-b.y) : 0;

export function poseFeatures(keypoints = []) {
  const visible = keypoints.filter((item) => (item.score || 0) >= .25);
  const map = new Map(visible.map((item) => [item.name, item]));
  const shoulderWidth = distance(point(map,'left_shoulder'), point(map,'right_shoulder')) || 1;
  const ankles = distance(point(map,'left_ankle'), point(map,'right_ankle')) / shoulderWidth;
  const wrists = distance(point(map,'left_wrist'), point(map,'right_wrist')) / shoulderWidth;
  const hip = point(map,'left_hip'); const shoulder = point(map,'left_shoulder'); const knee = point(map,'left_knee');
  const compact = hip && shoulder && knee ? distance(hip,knee) / Math.max(1,distance(hip,shoulder)) : 1;
  const inverted = hip && shoulder ? hip.y < shoulder.y : false;
  const confidence = visible.length ? visible.reduce((sum,item)=>sum+(item.score||0),0)/visible.length : 0;
  return { ankles, wrists, compact, inverted, confidence, visibleCount:visible.length };
}

export function matchFigRule({ keypoints = [], normalizedMotion = 0, position = 0, isLast = false }) {
  const features = poseFeatures(keypoints);
  let rule;
  if (isLast && position > .76) rule = FIG_RULE_REFERENCES.dismount;
  else if (normalizedMotion > .86 && features.compact < .85) rule = FIG_RULE_REFERENCES.kolman;
  else if (normalizedMotion > .75 && features.compact < 1.05) rule = FIG_RULE_REFERENCES.kovacs;
  else if (normalizedMotion > .66) rule = FIG_RULE_REFERENCES.kovacsStraight;
  else if (features.compact < .82 || (features.inverted && normalizedMotion > .35)) rule = FIG_RULE_REFERENCES.stalder;
  else rule = FIG_RULE_REFERENCES.giant;
  const similarity = Math.max(.2, Math.min(.88, features.confidence * .7 + normalizedMotion * .18));
  return { ...rule, similarity, poseConfidence:features.confidence, visibleKeypoints:features.visibleCount };
}

export function drawPose(ctx, pose, width, height) {
  ctx.clearRect(0,0,width,height);
  if (!pose?.keypoints) return;
  const map = new Map(pose.keypoints.map((item)=>[item.name,item]));
  ctx.lineWidth = Math.max(2,width/320); ctx.strokeStyle = '#d7ff36'; ctx.fillStyle = '#11d9c0';
  POSE_CONNECTIONS.forEach(([a,b])=>{ const p1=map.get(a),p2=map.get(b); if((p1?.score||0)<.25||(p2?.score||0)<.25)return; ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke(); });
  pose.keypoints.forEach((p)=>{ if((p.score||0)<.25)return;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2.5,width/240),0,Math.PI*2);ctx.fill(); });
}
