import {defaults,validateSettings} from './renderer.mjs';

export const STORAGE_KEY='dordan-watermark.preferences.v1';
export const MAX_PRESETS=30;
const emptyState=()=>({version:1,lastSettings:null,presets:[]});
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function cleanSettings(value){
  if(!isObject(value))throw new Error('Invalid settings');
  const input=Object.fromEntries(Object.keys(defaults).filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
  if(!Object.keys(input).length)throw new Error('Empty settings');
  const result=validateSettings(input);
  if(result.motion!=='none')result.format='gif';
  else if(result.format==='gif')result.motion='right';
  return result;
}

export function createSettingsStore(getStorage){
  function read(){
    let raw;
    try{raw=getStorage().getItem(STORAGE_KEY);}catch{throw new Error('이 브라우저에서는 설정을 저장할 수 없어요. 워터마크 만들기는 계속 사용할 수 있어요.');}
    if(raw===null)return {state:emptyState(),recovered:false};
    let value;
    try{value=JSON.parse(raw);}catch{return {state:emptyState(),recovered:true};}
    if(!isObject(value))return {state:emptyState(),recovered:true};
    if(value.version!==1)throw new Error('저장된 설정의 버전이 달라요. 페이지를 새로고침해 주세요.');
    const state=emptyState();let recovered=false;
    if(value.lastSettings!=null){try{state.lastSettings=cleanSettings(value.lastSettings);}catch{recovered=true;}}
    if(!Array.isArray(value.presets))recovered=true;
    for(const item of Array.isArray(value.presets)?value.presets:[]){
      try{
        if(!isObject(item)||typeof item.id!=='string'||!item.id||item.id.length>100||typeof item.name!=='string')throw new Error('Invalid preset');
        const name=item.name.trim();
        if(!name||name.length>40||/[\r\n]/.test(name)||state.presets.some(p=>p.id===item.id||p.name===name)||state.presets.length>=MAX_PRESETS)throw new Error('Invalid preset');
        state.presets.push({id:item.id,name,settings:cleanSettings(item.settings)});
      }catch{recovered=true;}
    }
    return {state,recovered};
  }
  function write(state){
    try{getStorage().setItem(STORAGE_KEY,JSON.stringify(state));}
    catch{throw new Error('설정을 저장하지 못했어요. 브라우저의 저장 공간과 사이트 데이터 설정을 확인해 주세요.');}
    return state;
  }
  return {
    read,
    saveLast(settings){const {state}=read();state.lastSettings=cleanSettings(settings);return write(state);},
    savePreset(name,settings,id=null){
      if(typeof name!=='string'||!name.trim())throw new Error('프리셋 이름을 적어 주세요.');
      name=name.trim();
      if(name.length>40||/[\r\n]/.test(name))throw new Error('이름은 40자 이내 한 줄로 적어 주세요.');
      const {state}=read(),index=state.presets.findIndex(p=>p.id===id);
      if(id!==null&&index<0)throw new Error('이 프리셋이 다른 창에서 삭제됐어요. 새 이름으로 저장해 주세요.');
      if(state.presets.some(p=>p.name===name&&p.id!==id))throw new Error('같은 이름이 있어요. 다른 이름을 쓰거나 해당 프리셋을 선택해 덮어써 주세요.');
      if(id===null&&state.presets.length>=MAX_PRESETS)throw new Error('프리셋은 30개까지 저장할 수 있어요. 사용하지 않는 프리셋을 삭제해 주세요.');
      const preset={id:id??globalThis.crypto.randomUUID(),name,settings:cleanSettings(settings)};
      if(index<0)state.presets.push(preset);else state.presets[index]=preset;
      state.lastSettings=preset.settings;
      write(state);
      return {state,id:preset.id};
    },
    deletePreset(id){const {state}=read();state.presets=state.presets.filter(p=>p.id!==id);return write(state);}
  };
}
