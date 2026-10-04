import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsStore,STORAGE_KEY,MAX_PRESETS} from './settings-storage.mjs';
import {defaults} from './renderer.mjs';

function fixture(){const data=new Map();const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};return {storage,data,store:createSettingsStore(()=>storage)};}
test('named presets and all last-used settings survive a new session',()=>{
  const {store,storage,data}=fixture();
  const settings={...defaults,text:'구마 💜',mode:'single',font:'serif',bold:false,color:'#ffffff',opacity:47,size:7.5,gap:2.1,lineGap:3.2,position:75,angle:-20,outline:true,motion:'left',format:'gif',duration:2,gifEdge:480};
  store.savePreset('스밍 인증용',settings);
  const next=createSettingsStore(()=>storage).read().state;
  assert.deepEqual(next.lastSettings,settings);assert.deepEqual(next.presets[0].settings,settings);
  assert.deepEqual(Object.keys(JSON.parse(data.get(STORAGE_KEY))).sort(),['lastSettings','presets','version']);
});
test('duplicate names require explicit overwrite; reset and delete preserve other settings',()=>{
  const {store}=fixture();const saved=store.savePreset('그림용',defaults);
  assert.throws(()=>store.savePreset(' 그림용 ',defaults),/같은 이름/);
  store.savePreset('그림용', {...defaults,text:'새 문구'},saved.id);
  store.saveLast(defaults);
  assert.equal(store.read().state.presets[0].settings.text,'새 문구');
  store.deletePreset(saved.id);
  assert.equal(store.read().state.presets.length,0);assert.deepEqual(store.read().state.lastSettings,defaults);
});
test('another tab does not lose presets when saving last-used settings',()=>{
  const {store,storage}=fixture(),second=createSettingsStore(()=>storage);
  const first=store.savePreset('첫째',defaults);second.savePreset('둘째',defaults);store.saveLast({...defaults,text:'현재'});
  assert.equal(second.read().state.presets.length,2);
  second.deletePreset(first.id);
  assert.throws(()=>store.savePreset('첫째',defaults,first.id),/다른 창에서 삭제/);
});
test('damaged JSON and bad entries recover without breaking valid presets',()=>{
  const {store,data}=fixture();data.set(STORAGE_KEY,'{bad');assert.equal(store.read().recovered,true);
  store.savePreset('정상',defaults);const state=store.read().state;
  state.presets.push({id:'bad',name:'잘못된 설정',settings:{size:Infinity}});state.lastSettings={color:'invalid'};
  data.set(STORAGE_KEY,JSON.stringify(state));const loaded=store.read();
  assert.equal(loaded.recovered,true);assert.equal(loaded.state.presets.length,1);assert.equal(loaded.state.lastSettings,null);
});
test('unavailable or full storage reports failure without falsely saving',()=>{
  assert.throws(()=>createSettingsStore(()=>{throw new Error('denied');}).read(),/저장할 수 없어요/);
  const {store,storage}=fixture();store.savePreset('기존',defaults);
  storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>store.savePreset('실패',defaults),/저장하지 못했어요/);
  assert.equal(store.read().state.presets.length,1);
});
test('preset capacity and newer storage versions are respected',()=>{
  const {store,data}=fixture();for(let i=0;i<MAX_PRESETS;i++)store.savePreset(String(i),defaults);
  assert.throws(()=>store.savePreset('초과',defaults),/30개/);
  const raw=JSON.stringify({version:2,presets:[]});data.set(STORAGE_KEY,raw);
  assert.throws(()=>store.saveLast(defaults),/버전이 달라요/);assert.equal(data.get(STORAGE_KEY),raw);
});
