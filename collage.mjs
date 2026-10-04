export const MAX_PHOTOS = 12;
export const collageDefaults = Object.freeze({layout:'grid',columns:'auto',ratio:'original',fit:'contain',gap:16,background:'#ffffff',edge:2400});

// Geometry stays independent of the DOM so preview and export use the same layout.
export function layoutCollage(images, options={}) {
  if (!images.length || images.length > MAX_PHOTOS) throw new Error('사진은 1~12장으로 골라 주세요.');
  if (images.some(p=>!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<=0||p.height<=0)) throw new Error('사진 크기를 확인해 주세요.');
  const o={...collageDefaults,...options};
  if (!['grid','vertical','horizontal'].includes(o.layout)||!['auto','2','3','4'].includes(String(o.columns))||!['original','square','portrait','landscape'].includes(o.ratio)||!['contain','cover'].includes(o.fit)||![1600,2400,3200].includes(o.edge)||!Number.isFinite(o.gap)||o.gap<0||o.gap>80||!/^#[0-9a-f]{6}$/i.test(o.background)) throw new Error('콜라주 설정을 확인해 주세요.');
  const n=images.length, gap=o.gap, boxes=[];
  let width,height;
  if(o.layout==='grid') {
    const columns=Math.min(n,o.columns==='auto'?Math.ceil(Math.sqrt(n)):Number(o.columns));
    const rows=Math.ceil(n/columns);
    const ratio=({square:1,portrait:4/5,landscape:4/3})[o.ratio]||images[0].width/images[0].height;
    const cellWidth=Math.min((o.edge-gap*(columns+1))/columns,(o.edge-gap*(rows+1))*ratio/rows);
    const cellHeight=cellWidth/ratio;
    width=columns*cellWidth+gap*(columns+1);height=rows*cellHeight+gap*(rows+1);
    for(let i=0;i<n;i++) {
      const row=Math.floor(i/columns),rowCount=Math.min(columns,n-row*columns);
      const start=(width-(rowCount*cellWidth+(rowCount-1)*gap))/2;
      boxes.push({x:start+(i%columns)*(cellWidth+gap),y:gap+row*(cellHeight+gap),width:cellWidth,height:cellHeight});
    }
  } else {
    const vertical=o.layout==='vertical';
    const ratios=images.map(p=>vertical?p.height/p.width:p.width/p.height);
    const cross=Math.min(o.edge-2*gap,(o.edge-gap*(n+1))/ratios.reduce((sum,r)=>sum+r,0));
    let along=gap;
    for(const ratio of ratios) {
      const length=cross*ratio;
      boxes.push(vertical?{x:gap,y:along,width:cross,height:length}:{x:along,y:gap,width:length,height:cross});
      along+=length+gap;
    }
    width=vertical?cross+2*gap:along;height=vertical?along:cross+2*gap;
  }
  const result={width:Math.round(width),height:Math.round(height),boxes,options:o};
  if(result.width<1||result.height<1||boxes.some(b=>b.width<1||b.height<1)) throw new Error('사진이 너무 길거나 좁아요. 배치나 사진 비율을 바꿔 주세요.');
  return result;
}

export function imagePlacement(image, box, fit='contain') {
  const scale=fit==='cover'?Math.max(box.width/image.width,box.height/image.height):Math.min(box.width/image.width,box.height/image.height);
  const width=image.width*scale,height=image.height*scale;
  return {x:box.x+(box.width-width)/2,y:box.y+(box.height-height)/2,width,height};
}

export function drawCollage(canvas, photos, options={}) {
  const layout=layoutCollage(photos,options);
  canvas.width=layout.width;canvas.height=layout.height;
  const c=canvas.getContext('2d');
  if(!c) throw new Error('이 기기에서 콜라주를 만들지 못했어요.');
  c.fillStyle=layout.options.background;c.fillRect(0,0,canvas.width,canvas.height);
  photos.forEach((photo,i)=>{
    const box=layout.boxes[i];
    const p=imagePlacement(photo,box,layout.options.layout==='grid'?layout.options.fit:'contain');
    c.save();c.beginPath();c.rect(box.x,box.y,box.width,box.height);c.clip();
    c.drawImage(photo.image,p.x,p.y,p.width,p.height);c.restore();
  });
  return layout;
}
