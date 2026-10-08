import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutCollage,imagePlacement,drawCollage,drawOriginalCollage,MAX_COLLAGE_PIXELS,MAX_COLLAGE_EDGE} from './collage.mjs';

const photos=[{width:900,height:1600},{width:1600,height:900},{width:1200,height:1200},{width:1000,height:2200},{width:1000,height:1300}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);

test('mixed screenshot sizes fit every supported layout without overlapping or exceeding the output limit',()=>{
  for(let count=1;count<=12;count++)for(const mode of ['grid','vertical','horizontal'])for(const edge of [1600,2400,3200])for(const gap of [0,16,80]){
    const images=Array.from({length:count},(_,i)=>photos[i%photos.length]);
    const l=layoutCollage(images,{layout:mode,edge,gap});
    assert.equal(Math.max(l.width,l.height),edge);
    assert.equal(l.boxes.length,count);
    for(const [i,b] of l.boxes.entries()){
      assert.ok(b.x>=gap-.001&&b.y>=gap-.001);
      assert.ok(b.x+b.width<=l.width-gap+.51&&b.y+b.height<=l.height-gap+.51);
      for(const other of l.boxes.slice(i+1))assert.ok(b.x+b.width<=other.x+.001||other.x+other.width<=b.x+.001||b.y+b.height<=other.y+.001||other.y+other.height<=b.y+.001);
      if(mode!=='grid')close(b.width/b.height,images[i].width/images[i].height);
    }
  }
});

test('incomplete grid rows are centered and requested aspect ratios are preserved',()=>{
  const l=layoutCollage(photos,{columns:'3',ratio:'portrait'});
  for(const box of l.boxes)close(box.width/box.height,4/5);
  close(l.boxes[3].x,l.width-l.boxes[4].x-l.boxes[4].width);
  assert.ok(l.boxes[3].x>l.boxes[0].x);
});

test('contain preserves every edge of a tall screenshot; cover deliberately crops it',()=>{
  const image={width:100,height:400},box={x:10,y:20,width:200,height:200};
  const contained=imagePlacement(image,box,'contain');
  assert.deepEqual(contained,{x:85,y:20,width:50,height:200});
  assert.deepEqual(imagePlacement(image,box,'cover'),{x:10,y:-280,width:200,height:800});
});

test('vertical and horizontal strips retain original proportions despite grid crop settings',()=>{
  for(const layout of ['vertical','horizontal']){
    const l=layoutCollage(photos,{layout,ratio:'square',fit:'cover'});
    l.boxes.forEach((b,i)=>close(b.width/b.height,photos[i].width/photos[i].height));
  }
});

