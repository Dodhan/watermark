const abortError=()=>new DOMException('저장을 취소했어요.','AbortError');
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));

function exchange(worker,message,transfer,signal){
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);signal?.removeEventListener('abort',onAbort);};
    const fail=error=>{cleanup();reject(error);};
    const onMessage=({data})=>{if(data.type==='error')fail(new Error(data.message));else{cleanup();resolve(data);}};
    const onError=()=>fail(new Error('GIF 작업을 시작하지 못했어요.'));
    const onAbort=()=>fail(abortError());
    const timer=setTimeout(()=>fail(new Error('GIF 저장 시간이 길어졌어요. 크기를 줄여 다시 시도해 주세요.')),30000);
    worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted){onAbort();return;}
    try{worker.postMessage(message,transfer);}catch(error){fail(error);}
  });
}

export async function encodeGif({width,height,duration,samples,renderFrame,onProgress=()=>{},signal}){
  const frameCount=Math.round(duration*12);
  let worker,writer;
  try{
    if(typeof Worker!=='undefined'){
      try{
        worker=new Worker(new URL('./gif-worker.mjs',import.meta.url),{type:'module'});
        // Keep the small sample buffer intact for browsers needing the fallback.
        await exchange(worker,{type:'init',width,height,samples},[],signal);
      }catch(error){worker?.terminate();worker=null;if(signal?.aborted)throw abortError();}
    }
    if(!worker){const {createWriter}=await import('./gif-writer.mjs');if(signal?.aborted)throw abortError();writer=createWriter(width,height,samples);}
    for(let i=0;i<frameCount;i++){
      if(signal?.aborted)throw abortError();
      const pixels=renderFrame(i/frameCount);
      // GIF delays are centiseconds. Rounding cumulative times preserves loop length.
      const delay=(Math.round((i+1)*duration*100/frameCount)-Math.round(i*duration*100/frameCount))*10;
      if(worker)await exchange(worker,{type:'frame',pixels,delay},[pixels.buffer],signal);
      else{writer.frame(pixels,delay);await yieldFrame();}
      onProgress(Math.round((i+1)/frameCount*100));
    }
    if(signal?.aborted)throw abortError();
    return worker?(await exchange(worker,{type:'finish'},[],signal)).bytes:writer.finish();
  }finally{worker?.terminate();}
}
