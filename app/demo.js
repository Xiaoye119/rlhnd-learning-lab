'use strict';
const $ = id => document.getElementById(id);
const done = new Set();
const cellIds = {beta:2,contact:3,mask:4,lbs:5,pack:6};
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v,d=3) => Number(v).toFixed(d);
function progress() {
  $('progress').style.width = (done.size/6*100)+'%';
  $('progress-text').textContent = '已运行 '+done.size+' / 6 个单元';
}
function completed(n) { done.add(n); $('status-'+n).textContent='已运行 ✓'; progress(); }
function clearCell(key, changed=false) {
  const n=cellIds[key]; done.delete(n); $('status-'+n).textContent=changed?'参数已变 · 请重运行':'未运行';
  $('out-'+key).replaceChildren(); progress();
  if(key==='pack') $('download-pack').disabled=true;
}
function setView(name) {
  document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-current',el.dataset.view===name?'page':'false'));
  videos.forEach(v=>v.pause()); window.scrollTo(0,0);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('print-report').onclick=()=>window.print();
function download(name, data) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function lineChart(series, label) {
  const all=series.flatMap(s=>s.values.filter(v=>v!==null));
  const low=Math.min(0,...all), high=Math.max(.0001,...all), span=high-low||1;
  const y=v=>185-(v-low)/span*145, x=i=>55+i/(Math.max(...series.map(s=>s.values.length))-1)*580;
  const paths=series.map(s=>{
    let d='', active=false;
    s.values.forEach((v,i)=>{ if(v===null){active=false;return;} d+=(active?' L':' M')+x(i).toFixed(2)+' '+y(v).toFixed(2); active=true; });
    return '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"/>';
  }).join('');
  return '<svg class="chart" viewBox="0 0 680 235" role="img" aria-label="'+esc(label)+'"><line x1="55" y1="185" x2="635" y2="185" stroke="#b8c9bf"/><line x1="55" y1="35" x2="55" y2="185" stroke="#b8c9bf"/><text x="4" y="44">'+fmt(high,3)+'</text><text x="4" y="187">'+fmt(low,3)+'</text>'+paths+'<text x="55" y="213">第 1 步</text><text x="580" y="213">最后一步</text><text x="55" y="20">'+esc(label)+'</text></svg>';
}

const videos=[0,1,2].map(i=>$('video-'+i));
function changeVideos() {
  videos.forEach(v=>v.pause());
  const tactile=$('video-set').value==='tactile';
  const titles=tactile?['输入视频','接触概率','压力分布']:['输入视频','二维投影','三维手部'];
  videos.forEach((v,i)=>{v.src=MEDIA[tactile?'tactile':'pose'][i]; $('vtitle-'+i).textContent=titles[i];});
  $('video-note').textContent=tactile?'OpenTouch 样例：后两路是作者的接触与压力可视化。颜色图例和尺度沿用作者视频。':'EgoDex 样例：比较输入、投影与三维手形。三路视频按共同时间轴播放。';
  done.delete(1); $('status-1').textContent='未运行'; progress();
}
$('video-set').onchange=changeVideos;
$('play-videos').onclick=async()=>{
  try {
    if(videos.some(v=>v.ended)) videos.forEach(v=>v.currentTime=0);
    const t=videos[0].currentTime; videos.slice(1).forEach(v=>v.currentTime=t);
    await Promise.all(videos.map(v=>v.play())); completed(1);
  } catch(e) { videos.forEach(v=>v.pause()); $('video-note').textContent='视频播放失败：'+e.message+'。请使用支持 MP4 的现代浏览器。'; }
};
$('pause-videos').onclick=()=>videos.forEach(v=>v.pause());
$('reset-videos').onclick=()=>videos.forEach(v=>{v.pause();v.currentTime=0;});
videos[0].addEventListener('timeupdate',()=>{
  if(!videos[0].paused) videos.slice(1).forEach(v=>{if(Math.abs(v.currentTime-videos[0].currentTime)>.15)v.currentTime=videos[0].currentTime;});
});
videos.forEach(v=>v.addEventListener('ended',()=>videos.forEach(w=>w.pause())));
changeVideos();

function runBeta() {
  const mode=$('beta-mode').value, threshold=+$('beta-threshold').value;
  const visibility=mode==='none'?[.12,.21,.08,.18,.24,.15]:[.12,.32,.78,.91,.55,.83];
  const coeff=[-1.2,.8,.25,.6,-.4,.9];
  const windows=visibility.map((v,i)=>({visibility:v,beta:Array.from({length:10},(_,j)=>coeff[i]/(j+1))}));
  const calibrated=mode==='calibrated'?Array.from({length:10},(_,j)=>.1/(j+1)):null;
  const result=LabMath.betaCache(windows,threshold,calibrated);
  const rows=windows.map((w,i)=>{
    let action;
    if(calibrated) action='注入外部 β → 解码一次';
    else if(result.selected<0) action='探测并暂存 → 结束时回退';
    else if(i<result.selected) action='探测并暂存 → 用缓存回解';
    else if(i===result.selected) action='首次合格 → 缓存 → 回解';
    else action='用固定 β 解码';
    return '<tr class="'+(i===result.selected?'selected':'')+'"><td>W'+(i+1)+'</td><td>'+fmt(w.visibility,2)+'</td><td>'+fmt(w.beta[0],2)+'</td><td>'+fmt(result.output[i][0],2)+'</td><td>'+action+'</td></tr>';
  }).join('');
  $('out-beta').innerHTML='<h4>'+(calibrated?'预标定分支':result.selected>=0?'W'+(result.selected+1)+' 首次满足 v > Tᵥ':'没有合格片段：各片段保留自己的 β')+'</h4><div class="table-wrap"><table><thead><tr><th>片段</th><th>可见性</th><th>原 β[0]</th><th>输出 β[0]</th><th>处理过程</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="fine">'+(result.cached?'输出的 6 个手形向量相同。'+(calibrated?'无需探测。':'包括选中窗口在内，前 '+result.held+' 个已探测窗口需要用 β 缓存重新解码。'):'在视频结束前没有找到缓存条件，因此不能凭空构造可靠手形。')+' 本单元只计算缓存控制逻辑，不执行姿态解码器。</p>';
  completed(2);
}
$('run-beta').onclick=runBeta;
function geometry() {
  const d=+$('distance').value, x=340+d*16;
  $('geometry-preview').innerHTML='<svg class="chart" viewBox="0 0 680 180" role="img" aria-label="有符号距离一维截面"><rect x="50" y="35" width="290" height="100" fill="#d8e7df"/><rect x="340" y="35" width="80" height="100" fill="#f7efd7"/><line x1="340" y1="25" x2="340" y2="145" stroke="#50746b" stroke-width="2"/><line x1="420" y1="25" x2="420" y2="145" stroke="#b5903b" stroke-dasharray="5 5"/><text x="80" y="58">物体内部 · d &lt; 0</text><text x="470" y="58">物体外部 · d &gt; 0</text><line x1="50" y1="100" x2="630" y2="100" stroke="#809e90"/><circle cx="'+x+'" cy="100" r="9" fill="#08786b" stroke="white" stroke-width="3"/><text x="'+Math.max(55,Math.min(x-22,570))+'" y="80">d = '+d+'</text><text x="316" y="165">表面 0</text><text x="400" y="165">+5 mm</text></svg>';
}
$('run-contact').onclick=()=>{
  const d=+$('distance').value, r=LabMath.contact(d);
  $('out-contact').innerHTML='<div class="grid2"><div><div class="metric-label">无符号规则 |d| ≤ 5</div><div class="metric">'+(r.unsigned?'接触 1':'非接触 0')+'</div><code>|'+d+'| = '+Math.abs(d)+' mm</code></div><div><div class="metric-label">论文规则 d ≤ 5</div><div class="metric">'+(r.signed?'接触 1':'非接触 0')+'</div><code>'+d+' ≤ 5 → '+r.signed+'</code></div></div><p class="fine">'+(r.signed!==r.unsigned?'差异来自深穿透：距离的符号保留了“物体内部”的信息。':'在这个位置，两种规则给出同一标签。试试 d < −5 mm。')+'</p>'; completed(3);
};
const targets=[0,2,4,null,null,1,null,null,0,null];
function maskPredictions(){const u=+$('unknown-pressure').value;return [.5,2.5,3,u,u,1.5,u,u,.2,u];}
function maskGrid(){
  const p=maskPredictions();
  $('mask-grid').innerHTML=targets.map((t,i)=>'<div class="vertex '+(t===null?'unknown':'')+'">v'+i+'<small>标签 '+(t===null?'?':t)+'</small><small>预测 '+fmt(p[i],1)+'</small></div>').join('');
}
$('run-mask').onclick=()=>{
  const r=LabMath.maskedMAE(maskPredictions(),targets);
  $('out-mask').innerHTML='<div class="grid2"><div><div class="metric-label">仅已感测位置 · '+r.count+' 个有效项</div><div class="metric">'+fmt(r.mae)+' <small>kPa</small></div><code>2.7 ÷ 5</code></div><div><div class="metric-label">错误补零 · 10 个“标签”</div><div class="metric">'+fmt(r.zeroFilled)+' <small>kPa</small></div><code>(2.7 + 5 × '+fmt($('unknown-pressure').value,1)+') ÷ 10</code></div></div><p class="fine">正确损失与未知位置的预测无关；补零改变了监督语义。两种值大小不是模型优劣的比较，因为分母和标签已经不同。</p>'; completed(4);
};
$('run-lbs').onclick=()=>{
  if(!$('total-pressure').reportValidity()) return;
  const total=+$('total-pressure').value;
  const weights=[[1,0,0],[.7,.3,0],[.2,.8,0],[0,.8,.2],[0,.3,.7],[0,0,1]];
  const features=[.4,+$('bone-feature').value,-.4], embedding=[0,.1,-.1,.2,0,-.2];
  const r=LabMath.distribute(features,weights,embedding,total);
  $('out-lbs').innerHTML='<div class="grid2"><div><h4>中间特征与分配比例</h4><div class="table-wrap"><table><thead><tr><th>顶点</th><th>W 行</th><th>e</th><th>h</th><th>s</th></tr></thead><tbody>'+weights.map((w,i)=>'<tr><td>v'+i+'</td><td class="mono">'+w.join(', ')+'</td><td>'+embedding[i]+'</td><td>'+fmt(r.h[i],2)+'</td><td>'+fmt(r.fractions[i]*100,1)+'%</td></tr>').join('')+'</tbody></table></div></div><div><h4>分配结果 f = F × s</h4>'+r.values.map((v,i)=>'<div class="bar-row"><span>v'+i+'</span><div class="bar-bg"><div class="bar-fill" style="width:'+r.fractions[i]*100+'%"></div></div><span>'+fmt(v)+'</span></div>').join('')+'<div class="metric">'+fmt(r.values.reduce((a,b)=>a+b,0))+'</div><span class="metric-label">顶点值之和 = 给定 F（浮点精度内）</span></div></div>'; completed(5);
};
let packed=null;
$('run-pack').onclick=()=>{
  packed=LabMath.packDPP(+$('anchor').value,+$('missing').value);
  const count=packed.keypoint_valid_mask.flat().filter(Boolean).length;
  const series=[{color:'#08786b',values:packed.target_displacements_m.map(row=>row[0][1])},{color:'#bd7c31',values:packed.target_displacements_m.map((row,i)=>packed.keypoint_valid_mask[i][21]?row[21][1]:null)}];
  $('out-pack').innerHTML='<div class="grid3"><div><div class="metric-label">动作数组形状</div><div class="metric">16×42×3</div></div><div><div class="metric-label">关键点有效监督</div><div class="metric">'+count+'/672</div></div><div><div class="metric-label">未来时间跨度</div><div class="metric">0.8 s</div></div></div>'+lineChart(series,'构造的左右腕 Δy / m（两条原轨迹相同）')+'<div class="legend"><span><i class="dot"></i>左腕 · 全段有效</span><span><i class="dot" style="background:#bd7c31"></i>右腕 · 无效段不绘制</span></div><div class="timeline">'+packed.keypoint_valid_mask.map((row,i)=>'<span class="tick '+(row[21]?'':'invalid')+'">'+(i+1)+': '+(row[21]?'双手':'左手')+'</span>').join('')+'</div><details><summary>查看第 1 步的部分字段</summary><pre>'+esc(JSON.stringify({anchor_frame:packed.anchor_frame,delta_definition:'p(t+k) - p(t), teaching choice',left_wrist_delta_m:packed.target_displacements_m[0][0],right_wrist_valid:packed.keypoint_valid_mask[0][21],omitted:packed.omitted_inputs},null,2))+'</pre></details>';
  $('download-pack').disabled=false; completed(6);
};
$('download-pack').onclick=()=>download('dpp-teaching-sample.json',packed);

const bindings=[
 ['beta-threshold','beta','beta-threshold-value',v=>fmt(v,2)],['distance','contact','distance-value',v=>v+' mm'],
 ['unknown-pressure','mask','unknown-pressure-value',v=>fmt(v,1)+' kPa'],['bone-feature','lbs','bone-feature-value',v=>fmt(v,1)],
 ['anchor','pack','anchor-value',v=>v]
];
bindings.forEach(([id,key,out,format])=>$(id).oninput=()=>{
  $(out).textContent=format($(id).value); clearCell(key,true);
  if(key==='contact')geometry(); if(key==='mask')maskGrid();
});
[['beta-mode','beta'],['total-pressure','lbs'],['missing','pack']].forEach(([id,key])=>$(id).oninput=()=>clearCell(key,true));
const defaults={beta:{'beta-mode':'later','beta-threshold':.6},contact:{distance:-12},mask:{'unknown-pressure':6},lbs:{'bone-feature':2,'total-pressure':12},pack:{anchor:10,missing:0}};
document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{
  const key=b.dataset.reset; Object.entries(defaults[key]).forEach(([id,v])=>$(id).value=v);
  bindings.filter(x=>x[1]===key).forEach(([id,,out,format])=>$(out).textContent=format($(id).value));
  clearCell(key);geometry();maskGrid();
});
geometry();maskGrid();

