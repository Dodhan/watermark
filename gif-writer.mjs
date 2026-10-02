// gifenc 1.0.3 (MIT). Kept locally so images never leave the browser.
import {GIFEncoder, quantize, applyPalette} from './vendor/gifenc.mjs';

export function createWriter(width,height,samples){
  const palette=quantize(samples,256,{format:'rgb565'});
  const encoder=GIFEncoder();
  let count=0;
  return {
    frame(pixels,delay){
      const indexed=applyPalette(pixels,palette,'rgb565');
      encoder.writeFrame(indexed,width,height,{palette:count++===0?palette:undefined,delay,repeat:0,dispose:1});
    },
    finish(){encoder.finish();return encoder.bytes();}
  };
}
