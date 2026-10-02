import {createWriter} from './gif-writer.mjs';
let writer;
self.onmessage=({data})=>{
  try{
    if(data.type==='init'){
      writer=createWriter(data.width,data.height,data.samples);
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      writer.frame(data.pixels,data.delay);
      self.postMessage({type:'frame'});
    }else if(data.type==='finish'){
      const bytes=writer.finish();writer=null;
      self.postMessage({type:'done',bytes},[bytes.buffer]);
    }
  }catch{self.postMessage({type:'error',message:'GIF를 만들지 못했어요. 크기를 줄여 다시 시도해 주세요.'});}
};