const papers={
  rlhnd:{title:'RLHND',version:'2610.09455v1',tag:'视频 → 人手标签',input:'单目第一人称视频；训练来源分别提供姿态、网格接触或传感器压力。',steps:[['训练标签','姿态约束重拟合；有符号几何接触；传感器标签清理与掩码。'],['模型输出','视频特征 → 姿态、β、相机位置；骨骼 token → 顶点接触和压力。'],['一致性','每手每视频缓存 β；缺失监督按帧、手、顶点屏蔽。'],['下游验证','相同人体示范更换关键点来源，打包后训练 DPP；共享接触标签。']],output:'每帧双手关键点/网格、接触概率与压力。机器人训练仍需坐标、时间与表示对齐。',limit:'Table 4 的 80.8% → 87.5% 不是“连续压力控制”的收益；两组使用相同接触标签。',image:'assets/2610.09455-fig_structure.png',caption:'Figure 2 · PDF p.4'},
  ego:{title:'Ego2Robot',version:'2608.02580v1',tag:'人体轨迹 → 合成机器人数据',input:'已标注人体数据；或先用 WiLoR / DynHaMR 从无标注第一人称视频估计轨迹。',steps:[['动作构造','虚拟指尖与手腕定义 TCP、朝向、夹爪开合；修复缺口、尖峰并平滑。'],['构型搜索','候选基座 → 关键帧 IK → 双臂组合 → 检查可达性与碰撞。'],['外观合成','SAM 3 分割人手/人像，ProPainter 修补背景，按遮挡规则叠加机器人。'],['分级筛选','L1 帧有效性；L2 轨迹统计与无效比例；L3 语义质量。']],output:'机器人外观图像、末端动作、相机信息与指令。约 1,940 小时来源扩成 18,561 小时、多构型合成数据。',limit:'合成小时不是同等数量的新真实场景；通过视觉/运动学检查也不等于全部在真实机器执行成功。',image:'assets/2608.02580-fig1_ego2r_pipeline.png',caption:'Figure 1 · PDF p.2'},
  qwen:{title:'Qwen-RobotManip',version:'2606.17846v2',tag:'多源数据 → 统一 VLA 样本',input:'机器人、人体、人转机器人合成三类动作流，另配独立 VL 记录。',steps:[['清洗与纠正','检测跳变、同步滞后、极值；按来源纠正 TCP/坐标，保留重要夹爪变化。'],['外观与语言','人体转机器人合成；多粒度指令与推理标注。标注未来上下文不等于部署输入。'],['统一表示','80D 状态/动作槽位，区分来源有标签与无标签维度。'],['监督屏蔽','表示维度、序列末尾、人体可见性三类 mask 做 AND；每样本按有效项平均。']],output:'统一输入与动作监督；VLA/VL 按 9:1 采样。三类动作数据约 38,161 小时，28M VL 是记录数。',limit:'小时、合成扩增、VL 条目不能相加为一个同口径规模；官方目前不开放 RobotManip 权重。',image:'assets/2606.17846-data_preprocess.png',caption:'Figure 2 · PDF p.6'},
  human:{title:'Open-HumanWAM',version:'2611.06817v3',tag:'人体规模 + 动作对齐 + 目标条件',input:'五个人体数据来源经清洗形成 50,000 小时；后续混合机器人经验。',steps:[['切段与有效性','按手可见性、EEF 与相机稳定性切连续片段，过滤长时间静止。'],['动作对齐','Vanilla 使用 16D；Goal 使用 49D，缺失维度同时影响损失与归一化统计。'],['目标条件','训练目标图来自未来/终点等分支；机器人后训练多数使用由初始图与指令生成的目标。'],['策略训练','输入图像、历史、状态、指令、目标；HumanWAM-Goal 预测 48 步动作块。']],output:'开放人体经验配方、Vanilla 与 Goal 策略。Goal 已发布权重与推理 HTTP 服务。',limit:'本页对接官方 Goal 接口；论文成绩与发布 README 后续成绩分开记录。当前机器不符合官方 GPU 运行条件。',image:'assets/2611.06817-data_overview.png',caption:'Figure 2 · PDF p.5'},
  movens:{title:'Movens-Zero',version:'2610.41877v1',tag:'全身视频 → 可跟踪机器人运动',input:'互联网全身动作视频及文字、音频、视频条件；先按来源划分以避免片段泄漏。',steps:[['视频与人体运动','质量过滤 → 单/多人重建到 SMPL-X → 4 秒重叠分块检查。'],['局部修复','有可靠邻居才调用 Kimodo 修复异常块，拼接后重检；不是统一平滑一遍。'],['重定向与验证','GMR 初始化 + 序列优化 → 跟踪策略 rollout；用 q ≥ 0.20 验收。'],['生成训练','40D、50 Hz、30 帧动作块；冻结条件特征，执行 20 帧并保留 10 帧前缀。']],output:'15M 人体运动序列、5M 验证后人形机器人序列，以及多模态条件动作生成模型。',limit:'跟踪分数 q 不是成功概率；运动学可达与动态可执行是两层判断，也不等于有物体交互能力。',image:'assets/2610.41877-data_pipeline.png',caption:'Figure 2 · PDF p.3'}
};
function selectPaper(key){
  const p=papers[key];
  document.querySelectorAll('[data-paper]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.paper===key)));
  $('paper-detail').innerHTML='<div class="eyebrow">'+p.tag+'</div><h2 class="paper-title">'+p.title+'</h2><p><span class="badge">'+p.version+'</span> <a href="https://arxiv.org/html/'+p.version+'" target="_blank" rel="noreferrer">阅读原文 ↗</a></p><p><b>输入：</b>'+p.input+'</p><ul class="step-list">'+p.steps.map(([a,b])=>'<li><b>'+a+'</b><span>'+b+'</span></li>').join('')+'</ul><p><b>最终产物：</b>'+p.output+'</p><div class="note">'+p.limit+'</div><figure class="figure"><img src="'+MEDIA.figures[p.image]+'" alt="'+p.title+' 数据管线原图"><figcaption>'+p.title+' · '+p.caption+'</figcaption></figure>';
}
document.querySelectorAll('[data-paper]').forEach(b=>b.onclick=()=>selectPaper(b.dataset.paper));
selectPaper('rlhnd');

let connected=false, inferenceResult=null;
const uploaded={};
function normalizedExample(){
  const mask=Array.from({length:49},(_,i)=>i>=23&&i<42);
  $('observation').value=JSON.stringify({normalized_state:Array(49).fill(0),state_valid_mask:mask,action_valid_mask:mask,domain_id:-1,observation_timestamp:0,history:[],seed:0},null,2);
  $('state-help').textContent='构造的归一化接口样例：全零状态、关节通道关闭、domain_id = −1。它检查模型响应，不代表图中实际机器人状态；有意义的策略行为需要匹配图像、状态与 checkpoint 的预处理。';
}
normalizedExample();
$('normalized-example').onclick=normalizedExample;
$('physical-example').onclick=()=>{
  $('observation').value=JSON.stringify({state:Array(49).fill(null),observation_timestamp:0,history:[],seed:0},null,2);
  $('state-help').textContent='请按所选 checkpoint 的 robot.json 填入实际的 49 维状态。null 是必填占位，不会当成零发送。物理接口四元数使用 xyzw；相机位姿不能随意省略。';
};
[['current-image','current','preview-current'],['goal-image','goal','preview-goal']].forEach(([input,key,preview])=>{
  $(input).onchange=async()=>{
    delete uploaded[key]; $(preview).hidden=true;
    const file=$(input).files[0]; if(!file)return;
    if(file.size>10*1024*1024){$('out-inference').textContent='单张图片请不超过 10 MiB；官方请求总限制为 32 MiB。';return;}
    try{
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      uploaded[key]=data.split(',')[1]; $(preview).src=data;$(preview).hidden=false;
    }catch(e){$('out-inference').textContent='图像读取失败。';}
  };
});
async function api(path, options={}) {
  const r=await fetch('/api/'+path,{...options,signal:AbortSignal.timeout(path==='infer'?600000:15000)});
  let body;const raw=await r.text();
  try{body=JSON.parse(raw);}catch{throw new Error('服务未返回 JSON（HTTP '+r.status+'）。请通过配套 serve_demo.py 打开页面。');}
  if(!r.ok) throw new Error(body.error||body.detail||'HTTP '+r.status);
  return body;
}
$('connect-service').onclick=async()=>{
  connected=false;$('infer').disabled=true;$('connect-service').disabled=true;
  $('service-state').className='service-state';$('service-meta').hidden=true;
  $('service-state').textContent='正在检查 /healthz 与 /metadata …';
  try{
    if(location.protocol==='file:') throw new Error('当前是离线文件。请运行 serve_demo.py，并从 http://127.0.0.1:18765 打开。');
    const health=await api('healthz'), meta=await api('metadata');
    if(health.status!=='ok'||meta.model!=='GoalWAM'||meta.horizon!==48||meta.output_action_dim!==49)throw new Error('服务协议与已核对的 GoalWAM 48×49 接口不符。');
    $('service-meta').textContent=JSON.stringify(meta,null,2);$('service-meta').hidden=false;
    $('service-state').textContent='已连接 GoalWAM 服务。检查输入后可发送真实推理请求。';$('service-state').className='service-state ok';
    connected=true;$('infer').disabled=false;
  }catch(e){$('service-state').textContent='尚未连接：'+e.message;}
  finally{$('connect-service').disabled=false;}
};
$('infer').onclick=async()=>{
  if(!connected)return;
  inferenceResult=null;$('download-inference').disabled=true;
  try{
    if(!uploaded.current||!uploaded.goal)throw new Error('请选择当前图像和目标图像。');
    if(!$('instruction').value.trim())throw new Error('任务指令不能为空。');
    const observation=JSON.parse($('observation').value);
    if((observation.state!==undefined)===(observation.normalized_state!==undefined))throw new Error('请且仅提供 state 或 normalized_state 其中一种。');
    const state=observation.state??observation.normalized_state;
    if(!Array.isArray(state)||state.length!==49||state.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new Error('状态必须为 49 个有限数值，请替换 null 占位。');
    if(!Number.isFinite(observation.observation_timestamp)||!Array.isArray(observation.history))throw new Error('请提供数值时间戳和 history 数组。');
    if(observation.normalized_state){
      for(const k of ['state_valid_mask','action_valid_mask']){
        if(!Array.isArray(observation[k])||observation[k].length!==49||observation[k].some(x=>typeof x!=='boolean')||observation[k].slice(42).some(Boolean))throw new Error(k+' 必须为 49 个布尔值，42:49 必须为 false。');
      }
    }
    observation.instruction=$('instruction').value.trim();
    observation.images={...(observation.images||{}),head:uploaded.current};
    observation.goal_images={...(observation.goal_images||{}),head:uploaded.goal};
    const payload=JSON.stringify(observation);
    if(new Blob([payload]).size>32*1024*1024)throw new Error('请求超过官方 32 MiB 限制，请缩小输入图像。');
    $('infer').disabled=true;$('out-inference').textContent='已发出实际请求，等待模型计算……';
    const start=performance.now(), result=await api('infer',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});
    const actions=result.normalized_actions?.[0];
    if(!Array.isArray(actions)||actions.length!==48||actions.some(row=>!Array.isArray(row)||row.length!==49||row.some(x=>typeof x!=='number'||!Number.isFinite(x))))throw new Error('返回值不符合 [1,48,49] normalized_actions；未显示替代轨迹。');
    inferenceResult=result;
    $('out-inference').innerHTML='<h4>已收到服务响应 · '+fmt((performance.now()-start)/1000,2)+' s</h4><p>normalized_actions: [1,48,49] · prefix_length: '+esc(result.prefix_length)+'</p>'+lineChart([{color:'#08786b',values:actions.map(r=>r[26])},{color:'#bd7c31',values:actions.map(r=>r[34])}],'归一化动作通道 26 / 34（不是米）')+'<div class="legend"><span>绿色：左 EEF 的 x 通道</span><span>棕色：右 EEF 的 x 通道</span></div><details><summary>查看第一步响应与返回字段</summary><pre>'+esc(JSON.stringify({keys:Object.keys(result),first_normalized_action:actions[0],first_absolute_action:result.actions?.[0],first_valid_mask:result.action_valid_mask?.[0]},null,2))+'</pre></details><p class="fine">曲线来自本次服务响应。归一化动作需要按 checkpoint 配置解码；本页面不驱动机器人。无效通道请结合输入/返回 mask 解读。</p>';
    $('download-inference').disabled=false;
  }catch(e){$('out-inference').textContent='请求未完成：'+e.message;}
  finally{$('infer').disabled=!connected;}
};
$('download-inference').onclick=()=>download('goalwam-response.json',inferenceResult);
