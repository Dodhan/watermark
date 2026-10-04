import {defaults,validateSettings,drawWatermark} from './renderer.mjs';
import {createSettingsStore,STORAGE_KEY} from './settings-storage.mjs';
const $=id=>document.getElementById(id);
let settings={...defaults},source=null,sourceName='',sourceWidth=0,sourceHeight=0,loadTicket=0,original=false,frame=0,noticeTimer,exporting=false;
let animationMs=0,lastTick=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,exportController=null,lastExportUrl=null;
const canvas=$('preview'),ctx=canvas.getContext('2d');
const keys=['text','font','color','bold','outline','opacity','size','gap','lineGap','position','angle','format','motion','duration','gifEdge'];
const rangeKeys=['opacity','size','gap','lineGap','position','angle'];
const settingsStore=createSettingsStore(()=>window.localStorage);
let savedPresets=[],storageError='';
function storageStatus(message,error=false){const el=$('settings-storage-status');if(el.textContent!==message)el.textContent=message;el.classList.toggle('error',error);}
function reportStorageError(error){storageStatus(error.message,true);if(storageError!==error.message)notify(error.message,true);storageError=error.message;}
function rememberSettings(){try{settingsStore.saveLast(settings);storageError='';storageStatus('마지막 설정을 자동으로 저장했어요.');}catch(error){reportStorageError(error);}}
function refreshPresetControls(){
  const selected=savedPresets.some(p=>p.id===$('preset-list').value);
  $('preset-list').disabled=exporting||!savedPresets.length;
  for(const id of ['preset-load','preset-update','preset-delete'])$(id).disabled=exporting||!selected;
  $('preset-save').disabled=exporting||!$('preset-name').value.trim();
  $('preset-name').disabled=exporting;
}
function refreshPresetList(presets,selected=$('preset-list').value){
  savedPresets=presets;
  const placeholder=new Option(presets.length?'프리셋을 선택해 주세요':'아직 저장한 프리셋이 없어요','');
  $('preset-list').replaceChildren(placeholder,...presets.map(p=>new Option(p.name,p.id)));
  $('preset-list').value=presets.some(p=>p.id===selected)?selected:'';
  refreshPresetControls();
}
function readPresets(){const {state}=settingsStore.read();refreshPresetList(state.presets);return state;}
function selectedPreset(){const id=$('preset-list').value;return readPresets().presets.find(p=>p.id===id);}
function notify(message,error=false){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,error?7000:4000);}
function refreshControls(){
  for(const key of keys){const el=$(key);if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];}
  document.querySelectorAll('[name=mode]').forEach(el=>el.checked=el.value===settings.mode);
  for(const key of rangeKeys){const el=$(key);$(key+'-value').textContent=settings[key]+(key==='angle'?'°':key==='gap'||key==='lineGap'?'배':'%');const pct=(settings[key]-Number(el.min))/(Number(el.max)-Number(el.min))*100;el.style.background=`linear-gradient(to right,#526eea ${pct}%,#e8ecf4 ${pct}%)`;}
  document.querySelectorAll('.swatch').forEach(el=>{const active=el.dataset.color===settings.color.toLowerCase();el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('.settings-panel input,.settings-panel select,.settings-panel button').forEach(el=>el.disabled=exporting&&el.id!=='cancel-export');
  refreshPresetControls();
  $('rows-control').hidden=settings.mode==='single';$('position-control').hidden=settings.mode!=='single';$('download').disabled=!source||!settings.text.trim()||exporting;$('compare').disabled=!source||exporting;
  for(const id of ['upload','replace','sample'])$(id).disabled=exporting;
  const moving=settings.motion!=='none';$('motion-options').hidden=!moving;$('pause').hidden=!moving||!source;$('pause').disabled=exporting||original;
  $('pause').textContent=paused?'움직임 재생':'일시정지';$('pause').setAttribute('aria-pressed',String(paused));
  if(!exporting)$('download').querySelector('span').textContent=moving?'움직이는 GIF 저장':'워터마크 넣고 저장';
  $('preview-note').textContent=moving?`그림은 그대로, 워터마크만 반복해서 움직여요. GIF는 긴 쪽 최대 ${settings.gifEdge}px로 저장해요.`:'미리보기는 화면에 맞춰 표시하고, 저장할 때는 원본 크기를 유지해요.';
  document.querySelectorAll('.pattern-demo span').forEach(el=>el.textContent=Array(4).fill(settings.text.trim()||'도르단').join('　'));
}
function drawPreview(timestamp){
  frame=0;if(!source)return;
  const moving=settings.motion!=='none'&&!paused&&!original&&!exporting&&!document.hidden;
  if(moving&&lastTick!==null)animationMs+=Math.min(100,timestamp-lastTick);
  lastTick=moving?timestamp:null;
  const scale=Math.min(1,(settings.motion==='none'?1600:1000)/Math.max(sourceWidth,sourceHeight));
  const w=Math.max(1,Math.round(sourceWidth*scale)),h=Math.max(1,Math.round(sourceHeight*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);if(settings.format==='gif'&&!original){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);}ctx.save();ctx.scale(w/sourceWidth,h/sourceHeight);ctx.drawImage(source,0,0,sourceWidth,sourceHeight);if(!original)drawWatermark(ctx,sourceWidth,sourceHeight,settings,animationMs/(settings.duration*1000));ctx.restore();
  if(moving)frame=requestAnimationFrame(drawPreview);
}
function render(){refreshControls();if(!frame)frame=requestAnimationFrame(drawPreview);}
function clearGifResult(){if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);lastExportUrl=null;$('gif-ready').hidden=true;$('gif-result').removeAttribute('href');}
function configure(patch){
  if(exporting)throw new Error('GIF 저장이 끝나거나 취소한 뒤 설정을 바꿔 주세요.');
  const next=validateSettings(patch,settings);
  if('motion' in patch)next.format=next.motion==='none'?(next.format==='gif'?'png':next.format):'gif';
  if('format' in patch)next.motion=next.format==='gif'?(next.motion==='none'?'right':next.motion):'none';
  if(next.motion!==settings.motion){animationMs=0;lastTick=null;}
  settings=next;rememberSettings();clearGifResult();render();return {...settings};
}
for(const key of keys)$(key).addEventListener('input',event=>{const el=event.target;configure({[key]:el.type==='checkbox'?el.checked:el.type==='range'||['duration','gifEdge'].includes(key)?Number(el.value):el.value});});
document.querySelectorAll('[name=mode]').forEach(el=>el.addEventListener('change',()=>configure({mode:el.value})));
document.querySelectorAll('.swatch').forEach(el=>el.addEventListener('click',()=>configure({color:el.dataset.color})));
$('reset').addEventListener('click',()=>{settings={...defaults};rememberSettings();animationMs=0;lastTick=null;clearGifResult();original=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='원본 보기';render();notify('워터마크 설정을 처음으로 돌렸어요. 저장한 프리셋은 그대로예요.');});
$('preset-name').addEventListener('input',refreshPresetControls);
$('preset-name').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();if(!$('preset-save').disabled)$('preset-save').click();}});
$('preset-list').addEventListener('change',()=>{const preset=savedPresets.find(p=>p.id===$('preset-list').value);$('preset-name').value=preset?.name??'';refreshPresetControls();});
$('preset-load').addEventListener('click',()=>{
  if(exporting)return;
  try{
    const preset=selectedPreset();if(!preset){notify('프리셋을 다시 선택해 주세요.',true);return;}
    configure(preset.settings);original=false;animationMs=0;lastTick=null;
    $('compare').setAttribute('aria-pressed','false');$('compare').textContent='원본 보기';$('preset-name').value=preset.name;render();
    if(!storageError)notify(`‘${preset.name}’ 설정을 불러왔어요.`);
  }catch(error){reportStorageError(error);}
});
function savePreset(update=false){
  if(exporting)return;
  try{
    const preset=update?selectedPreset():null;
    if(update&&!preset){notify('덮어쓸 프리셋을 선택해 주세요.',true);return;}
    if(update&&!window.confirm(`‘${preset.name}’ 프리셋을 현재 이름과 워터마크 설정으로 덮어쓸까요?`))return;
    const {state,id}=settingsStore.savePreset($('preset-name').value,settings,preset?.id??null);
    refreshPresetList(state.presets,id);$('preset-name').value=state.presets.find(p=>p.id===id).name;
    storageError='';storageStatus('프리셋과 마지막 설정을 저장했어요.');notify(update?'프리셋을 덮어썼어요.':'프리셋을 저장했어요. 다음에도 바로 불러올 수 있어요.');
  }catch(error){notify(error.message,true);}
}
$('preset-save').addEventListener('click',()=>savePreset());
$('preset-update').addEventListener('click',()=>savePreset(true));
$('preset-delete').addEventListener('click',()=>{
  if(exporting)return;
  try{
    const preset=selectedPreset();if(!preset)return;
    if(!window.confirm(`‘${preset.name}’ 프리셋을 삭제할까요? 현재 워터마크 설정은 그대로 남아요.`))return;
    const state=settingsStore.deletePreset(preset.id);$('preset-name').value='';refreshPresetList(state.presets,'');
    storageError='';storageStatus('프리셋을 삭제했어요.');notify('프리셋을 삭제했어요. 현재 설정은 그대로예요.');
  }catch(error){reportStorageError(error);}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){try{readPresets();}catch(error){reportStorageError(error);}}});
