import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutCollage,imagePlacement,drawCollage} from './collage.mjs';

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
  const context=Object.fromEntries(['fillRect','save','beginPath','rect','clip','drawImage','restore'].map(name=>[name,(...args)=>calls.push([name,...args])]));
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
  assert.throws(()=>layoutCollage([{width:16000,height:1}],{gap:0}));
});
