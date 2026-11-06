const visible = (point) => point && (point.score || 0) >= 0.25;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
const mapPose = (pose) => new Map((pose?.keypoints || []).map((point) => [point.name, point]));

export function poseIdentity(pose) {
  const points = (pose?.keypoints || []).filter(visible);
  const coreNames = new Set(['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip']);
  const core = points.filter((point) => coreNames.has(point.name));
  const source = core.length >= 2 ? core : points;
  if (!source.length) return null;
  const centroid = source.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  centroid.x /= source.length; centroid.y /= source.length;
  const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
  return { centroid, box: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }, visibleCount: points.length };
}

function gripEvidence(pose) {
  const points = mapPose(pose);
  const lw = points.get('left_wrist'); const rw = points.get('right_wrist');
  const ls = points.get('left_shoulder'); const rs = points.get('right_shoulder');
  const lh = points.get('left_hip'); const rh = points.get('right_hip');
  if (![lw, rw, ls, rs].every(visible)) return { score: 0, wristMid: null, torso: 1 };
  const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const hipPoints = [lh, rh].filter(visible);
  const hipMid = hipPoints.length ? hipPoints.reduce((sum, point) => ({ x: sum.x + point.x / hipPoints.length, y: sum.y + point.y / hipPoints.length }), { x: 0, y: 0 }) : { x: shoulderMid.x, y: shoulderMid.y + 80 };
  const torso = Math.max(20, distance(shoulderMid, hipMid));
  const wristMid = { x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2 };
  const wristsLevel = 1 - clamp(Math.abs(lw.y - rw.y) / torso, 0, 1);
  const handsAbove = clamp((shoulderMid.y - wristMid.y) / torso, 0, 1);
  const separation = distance(lw, rw) / torso;
  const plausibleSeparation = separation >= 0.18 && separation <= 2.2 ? 1 : 0;
  return { score: wristsLevel * 0.35 + handsAbove * 0.45 + plausibleSeparation * 0.2, wristMid, torso };
}

export function acquireGymnast(samples, width, height) {
  const diagonal = Math.hypot(width, height); const tracks = [];
  const ankleYs = samples.flatMap(({ poses }) => poses.flatMap((pose) => {
    const points = mapPose(pose); return [points.get('left_ankle'), points.get('right_ankle')].filter(visible).map((point) => point.y);
  }));
  const floorY = ankleYs.length ? [...ankleYs].sort((a, b) => a - b)[Math.floor(ankleYs.length * 0.9)] : height * 0.9;

  samples.forEach(({ time, poses }) => {
    const available = new Set(tracks.keys());
    poses.forEach((pose) => {
      const identity = poseIdentity(pose); if (!identity || identity.visibleCount < 7) return;
      let best = -1; let bestDistance = Infinity;
      available.forEach((index) => {
        const track = tracks[index]; const gap = time - track.lastTime;
        const delta = distance(identity.centroid, track.lastCentroid) / diagonal;
        if (gap <= 1.1 && delta < 0.2 && delta < bestDistance) { best = index; bestDistance = delta; }
      });
      if (best < 0) { best = tracks.length; tracks.push({ frames: [], lastTime: time, lastCentroid: identity.centroid }); }
      else available.delete(best);
      const grip = gripEvidence(pose); const points = mapPose(pose);
      const ankles = [points.get('left_ankle'), points.get('right_ankle')].filter(visible);
      const airborne = ankles.length === 2 && Math.max(...ankles.map((point) => point.y)) < floorY - height * 0.035;
      tracks[best].frames.push({ time, pose, identity, grip, airborne });
      tracks[best].lastTime = time; tracks[best].lastCentroid = identity.centroid;
    });
  });

  const ranked = tracks.map((track) => {
    let gripDuration = 0; let runStart = null; let lastGrip = null; let stablePairs = 0; let gripPairs = 0;
    track.frames.forEach((frame) => {
      if (frame.grip.score >= 0.72) {
        if (runStart === null || (lastGrip !== null && frame.time - lastGrip > 0.8)) runStart = frame.time;
        if (lastGrip !== null && frame.time - lastGrip <= 0.8) gripDuration = Math.max(gripDuration, frame.time - runStart);
        const previous = track.frames.findLast?.((item) => item.time < frame.time && item.grip.score >= 0.72);
        if (previous?.grip.wristMid) { gripPairs += 1; if (distance(previous.grip.wristMid, frame.grip.wristMid) / diagonal < 0.035) stablePairs += 1; }
        lastGrip = frame.time;
      }
    });
    const airborneCount = track.frames.filter((frame) => frame.airborne).length;
    const groundCount = track.frames.filter((frame) => !frame.airborne).length;
    const stableGrip = gripPairs ? stablePairs / gripPairs : 0;
    const score = Math.min(1, gripDuration / 1.8) * 0.45 + Math.min(1, airborneCount / 3) * 0.25 + Math.min(1, groundCount / 2) * 0.1 + stableGrip * 0.2;
    return { track, score, gripDuration, airborneCount, stableGrip };
  }).sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  if (!winner || winner.score < 0.42) return null;
  const lockFrame = [...winner.track.frames].reverse().find((frame) => frame.grip.score >= 0.72) || winner.track.frames.at(-1);
  return { pose: lockFrame.pose, centroid: lockFrame.identity.centroid, wristAnchor: lockFrame.grip.wristMid, score: winner.score, gripDuration: winner.gripDuration, stableGrip: winner.stableGrip, floorY };
}

