type MessageHandler = {postMessage(message: {action: string; [key:string]: unknown}): Promise<unknown>};
const handler = (window as Window & {webkit?: {messageHandlers?: {planner?: MessageHandler}}}).webkit?.messageHandlers?.planner;

export async function native<Result = void>(action: string, fields: Record<string, unknown> = {}): Promise<Result> {
  if (!handler) throw Error('Открой Планер из приложения на iPhone.');
  return await handler.postMessage({action,...fields}) as Result;
}

export function base64(bytes: Uint8Array) {
  let encoded = '';
  for (let offset=0;offset<bytes.length;offset+=8192) {
    encoded += String.fromCharCode(...bytes.subarray(offset,offset+8192));
  }
  return btoa(encoded);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value),character=>character.charCodeAt(0));
}

function uuid() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const value=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

export function setUpNativeBridge() {
  if (!handler||window.plannerIOS) return;
  if (!crypto.randomUUID) Object.defineProperty(crypto,'randomUUID',{value:uuid});
  window.plannerIOS={
    startRecording:()=>native('startRecording'),
    stopRecording:async()=>new Blob([fromBase64(await native<string>('stopRecording'))],{type:'audio/wav'}),
    cancelRecording:()=>native('cancelRecording'),
    shareFile:async(name,file)=>native('shareFile',{name,data:base64(new Uint8Array(await file.arrayBuffer()))}),
    voiceReady:()=>native('voiceReady'),
    openVoiceSettings:()=>native('openVoiceSettings'),
    transcribe:async file=>native('transcribe',{data:base64(new Uint8Array(await file.arrayBuffer()))}),
    generate:prompt=>native('interpret',{prompt})
  };
}
setUpNativeBridge();