function useSource(image,name,width,height){source=image;sourceName=name;sourceWidth=width;sourceHeight=height;animationMs=0;lastTick=null;clearGifResult();original=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='원본 보기';$('empty-state').hidden=true;canvas.hidden=false;$('replace').hidden=false;$('file-info').textContent=`${name} · ${width.toLocaleString()} × ${height.toLocaleString()}`;$('file-info').title=$('file-info').textContent;render();}
async function loadFile(file){
  if(!file)return;if(exporting){notify('저장이 끝나거나 취소한 뒤 그림을 바꿔 주세요.');return;}
  const ticket=++loadTicket;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)&&!(/\.(jpe?g|png|webp)$/i.test(file.name))){notify('JPG, PNG, WebP 그림을 골라 주세요. HEIC는 JPG로 바꾼 뒤 불러올 수 있어요.',true);return;}
  if(file.size>40*1024*1024){notify('40MB 이하의 그림을 골라 주세요.',true);return;}
  const url=URL.createObjectURL(file),image=new Image();
  try{image.src=url;await image.decode();if(ticket!==loadTicket)return;
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h||w*h>40000000||w>16384||h>16384)throw new Error('그림이 너무 커요. 4,000만 화소 이하, 한 변 16,384px 이하로 줄여 주세요.');
    useSource(image,file.name,w,h);notify('그림을 불러왔어요. 원하는 느낌으로 조절해 보세요.');
  }catch(error){if(ticket===loadTicket)notify(error.message.startsWith('그림이 너무')?error.message:'그림을 읽지 못했어요. 다른 JPG 또는 PNG 파일로 다시 시도해 주세요.',true);}
  finally{URL.revokeObjectURL(url);}
}
$('upload').addEventListener('click',()=>$('file').click());$('replace').addEventListener('click',()=>$('file').click());$('file').addEventListener('change',()=>{const f=$('file').files[0];$('file').value='';loadFile(f);});
let dragDepth=0;const stage=$('dropzone');
stage.addEventListener('dragenter',event=>{event.preventDefault();dragDepth++;stage.classList.add('dragging');});stage.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';});stage.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)stage.classList.remove('dragging');});stage.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;stage.classList.remove('dragging');loadFile(event.dataTransfer.files[0]);});
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('compare').addEventListener('click',()=>{original=!original;$('compare').setAttribute('aria-pressed',String(original));$('compare').textContent=original?'워터마크 보기':'원본 보기';render();});
$('pause').addEventListener('click',()=>{paused=!paused;lastTick=null;render();});
document.addEventListener('visibilitychange',()=>{lastTick=null;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else render();});
$('cancel-export').addEventListener('click',()=>exportController?.abort());
$('sample').addEventListener('click',()=>{
  ++loadTicket;const sample=document.createElement('canvas');sample.width=1600;sample.height=1200;const c=sample.getContext('2d');
  c.fillStyle='#e6ebf6';c.fillRect(0,0,1600,1200);c.fillStyle='#fdfdff';c.fillRect(125,110,1350,980);c.strokeStyle='#dce3f3';c.lineWidth=2;
  for(let y=110;y<=1090;y+=70){c.beginPath();c.moveTo(125,y);c.lineTo(1475,y);c.stroke();}
  for(let x=125;x<=1475;x+=70){c.beginPath();c.moveTo(x,110);c.lineTo(x,1090);c.stroke();}
  c.fillStyle='#3959e8';c.fillRect(230,255,70,12);c.font='700 50px system-ui, sans-serif';c.fillText('WATERMARK TEST',230,360);
  c.fillStyle='#202b43';c.font='750 120px "Malgun Gothic", system-ui, sans-serif';c.fillText('도르단의',230,590);c.fillText('작업실',230,755);
  c.font='30px system-ui, sans-serif';c.fillStyle='#687797';c.fillText('크기와 간격을 조절해 보세요.',235,930);
  useSource(sample,'예시 이미지',1600,1200);
});
function filename(name,extension){return (name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')||'그림')+'_워터마크.'+extension;}
function saveBlob(blob,name,keep=false){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  if(keep){clearGifResult();lastExportUrl=url;$('gif-result').href=url;$('gif-result').download=name;$('gif-ready').hidden=false;}
  else setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function downloadGif(image,width,height,name,snapshot,signal){
  const scale=Math.min(1,snapshot.gifEdge/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const out=document.createElement('canvas');out.width=w;out.height=h;
  const c=out.getContext('2d',{willReadFrequently:true});if(!c)throw new Error('canvas');
  const draw=phase=>{c.fillStyle='#ffffff';c.fillRect(0,0,w,h);c.drawImage(image,0,0,w,h);drawWatermark(c,w,h,snapshot,phase);return c.getImageData(0,0,w,h).data;};
  try{
    const {encodeGif}=await import('./gif-export.mjs');
    // One fixed palette for every frame keeps the background colors stationary.
    const stride=Math.max(1,Math.ceil(w*h/65536)),sampleCount=Math.ceil(w*h/stride),samples=new Uint8Array(sampleCount*4*4);
    for(let phase=0;phase<4;phase++){
      if(signal.aborted)throw new DOMException('취소','AbortError');
      const pixels=draw(phase/4);
      for(let i=0,j=phase*sampleCount*4;i<pixels.length;i+=stride*4,j+=4)samples.set(pixels.subarray(i,i+4),j);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const bytes=await encodeGif({width:w,height:h,duration:snapshot.duration,samples,renderFrame:draw,signal,onProgress(percent){$('gif-progress').value=percent;$('gif-status').textContent=`GIF 만드는 중 · ${percent}%`;$('download').querySelector('span').textContent=`GIF 만드는 중 · ${percent}%`;}});
    if(signal.aborted)throw new DOMException('취소','AbortError');
    saveBlob(new Blob([bytes],{type:'image/gif'}),filename(name,'gif'),true);
    notify(`움직이는 GIF를 만들었어요! ${w} × ${h}px\n저장이 시작되지 않으면 아래 다운로드를 눌러 주세요.`);
  }finally{out.width=0;out.height=0;}
}
async function download(){
  if(!source||!settings.text.trim()||exporting)return;
  exporting=true;clearGifResult();exportController=new AbortController();refreshControls();$('download').querySelector('span').textContent='그림을 저장하는 중…';
  const snapshot={...settings},image=source,w=sourceWidth,h=sourceHeight,name=sourceName;
  $('export-progress').hidden=snapshot.format!=='gif';$('gif-progress').value=0;$('gif-status').textContent='GIF 준비 중…';
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const out=document.createElement('canvas');
  try{
    if(snapshot.format==='gif'){await downloadGif(image,w,h,name,snapshot,exportController.signal);return;}
    out.width=w;out.height=h;const c=out.getContext('2d');if(!c)throw new Error('canvas');
    if(snapshot.format==='jpeg'){c.fillStyle='#ffffff';c.fillRect(0,0,w,h);}
    c.drawImage(image,0,0,w,h);drawWatermark(c,w,h,snapshot);
    const blob=await new Promise((resolve,reject)=>out.toBlob(result=>result?resolve(result):reject(new Error('encode')),'image/'+snapshot.format,.95));
    saveBlob(blob,filename(name,snapshot.format==='jpeg'?'jpg':'png'));
    notify('저장할 그림을 준비했어요. 기기의 다운로드 목록을 확인해 주세요.');
  }catch(error){notify(error.name==='AbortError'?'GIF 저장을 취소했어요.':'이 기기에서 그림을 저장하지 못했어요. 저장 크기를 줄이거나 다른 브라우저에서 다시 시도해 주세요.',error.name!=='AbortError');}
  finally{out.width=0;out.height=0;exporting=false;exportController=null;lastTick=null;$('export-progress').hidden=true;render();}
}
$('download').addEventListener('click',download);
try{
  const {state,recovered}=settingsStore.read();
  if(state.lastSettings)settings=state.lastSettings;
  refreshPresetList(state.presets);
  if(recovered)storageStatus('읽을 수 없는 저장 항목은 건너뛰었어요. 설정을 확인한 뒤 다시 저장해 주세요.',true);
  else if(state.lastSettings)storageStatus('지난번 워터마크 설정을 불러왔어요.');
}catch(error){storageStatus(error.message,true);storageError=error.message;}
render();
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();
  const properties={text:{type:'string',maxLength:80},mode:{type:'string',enum:['all','single']},font:{type:'string',enum:['sans','serif']},bold:{type:'boolean'},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},opacity:{type:'number',minimum:5,maximum:100},size:{type:'number',minimum:1,maximum:15},gap:{type:'number',minimum:.3,maximum:6},lineGap:{type:'number',minimum:.5,maximum:7},position:{type:'number',minimum:5,maximum:95},angle:{type:'number',minimum:-45,maximum:45},outline:{type:'boolean'},format:{type:'string',enum:['png','jpeg','gif']},motion:{type:'string',enum:['none','right','left']},duration:{type:'number',enum:[2,4,6]},gifEdge:{type:'number',enum:[480,640,960]}};
  for(const tool of [
    {name:'get_watermark_settings',description:'Read the current visible watermark settings and whether an image is loaded.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){return {settings:{...settings},image:source?{name:sourceName,width:sourceWidth,height:sourceHeight}:null};}},
    {name:'configure_watermark',description:'Change the visible watermark text, repetition, spacing, color, and export settings. Does not load or download an image.',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){const result=configure(input);await new Promise(resolve=>requestAnimationFrame(resolve));return {settings:result,imageLoaded:Boolean(source)};}}
  ]){try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
