import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import {
  Activity, BarChart3, Check, ChevronRight, ClipboardCheck, Clock3, Download, FileText,
  Film, Link2, ListChecks, Pause, Play, Plus, RotateCcw, Share2, Trash2, Upload,
  Video, WandSparkles
} from 'lucide-react';
import { computeScores, DIFFICULTY_VALUES, elementAward, ERROR_VALUES, formatTime, GROUPS, selectMotionPeaks } from './scoring';
import './styles.css';

const coachProblems = ['擺動節奏與振幅不一致', '倒立線條或肩角未充分打開', '飛行動作接槓位置不穩定', '下法落地控制不足'];
const coachDirections = ['以節拍與分段擺動建立一致節奏', '加強肩關節活動度與核心線條控制', '使用保護帶練習放槓／接槓時機', '加入落地吸震、定點與壓力情境訓練'];
const penaltyReasons = ['待裁判確認', '無明顯錯誤', '倒立角度偏差', '屈膝／分腿', '屈臂接槓', '飛行高度不足', '擺動停頓／節奏中斷', '偏離動作平面', '落地跨步／跳步', '掉落器械', '其他'];
const emptyElement = (time = 0) => ({ id: crypto.randomUUID(), time, name: '', group: 'I', difficulty: 'A', recognized: true, deduction: 0, connection: 0, penaltyReason: '無明顯錯誤', note: '' });