test('renderer follows photo order and restores clipping for each image',()=>{
  const calls=[];
  const context=Object.fromEntries(['fillRect','scale','save','beginPath','rect','clip','drawImage','restore'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  const canvas={getContext:()=>context};
  const images=photos.map((photo,i)=>({...photo,image:{id:i}}));
  const l=drawCollage(canvas,[images[2],images[0]],{background:'#abcdef'});
  assert.equal(canvas.width,l.width);assert.equal(canvas.height,l.height);
  assert.equal(context.fillStyle,'#abcdef');
  assert.deepEqual(calls.filter(c=>c[0]==='drawImage').map(c=>c[1].id),[2,0]);
  assert.equal(calls.filter(c=>c[0]==='clip').length,2);
  assert.equal(calls.filter(c=>c[0]==='restore').length,2);
});

test('invalid inputs and unsafe layout sizes fail before drawing',()=>{
  assert.throws(()=>layoutCollage([]));
  assert.throws(()=>layoutCollage(Array(13).fill(photos[0])));
  assert.throws(()=>layoutCollage([{width:0,height:50}]));
  assert.throws(()=>layoutCollage(photos,{edge:50000}));
  assert.throws(()=>layoutCollage(photos,{gap:Infinity}));
  assert.throws(()=>layoutCollage([{width:16000,height:1}],{gap:0,edge:1600}));
});

test('original mode keeps the native pixels of matching high resolution photos',()=>{
  const originals=Array.from({length:4},()=>({width:2400,height:1800}));
  const l=layoutCollage(originals,{gap:0});
  assert.equal(l.width,4800);assert.equal(l.height,3600);assert.equal(l.limited,false);
  for(const box of l.boxes){assert.equal(box.width,2400);assert.equal(box.height,1800);}
  assert.equal(layoutCollage([{width:320,height:240}],{gap:0}).width,320);
});

test('original layout and larger presets always respect canvas area and edge limits',()=>{
  for(const layout of ['grid','vertical','horizontal'])for(const edge of ['original',4800,6400]){
    const l=layoutCollage(Array.from({length:12},()=>({width:6000,height:4000})),{layout,edge});
    assert.ok(l.width*l.height<=MAX_COLLAGE_PIXELS);
    assert.ok(Math.max(l.width,l.height)<=MAX_COLLAGE_EDGE);
    if(edge==='original')assert.equal(l.limited,true);
  }
  const tall=layoutCollage([{width:1000,height:16000},{width:1000,height:16000}],{layout:'vertical',gap:0});
  assert.equal(tall.height,16384);assert.equal(tall.requestedHeight,32000);assert.equal(tall.limited,true);
});

test('preview limits do not change original output dimensions or composition',()=>{
  const calls=[];
  const c=Object.fromEntries(['fillRect','scale','save','beginPath','rect','clip','drawImage','restore'].map(n=>[n,(...a)=>calls.push([n,...a])]));
  const canvas={getContext:()=>c};
  const originals=Array.from({length:4},(_,i)=>({width:2400,height:1800,image:{thumbnail:i}}));
  const layout=drawCollage(canvas,originals,{gap:0},1600);
  assert.equal(canvas.width,1600);assert.equal(canvas.height,1200);
  assert.equal(layout.width,4800);assert.equal(layout.height,3600);
  assert.deepEqual(calls.find(x=>x[0]==='scale'),['scale',1/3,1/3]);
});

test('export loads full originals in order, releases each before the next and resets the transform',async()=>{
  const events=[];
  const c=Object.fromEntries(['fillRect','scale','save','beginPath','rect','clip','restore','setTransform'].map(n=>[n,(...a)=>events.push([n,...a])]));
  c.drawImage=(image,...args)=>events.push(['draw',image,...args]);
  const canvas={getContext:()=>c};
  const originals=[{width:2400,height:1800,id:1,image:'preview 1'},{width:2400,height:1800,id:2,image:'preview 2'}];
  await drawOriginalCollage(canvas,originals,{layout:'horizontal',gap:0},async p=>{
    events.push(['load',p.id]);return {image:`original ${p.id}`,release:()=>events.push(['release',p.id])};
  },(done,total)=>events.push(['progress',done,total]));
  assert.equal(canvas.width,4800);assert.equal(canvas.height,1800);
  assert.deepEqual(events.filter(e=>['load','draw','release','progress'].includes(e[0])),[
    ['load',1],['draw','original 1',0,0,2400,1800],['release',1],['progress',1,2],
    ['load',2],['draw','original 2',2400,0,2400,1800],['release',2],['progress',2,2]
  ]);
  assert.deepEqual(events.at(-1),['setTransform',1,0,0,1,0,0]);
});

test('failed drawing releases the loaded original and clears the large export canvas',async()=>{
  let released=false;
  const c=Object.fromEntries(['fillRect','scale','save','beginPath','rect','clip'].map(n=>[n,()=>{}]));
  c.drawImage=()=>{throw new Error('out of memory');};
  const canvas={getContext:()=>c};
  await assert.rejects(drawOriginalCollage(canvas,[{width:2400,height:1800}],{},async()=>({image:{},release:()=>{released=true;}})),/out of memory/);
  assert.equal(released,true);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});
