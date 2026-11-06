export const DIFFICULTY_VALUES = { A: 0.1, B: 0.2, C: 0.3, D: 0.4, E: 0.5, F: 0.6, G: 0.7, H: 0.8, I: 0.9, J: 1.0 };

export const GROUPS = {
  I: '長懸垂擺動（含／不含轉體）',
  II: '飛行動作',
  III: '近槓與 Adler 動作',
  IV: '下法',
};

export const ERROR_VALUES = { small: 0.1, medium: 0.3, large: 0.5, fall: 1.0 };

export function elementAward(item) {
  const maximum = DIFFICULTY_VALUES[item.difficulty] || 0;
  const difficultyAward = item.recognized ? maximum : 0;
  return { maximum, difficultyAward, teachingAward: Math.max(0, difficultyAward - Number(item.deduction || 0)) };
}

export function computeScores(elements, neutralPenalty = 0, stickBonus = false) {
  const recognized = elements.filter((item) => item.recognized);
  const dismounts = recognized.filter((item) => item.group === 'IV');
  const nonDismounts = recognized.filter((item) => item.group !== 'IV');
  const groupCounts = { I: 0, II: 0, III: 0 };
  const counting = [...nonDismounts]
    .sort((a, b) => DIFFICULTY_VALUES[b.difficulty] - DIFFICULTY_VALUES[a.difficulty])
    .filter((item) => {
      if (groupCounts[item.group] >= 4) return false;
      groupCounts[item.group] += 1;
      return true;
    })
    .slice(0, 7);
  if (dismounts.length) counting.push(dismounts[dismounts.length - 1]);

  const elementDifficulty = counting.reduce((sum, item) => sum + DIFFICULTY_VALUES[item.difficulty], 0);
  const groups = ['I', 'II', 'III'].reduce((sum, group) => {
    const item = counting.find((element) => element.group === group);
    if (!item) return sum;
    return sum + (group === 'I' || DIFFICULTY_VALUES[item.difficulty] >= 0.4 ? 0.5 : 0.3);
  }, 0);
  const dismount = counting.find((item) => item.group === 'IV');
  const groupValue = groups + (dismount ? DIFFICULTY_VALUES[dismount.difficulty] : 0);
  const connection = recognized.reduce((sum, item) => sum + Number(item.connection || 0), 0);
  const dScore = elementDifficulty + groupValue + connection + (stickBonus && dismount && DIFFICULTY_VALUES[dismount.difficulty] >= 0.3 ? 0.1 : 0);
  const deductions = elements.reduce((sum, item) => sum + Number(item.deduction || 0), 0);
  const eScore = Math.max(0, 10 - deductions);
  const teachingTotal = elements.reduce((sum, item) => sum + elementAward(item).teachingAward, 0);
  return {
    counting,
    elementDifficulty,
    groupValue,
    connection,
    deductions,
    dScore,
    eScore,
    teachingTotal,
    finalScore: Math.max(0, dScore + eScore - Number(neutralPenalty || 0)),
  };
}

export function formatTime(seconds = 0) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
