export async function speechWav(blob:Blob):Promise<Blob>{
 const context=new AudioContext();
 try{
  const decoded=await context.decodeAudioData(await blob.arrayBuffer());
  if(!Number.isFinite(decoded.duration)||decoded.duration>182)throw Error('Запишите сообщение до трёх минут. Длинную запись можно скачать и разделить.');
  const rate=16000,length=Math.min(180*rate,Math.ceil(decoded.duration*rate)),offline=new OfflineAudioContext(1,length,rate),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering(),samples=rendered.getChannelData(0),bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
  const text=(at:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const s=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,s<0?s*32768:s*32767,true);}
  return new Blob([bytes],{type:'audio/wav'});
 }finally{await context.close();}
}