export function selectLockedAthlete(poses, lock, width, height) {
  if (!poses?.length) return null;
  if (!lock) return poses.map((pose) => ({ pose, identity: poseIdentity(pose) })).filter((item) => item.identity).sort((a, b) => b.identity.visibleCount - a.identity.visibleCount)[0]?.pose || null;
  const diagonal = Math.hypot(width, height);
  const ranked = poses.map((pose) => {
    const identity = poseIdentity(pose); const grip = gripEvidence(pose);
    if (!identity) return { pose, score: Infinity };
    const bodyDelta = distance(identity.centroid, lock.centroid) / diagonal;
    const handDelta = lock.wristAnchor && grip.wristMid ? distance(grip.wristMid, lock.wristAnchor) / diagonal : 0.2;
    return { pose, identity, grip, score: bodyDelta * 0.72 + handDelta * 0.28 };
  }).sort((a, b) => a.score - b.score);
  const selected = ranked[0];
  if (!selected || selected.score > 0.32) return null;
  lock.centroid = selected.identity.centroid;
  if (selected.grip.wristMid && selected.grip.score >= 0.55) lock.wristAnchor = selected.grip.wristMid;
  return selected.pose;
}

export function correctSideView(keypoints = []) {
  const points = new Map(keypoints.map((point) => [point.name, point]));
  const ls = points.get('left_shoulder'); const rs = points.get('right_shoulder');
  const lh = points.get('left_hip'); const rh = points.get('right_hip');
  const shoulders = [ls, rs].filter(visible); const hips = [lh, rh].filter(visible);
  if (shoulders.length < 2 || !hips.length) return { keypoints, offAxisDeg: 0, scaleX: 1 };
  const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const hipMid = hips.reduce((sum, point) => ({ x: sum.x + point.x / hips.length, y: sum.y + point.y / hips.length }), { x: 0, y: 0 });
  const torso = Math.max(1, distance(shoulderMid, hipMid));
  const ratio = distance(ls, rs) / torso;
  const offAxisDeg = clamp((ratio - 0.12) / 0.7 * 35, 0, 35);
  const scaleX = 1 / Math.cos(offAxisDeg * Math.PI / 180);
  const corrected = keypoints.map((point) => ({ ...point, x: hipMid.x + (point.x - hipMid.x) * scaleX }));
  return { keypoints: corrected, offAxisDeg, scaleX };
}
