export function pcmSpeechData(bytes:Uint8Array){
 const audio=Buffer.from(bytes);if(audio.length<44||audio.length>16*1024*1024||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw Error('Нужна запись WAV.');
 let fmt=-1,start=-1,length=0;
 for(let offset=12;offset+8<=audio.length;){const kind=audio.toString('ascii',offset,offset+4),size=audio.readUInt32LE(offset+4),next=offset+8+size;if(next>audio.length)throw Error('Запись повреждена.');if(kind==='fmt '&&size>=16)fmt=offset+8;if(kind==='data'){start=offset+8;length=size;}offset=next+(size%2);}
 if(fmt<0||start<0||audio.readUInt16LE(fmt)!==1||audio.readUInt16LE(fmt+2)!==1||audio.readUInt32LE(fmt+4)!==16000||audio.readUInt16LE(fmt+14)!==16||length%2)throw Error('Нужно подготовить запись WAV 16 кГц. Обновите приложение.');
 if(length>16000*2*180)throw Error('Запишите сообщение до трёх минут.');return audio.subarray(start,start+length);
}