function App() {
  const [step, setStep] = useState(1);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [athlete, setAthlete] = useState('');
  const [eventName, setEventName] = useState('');
  const [elements, setElements] = useState([]);
  const [neutralPenalty, setNeutralPenalty] = useState(0);
  const [stickBonus, setStickBonus] = useState(false);
  const [problems, setProblems] = useState([]);
  const [directions, setDirections] = useState([]);
  const [coachNote, setCoachNote] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [toast, setToast] = useState('');
  const videoRef = useRef(null);
  const scores = useMemo(() => computeScores(elements, neutralPenalty, stickBonus), [elements, neutralPenalty, stickBonus]);

  useEffect(() => {
    const saved = localStorage.getItem('highbar-judge-draft');
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      setAthlete(draft.athlete || ''); setEventName(draft.eventName || ''); setElements(draft.elements || []);
      setNeutralPenalty(draft.neutralPenalty || 0); setStickBonus(Boolean(draft.stickBonus));
      setProblems(draft.problems || []); setDirections(draft.directions || []); setCoachNote(draft.coachNote || '');
    } catch { /* ignore invalid local draft */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('highbar-judge-draft', JSON.stringify({ athlete, eventName, elements, neutralPenalty, stickBonus, problems, directions, coachNote }));
  }, [athlete, eventName, elements, neutralPenalty, stickBonus, problems, directions, coachNote]);

  const flash = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const handleVideo = (file) => {
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file)); setVideoName(file.name); setStep(2); flash('影片已載入，開始逐段評分');
  };
  const updateElement = (id, patch) => setElements((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const addElement = () => setElements((rows) => [...rows, emptyElement(currentTime)]);
  const toggleCheck = (value, list, setter) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause();
  };
  const seekTo = (time) => { if (videoRef.current) { videoRef.current.currentTime = time; videoRef.current.play(); } };
  const seekFrame = (video, time) => new Promise((resolve) => {
    const done = () => { video.removeEventListener('seeked', done); resolve(); };
    video.addEventListener('seeked', done, { once: true }); video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
  const startAnalysis = async () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || analyzing) return;
    setAnalyzing(true); setAnalysisProgress(0); video.pause();
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 36;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const sampleCount = Math.min(90, Math.max(24, Math.ceil(video.duration * 1.2)));
    const samples = []; let previous = null;
    try {
      for (let index = 0; index < sampleCount; index += 1) {
        const time = 0.25 + (index / Math.max(1, sampleCount - 1)) * Math.max(0.1, video.duration - 0.5);
        await seekFrame(video, time); context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const frame = new Uint8Array(canvas.width * canvas.height);
        for (let p = 0, f = 0; p < pixels.length; p += 4, f += 1) frame[f] = (pixels[p] * .299) + (pixels[p+1] * .587) + (pixels[p+2] * .114);
        if (previous) { let delta = 0; for (let p = 0; p < frame.length; p += 1) delta += Math.abs(frame[p] - previous[p]); samples.push({ time, score: delta / frame.length / 255 }); }
        previous = frame; setAnalysisProgress(Math.round(((index + 1) / sampleCount) * 100));
        if (index % 8 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const peaks = selectMotionPeaks(samples, Math.min(10, Math.max(4, Math.round(video.duration / 6))), Math.max(1.2, video.duration / 24));
      const candidates = peaks.map((peak, index) => ({ ...emptyElement(peak.time), name: `候選動作 ${index + 1}`, recognized: false, penaltyReason: '待裁判確認', note: `本機畫面變化指標 ${(peak.score * 100).toFixed(1)}%` }));
      setElements(candidates); setCurrentTime(0); video.currentTime = 0; setStep(2);
      flash(`整部影片掃描完成：找到 ${candidates.length} 個候選片段，請逐項確認`);
    } catch { flash('影片分析無法完成，請確認影片格式後重試'); }
    finally { setAnalyzing(false); setAnalysisProgress(0); }
  };
  const resetAll = () => {
    if (!window.confirm('確定清除目前分析與本機草稿？')) return;
    localStorage.removeItem('highbar-judge-draft'); window.location.reload();
  };

  const reportHtml = () => `
    <html><head><meta charset="utf-8"><title>HighBar Judge Report</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#122033;padding:40px;line-height:1.55}h1{font-size:28px}h2{margin-top:28px;border-bottom:2px solid #dae3ec;padding-bottom:8px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #dce4ec;padding:9px;text-align:left}.score{display:flex;gap:20px}.score b{font-size:26px}.muted{color:#64748b}.tag{display:inline-block;padding:4px 9px;background:#e6f6f2;border-radius:99px;margin:3px}footer{margin-top:32px;font-size:11px;color:#64748b}
    </style></head><body><h1>HighBar Judge 單槓檢測報告</h1><p>${athlete || '未填選手'} · ${eventName || '訓練分析'} · ${new Date().toLocaleDateString('zh-TW')}</p>
    <div class="score"><p>D 分<br><b>${scores.dScore.toFixed(3)}</b></p><p>E 分<br><b>${scores.eScore.toFixed(3)}</b></p><p>中立扣分<br><b>${Number(neutralPenalty).toFixed(1)}</b></p><p>總分<br><b>${scores.finalScore.toFixed(3)}</b></p></div>
    <h2>逐動作裁判評分</h2><table><thead><tr><th>時間</th><th>動作與判斷</th><th>組別</th><th>難度</th><th>滿分</th><th>扣分</th><th>應得</th></tr></thead><tbody>${elements.map((x) => { const award = elementAward(x); return `<tr><td>${formatTime(x.time)}</td><td>${x.name || '未命名'}${x.recognized ? '' : '（未認定）'}<br><small>${x.penaltyReason || '人工判讀'}</small></td><td>${x.group}</td><td>${x.difficulty}</td><td>${award.maximum.toFixed(1)}</td><td>-${Number(x.deduction).toFixed(1)}</td><td>${award.teachingAward.toFixed(1)}</td></tr>`; }).join('')}</tbody></table>
    <p class="muted">逐動作應得分為教學拆解；FIG 正式總分仍依 D + E − 中立扣分計算。</p>
    <h2>教練觀察</h2><h3>看到的問題</h3><p>${problems.map((x) => `<span class="tag">✓ ${x}</span>`).join('') || '未勾選'}</p><h3>改進方向</h3><p>${directions.map((x) => `<span class="tag">✓ ${x}</span>`).join('') || '未勾選'}</p><p>${coachNote || ''}</p>
    <footer>依 FIG MAG Code of Points 2025–2028 設計之人工輔助分析。影片判讀可能受拍攝角度、畫質與幀率影響；本報告不取代 FIG 認證裁判之正式評分。</footer></body></html>`;

  const exportPdf = async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const safe = (text) => String(text || '').replace(/[^\x20-\x7E]/g, '');
    doc.setFillColor(8, 17, 31); doc.rect(0, 0, 595, 100, 'F'); doc.setTextColor(255); doc.setFontSize(24); doc.text('HIGHBAR JUDGE', 42, 52); doc.setFontSize(11); doc.text('Horizontal Bar Analysis Report', 42, 74);
    doc.setTextColor(18, 32, 51); doc.setFontSize(11); doc.text(`Athlete: ${safe(athlete) || '—'}   Event: ${safe(eventName) || '—'}   Date: ${new Date().toISOString().slice(0,10)}`, 42, 130);
    doc.setFontSize(20); doc.text(`D ${scores.dScore.toFixed(3)}     E ${scores.eScore.toFixed(3)}     Final ${scores.finalScore.toFixed(3)}`, 42, 172);
    doc.setFontSize(13); doc.text('Judging breakdown', 42, 214); doc.setFontSize(9);
    let y = 238;
    elements.forEach((x, index) => { const award = elementAward(x); if (y > 720) { doc.addPage(); y = 50; } doc.text(`${index + 1}. ${formatTime(x.time)}  ${safe(x.name) || 'Element'}  EG ${x.group}  ${x.difficulty}  Max ${award.maximum.toFixed(1)}  Ded -${Number(x.deduction).toFixed(1)}  Award ${award.teachingAward.toFixed(1)}`, 42, y); y += 18; });
    y += 14; doc.setFontSize(13); doc.text('Coach review', 42, y); y += 22; doc.setFontSize(9);
    [...problems.map((x) => `Issue: ${safe(x)}`), ...directions.map((x) => `Action: ${safe(x)}`)].forEach((line) => { doc.text(line, 42, y); y += 16; });
    doc.setTextColor(90); doc.setFontSize(8); doc.text('Decision-support only. Not an official FIG score. Video angle and quality may affect review.', 42, 800);
    doc.save(`HighBar-Judge-${athlete || 'report'}.pdf`); flash('PDF 報告已下載');
  };
  const printReport = () => { const win = window.open('', '_blank'); win.document.write(reportHtml()); win.document.close(); win.focus(); window.setTimeout(() => win.print(), 300); };
  const shareLine = (kind) => {
    const text = kind === 'video' ? `單槓分析影片：${videoName || '請先下載影片後附加傳送'}` : `HighBar Judge 單槓檢測報告｜${athlete || '選手'}｜總分 ${scores.finalScore.toFixed(3)}。請附加剛下載的 PDF 檔案。`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const downloadVideo = () => { if (!videoUrl) return; const a = document.createElement('a'); a.href = videoUrl; a.download = `HighBar-${videoName}`; a.click(); };

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="HighBar Judge 首頁"><span className="brand-mark"><span /></span><span><b>HIGHBAR</b><small>JUDGE</small></span></a>
      <nav><a href="#judge">裁判評分</a><a href="#coach">教練建議</a><a href="#report">報告分享</a></nav>
      <button className="ghost small" onClick={resetAll}><RotateCcw size={16}/> 重設</button>
    </header>

    <main id="top">
      <section className="hero">
        <div className="eyebrow"><span /> FIG MAG · 2025–2028 輔助判讀</div>
        <h1>把一段單槓影片，<br/><em>變成可追溯的專業回饋。</em></h1>
        <p>逐格標記動作、計算 D／E 分，再用教練視角整理問題與訓練方向。所有判讀由專業人員確認，系統負責時間碼、加總與報告。</p>
        <div className="hero-stats"><span><b>4</b> 動作組別</span><span><b>0.1</b> 最小扣分</span><span><b>PDF</b> 一鍵匯出</span></div>
      </section>

      <section className="workflow" aria-label="分析流程">
        {[['01','匯入影片','完整播放'],['02','裁判評分','動作與扣分'],['03','教練建議','問題與方向'],['04','輸出分享','PDF 與影片']].map((x, i) => <button key={x[0]} className={step >= i + 1 ? 'active' : ''} onClick={() => setStep(i+1)}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small>{i < 3 && <ChevronRight/>}</button>)}
      </section>

      <section className="workspace" id="judge">
        <div className="section-heading"><div><span className="kicker">JUDGE VIEW</span><h2>裁判角度評分</h2></div><p>先完整觀看，再依時間碼新增每個動作；系統即時統整難度、組別、連結與執行扣分。</p></div>
        <div className="judge-grid">
          <div className="video-panel">
            {!videoUrl ? <label className="dropzone"><input type="file" accept="video/*" onChange={(e) => handleVideo(e.target.files[0])}/><span className="upload-icon"><Upload size={26}/></span><b>匯入單槓比賽影片</b><small>支援瀏覽器可播放的 MP4、MOV、WebM<br/>影片只在此裝置處理，不會自動上傳。</small><span className="upload-btn">選擇影片</span></label> : <>
              <div className="video-wrap"><video ref={videoRef} src={videoUrl} playsInline onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}/>{analyzing && <div className="analysis-overlay"><Activity/><b>正在掃描整部影片</b><span>{analysisProgress}%</span></div>}<div className="video-overlay"><span><Video size={14}/> {videoName}</span><span>{formatTime(currentTime)}</span></div></div>
              <div className="timeline"><input aria-label="影片時間軸" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={(e) => { const time = Number(e.target.value); setCurrentTime(time); if (videoRef.current) videoRef.current.currentTime = time; }}/><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>{elements.map((item)=><button key={`marker-${item.id}`} style={{left:`${duration ? (item.time/duration)*100 : 0}%`}} title={`${formatTime(item.time)} ${item.name}`} onClick={()=>seekTo(item.time)}/>)}</div>
              <div className="transport"><button className="play" onClick={togglePlay}>{playing ? <Pause/> : <Play/>}</button><div><b>{formatTime(currentTime)}</b><small>目前時間碼</small></div><button className="primary" onClick={addElement}><Plus size={18}/> 在此新增動作</button></div>
              <button className="analyze-button" disabled={analyzing || !duration} onClick={startAnalysis}><Activity/>{analyzing ? `分析中 ${analysisProgress}%` : '開始分析整部影片'}<span>本機畫面變化掃描・不會上傳影片</span></button>
            </>}
            <div className="meta-fields"><label>選手姓名<input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder="例：王大明"/></label><label>賽事／日期<input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="例：全國錦標賽・決賽"/></label></div>
            <div className="rule-note"><ClipboardCheck/><div><b>評分原則</b><p>難度分與執行分分開紀錄。動作未被認定時不計難度價值，但仍可保留執行扣分與備註。</p></div></div>
          </div>

          <div className="score-panel">
            <div className="score-summary"><div><small>D 難度分</small><b>{scores.dScore.toFixed(3)}</b><span>動作＋組別＋連結</span></div><div><small>E 執行分</small><b>{scores.eScore.toFixed(3)}</b><span>10.0 − {scores.deductions.toFixed(1)}</span></div><div className="total"><small>預估總分</small><b>{scores.finalScore.toFixed(3)}</b><span>D + E − 中立扣分</span></div></div>
            <div className="panel-title"><div><ListChecks/><span><b>動作清單</b><small>{elements.length} 個已標記動作</small></span></div><button onClick={addElement} disabled={!videoUrl}><Plus size={16}/> 新增</button></div>
            <div className="element-list">
              {!elements.length ? <div className="empty"><Film/><b>尚未標記動作</b><p>播放影片，在動作發生處按「在此新增動作」。</p></div> : elements.map((row, index) => <article className="element-card" key={row.id}>
                <button className="timestamp" onClick={() => seekTo(row.time)}><Play size={12}/>{formatTime(row.time)}</button><span className="number">{String(index + 1).padStart(2, '0')}</span>
                <div className="element-main"><input className="element-name" value={row.name} onChange={(e) => updateElement(row.id, {name:e.target.value})} placeholder="輸入動作名稱（例：Kolman）"/>
                  <div className="row-fields"><label>組別<select value={row.group} onChange={(e) => updateElement(row.id,{group:e.target.value})}>{Object.entries(GROUPS).map(([key,value]) => <option key={key} value={key}>EG {key} · {value}</option>)}</select></label><label>難度<select value={row.difficulty} onChange={(e) => updateElement(row.id,{difficulty:e.target.value})}>{Object.entries(DIFFICULTY_VALUES).map(([key,value]) => <option key={key} value={key}>{key} · {value.toFixed(1)}</option>)}</select></label><label>連結<select value={row.connection} onChange={(e) => updateElement(row.id,{connection:Number(e.target.value)})}><option value="0">0.0</option><option value="0.1">+0.1</option><option value="0.2">+0.2</option></select></label></div>
                  <div className="deductions"><span>E 扣分</span>{Object.entries(ERROR_VALUES).map(([key,value]) => <button key={key} className={Number(row.deduction) === value ? 'selected' : ''} onClick={() => updateElement(row.id,{deduction:Number(row.deduction) === value ? 0 : value})}>{key === 'small'?'小':key === 'medium'?'中':key === 'large'?'大':'掉落'} −{value.toFixed(1)}</button>)}</div>
                  <div className="judgment-row"><label>判斷依據<select value={row.penaltyReason || '無明顯錯誤'} onChange={(e) => updateElement(row.id,{penaltyReason:e.target.value})}>{penaltyReasons.map((reason)=><option key={reason}>{reason}</option>)}</select></label><div className="award-cells"><span>滿分<b>{elementAward(row).maximum.toFixed(1)}</b></span><span>應得<b>{elementAward(row).teachingAward.toFixed(1)}</b></span></div></div>
                  <div className="card-foot"><label className="check"><input type="checkbox" checked={row.recognized} onChange={(e) => updateElement(row.id,{recognized:e.target.checked})}/><span><Check/></span>動作認定</label><input value={row.note} onChange={(e) => updateElement(row.id,{note:e.target.value})} placeholder="裁判備註…"/><button className="delete" onClick={() => setElements(elements.filter((x) => x.id !== row.id))}><Trash2/></button></div>
                </div>
              </article>)}
            </div>
            {elements.length > 0 && <div className="breakdown-table"><div className="breakdown-head"><span>時間／動作</span><span>難度</span><span>滿分</span><span>扣分</span><span>應得</span></div>{elements.map((row)=><div className="breakdown-line" key={`score-${row.id}`}><span><button onClick={()=>seekTo(row.time)}>{formatTime(row.time)}</button><b>{row.name || '未命名動作'}</b><small>{row.penaltyReason || '人工判讀'} · {row.recognized ? '已認定' : '未認定'}</small></span><span>{row.difficulty}</span><span>{elementAward(row).maximum.toFixed(1)}</span><span>−{Number(row.deduction).toFixed(1)}</span><span className="earned">{elementAward(row).teachingAward.toFixed(1)}</span></div>)}<div className="breakdown-total"><span>逐動作教學拆解合計<small>不等同 FIG 正式總分</small></span><b>{scores.teachingTotal.toFixed(3)}</b></div></div>}
            <div className="score-controls"><label className="check"><input type="checkbox" checked={stickBonus} onChange={(e)=>setStickBonus(e.target.checked)}/><span><Check/></span>下法站穩獎勵 +0.1（至少 C）</label><label>中立扣分<input type="number" min="0" step="0.1" value={neutralPenalty} onChange={(e)=>setNeutralPenalty(e.target.value)}/></label></div>
            <button className="next" onClick={()=>{setStep(3);document.getElementById('coach').scrollIntoView({behavior:'smooth'})}}>完成裁判評分，前往教練建議 <ChevronRight/></button>
          </div>
        </div>
      </section>

      <section className="coach" id="coach">
        <div className="section-heading light"><div><span className="kicker">COACH VIEW</span><h2>把判分轉成下一次訓練。</h2></div><p>從四個常見面向勾選觀察，再指定清楚、可執行的改善方向。</p></div>
        <div className="coach-grid"><div className="coach-card"><div className="card-heading"><span>01</span><div><b>看到的問題</b><small>可複選</small></div></div>{coachProblems.map((item,i)=><label className={problems.includes(item)?'option checked':'option'} key={item}><input type="checkbox" checked={problems.includes(item)} onChange={()=>toggleCheck(item,problems,setProblems)}/><span><Check/></span><b>{String(i+1).padStart(2,'0')}</b>{item}</label>)}</div>
          <div className="coach-card accent"><div className="card-heading"><span>02</span><div><b>建議改進方向</b><small>可複選</small></div></div>{coachDirections.map((item,i)=><label className={directions.includes(item)?'option checked':'option'} key={item}><input type="checkbox" checked={directions.includes(item)} onChange={()=>toggleCheck(item,directions,setDirections)}/><span><Check/></span><b>{String(i+1).padStart(2,'0')}</b>{item}</label>)}</div>
        </div><label className="coach-note"><WandSparkles/><span><b>教練補充建議</b><small>加入個別化觀察、訓練量或下次檢核重點</small></span><textarea value={coachNote} onChange={(e)=>setCoachNote(e.target.value)} placeholder="例：下週先降低飛行動作串接難度，以 8/10 次穩定接槓為進階標準。"/></label>
      </section>

      <section className="report" id="report">
        <div className="section-heading"><div><span className="kicker">REPORT & SHARE</span><h2>一份分析，兩種分享。</h2></div><p>PDF 保留完整評分與建議；原始影片可下載後，與報告一起透過 LINE 附檔轉傳。</p></div>
        <div className="report-grid"><div className="report-preview"><div className="paper"><div className="paper-head"><span className="brand-mark small-mark"><span/></span><span>HIGHBAR JUDGE<small>ANALYSIS REPORT</small></span><b>{new Date().toLocaleDateString('zh-TW')}</b></div><h3>{athlete || '選手姓名'}</h3><p>{eventName || '賽事／訓練場次'}</p><div className="paper-scores"><span>D SCORE<b>{scores.dScore.toFixed(3)}</b></span><span>E SCORE<b>{scores.eScore.toFixed(3)}</b></span><span>TOTAL<b>{scores.finalScore.toFixed(3)}</b></span></div><div className="mini-bars"><span style={{width:`${Math.min(100,scores.dScore/8*100)}%`}}/><span style={{width:`${scores.eScore*10}%`}}/></div><div className="paper-list">{elements.slice(0,4).map((x,i)=><span key={x.id}>{i+1}. {x.name||'未命名動作'} <b>{x.difficulty} · {DIFFICULTY_VALUES[x.difficulty].toFixed(1)}</b></span>)}{!elements.length&&<span>完成動作標記後，評分明細會顯示於此。</span>}</div></div></div>
          <div className="export-list"><article><span><FileText/></span><div><b>檢測報告 PDF</b><p>評分明細、教練建議與分析限制。</p><div><button className="primary" onClick={exportPdf}><Download/>下載 PDF</button><button className="ghost" onClick={printReport}>列印完整版</button><button className="line" onClick={()=>shareLine('pdf')}><Share2/>到 LINE 分享</button></div></div></article><article><span><Film/></span><div><b>分析影片</b><p>下載原始影片後，可直接作為 LINE 附件；時間碼對應報告中的動作清單。</p><div><button className="primary" disabled={!videoUrl} onClick={downloadVideo}><Download/>下載影片</button><button className="line" onClick={()=>shareLine('video')}><Share2/>到 LINE 分享</button></div></div></article><div className="privacy"><Link2/><p><b>分享提醒</b>LINE 網頁分享只能帶入文字，PDF 與影片需在 LINE 中手動附加。公開分享前請取得選手或監護人同意。</p></div></div></div>
      </section>
    </main>
    <footer><div className="brand"><span className="brand-mark"><span/></span><span><b>HIGHBAR</b><small>JUDGE</small></span></div><p>專業判讀的工作台，不是自動裁判。<br/>影片與草稿預設只保存在目前裝置。</p><div><a href="https://www.gymnastics.sport/site/rules/" target="_blank" rel="noreferrer">FIG Rules ↗</a><span>MAG Code of Points 2025–2028</span></div></footer>
    {toast&&<div className="toast"><Check/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
