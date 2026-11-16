export function installBackGesture(target:Window,onBack:()=>void){
 let accumulated=0,last=0,triggered=false,timer:ReturnType<typeof setTimeout>|undefined;
 const wheel=(event:WheelEvent)=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||(event.target as Element)?.closest?.('input,textarea,select,[data-horizontal-scroll]'))return;
  if(Math.abs(event.deltaX)<Math.abs(event.deltaY)*1.8||event.deltaX>=0){accumulated=0;return;}
  const now=Date.now();if(now-last>220){accumulated=0;triggered=false;}last=now;
  event.preventDefault();accumulated+=-event.deltaX*(event.deltaMode===1?16:1);
  if(!triggered&&accumulated>=120){triggered=true;onBack();}
  clearTimeout(timer);timer=setTimeout(()=>{accumulated=0;triggered=false;},220);
 };
 target.addEventListener('wheel',wheel,{passive:false});return()=>{clearTimeout(timer);target.removeEventListener('wheel',wheel);};
}
