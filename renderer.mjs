export const defaults = Object.freeze({text:'도르단',mode:'all',font:'sans',bold:true,color:'#1a2030',opacity:22,size:5,gap:1.6,lineGap:2,position:50,angle:0,outline:false,format:'png',motion:'none',duration:4,gifEdge:640});
export function validateSettings(input,current=defaults){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('설정은 객체여야 해요.');
  const next={...current};
  const ranges={opacity:[5,100],size:[1,15],gap:[.3,6],lineGap:[.5,7],position:[5,95],angle:[-45,45]};
  for(const [key,value] of Object.entries(input)){
    if(!(key in defaults))throw new Error('지원하지 않는 설정: '+key);
    if(key in ranges){const [min,max]=ranges[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(key+' 값의 범위를 확인해 주세요.');}
    else if(key==='text'){if(typeof value!=='string'||value.length>80||/[\r\n]/.test(value))throw new Error('문구는 80자 이내 한 줄로 입력해 주세요.');}
    else if(key==='bold'||key==='outline'){if(typeof value!=='boolean')throw new Error(key+'는 참/거짓이어야 해요.');}
    else if(key==='color'){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('올바른 색상을 골라 주세요.');}
    else if(!({mode:['all','single'],font:['sans','serif'],format:['png','jpeg','gif'],motion:['none','right','left'],duration:[2,4,6],gifEdge:[480,640,960]}[key]||[]).includes(value))throw new Error('올바른 '+key+' 값을 골라 주세요.');
    next[key]=value;
  }
  return next;
}
export function drawWatermark(ctx,width,height,settings,phase=0){
  const text=settings.text.trim();if(!text)return;
  const size=Math.min(width,height)*settings.size/100;
  const family=settings.font==='serif'?'"Nanum Myeongjo", "Batang", "AppleMyungjo", serif':'"Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  ctx.save();ctx.font=`${settings.bold?700:400} ${size}px ${family}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=settings.opacity/100;ctx.fillStyle=settings.color;
  const textWidth=ctx.measureText(text).width;
  const stepX=Math.max(size,textWidth+size*settings.gap),stepY=size*(1+settings.lineGap);
  const offset=settings.motion==='none'?0:(((phase%1)+1)%1)*stepX*(settings.motion==='left'?-1:1);
  const half=Math.hypot(width,height)/2+size*2;
  ctx.translate(width/2,height*(settings.mode==='single'?settings.position/100:.5));ctx.rotate(settings.angle*Math.PI/180);
  const extent=settings.mode==='single'?Math.hypot(width,height)+size*2:half;
  const rows=settings.mode==='single'?0:Math.ceil(half/stepY),cols=Math.ceil(extent/stepX)+1;
  const rgb=settings.color.match(/[a-f0-9]{2}/ig).map(h=>parseInt(h,16));
  ctx.strokeStyle=(rgb[0]*.299+rgb[1]*.587+rgb[2]*.114)>140?'#101624':'#ffffff';ctx.lineWidth=Math.max(1,size*.045);ctx.lineJoin='round';
  for(let row=-rows;row<=rows;row++)for(let col=-cols;col<=cols;col++){
    const x=col*stepX+offset,y=row*stepY;
    if(settings.outline)ctx.strokeText(text,x,y);ctx.fillText(text,x,y);
  }
  ctx.restore();
}
