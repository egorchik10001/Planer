'use client';
import {useEffect,useRef,useState} from 'react';
import {animate,useMotionValue,useReducedMotion} from 'motion/react';
import type {Task} from './planner';
type Drag={task:Task;width:number;height:number;phase:'dragging'|'settling'};
type Candidate={task:Task;pointerId:number;pointerType:string;startX:number;startY:number;currentX:number;currentY:number;rect:DOMRect;element:HTMLElement};
export function useTaskDrag(onDrop:(task:Task,target:HTMLElement|null)=>void){
 const [drag,setDrag]=useState<Drag|null>(null),[dropHint,setDropHint]=useState<string|null>(null),[announcement,setAnnouncement]=useState('');
 const x=useMotionValue(0),y=useMotionValue(0),scale=useMotionValue(1),opacity=useMotionValue(1),tilt=useMotionValue(0),reduce=useReducedMotion();
 const active=useRef<Candidate|null>(null),pending=useRef<Candidate|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),clickUntil=useRef(0),controls=useRef<{stop:()=>void}[]>([]),drop=useRef(onDrop),autoScroll=useRef(0),scrollStep=useRef<()=>void>(()=>{}),generation=useRef(0);
 drop.current=onDrop;
 function stopAnimations(){for(const c of controls.current)c.stop();controls.current=[];}
 function clearPending(){if(timer.current)clearTimeout(timer.current);timer.current=null;pending.current=null;}
 function begin(candidate:Candidate){
  clearPending();generation.current++;stopAnimations();active.current=candidate;
  try{candidate.element.setPointerCapture(candidate.pointerId);}catch{}
  x.set(candidate.rect.left);y.set(candidate.rect.top);scale.jump(1);tilt.jump(0);opacity.set(1);
  setDrag({task:candidate.task,width:candidate.rect.width,height:candidate.rect.height,phase:'dragging'});
  cancelAnimationFrame(autoScroll.current);autoScroll.current=requestAnimationFrame(()=>scrollStep.current());
  document.body.classList.add('is-dragging');setAnnouncement('Перенос: '+candidate.task.title+'. Escape — отменить.');
  if(!reduce){controls.current.push(animate(scale,1.035,{type:'spring',duration:.5,bounce:.2}),animate(tilt,-1.25,{duration:.16,ease:[.23,1,.32,1]}));}
 }
 function targetAt(px:number,py:number){const target=document.elementFromPoint(px,py)?.closest<HTMLElement>('[data-drop]')||null;return target?.dataset.drop==='order:'+active.current?.task.id?null:target;}
 function end(cancel=false){
  clearPending();const candidate=active.current;if(!candidate)return;
  active.current=null;cancelAnimationFrame(autoScroll.current);document.body.classList.remove('is-dragging');clickUntil.current=Date.now()+350;
  try{candidate.element.releasePointerCapture(candidate.pointerId);}catch{}
  const target=cancel?null:document.elementFromPoint(candidate.currentX,candidate.currentY)?.closest<HTMLElement>('[data-drop]')||null;
  let failed=false;if(!cancel&&target)try{drop.current(candidate.task,target);}catch{failed=true;}
  setDropHint(null);setDrag(d=>d?{...d,phase:'settling'}:null);stopAnimations();const stamp=++generation.current;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(stamp!==generation.current)return;
   const card=document.querySelector<HTMLElement>('article.task-card[data-task-id="'+CSS.escape(candidate.task.id)+'"]');
   const rect=(card||target||candidate.element).getBoundingClientRect();
   if(reduce){controls.current.push(animate(opacity,0,{duration:.1}));}
   else{const transition={duration:.2,ease:[.23,1,.32,1] as [number,number,number,number]};controls.current.push(animate(x,rect.left,transition),animate(y,rect.top,transition),animate(scale,card?1:.97,transition),animate(tilt,0,transition),animate(opacity,card?1:0,transition));}
   setTimeout(()=>{if(stamp!==generation.current)return;setDrag(null);setAnnouncement(failed?'Не удалось перенести задачу.':cancel?'Перенос отменён.':'Задача перемещена.');},reduce?110:210);
  }));
 }
 function start(e:React.PointerEvent<HTMLElement>,task:Task){
  if(e.button!==0||!e.isPrimary)return;
  const target=e.target as HTMLElement,button=target.closest('button');
  if(target.closest('input,textarea,select,a,[data-no-drag]')||(button&&!button.classList.contains('card-main')&&!button.classList.contains('drag-handle')))return;
  clearPending();const candidate={task,pointerId:e.pointerId,pointerType:e.pointerType,startX:e.clientX,startY:e.clientY,currentX:e.clientX,currentY:e.clientY,rect:e.currentTarget.getBoundingClientRect(),element:e.currentTarget};
  pending.current=candidate;timer.current=setTimeout(()=>{if(pending.current===candidate)begin(candidate);},e.pointerType==='touch'?260:180);
 }
 useEffect(()=>{
  const move=(event:PointerEvent)=>{
   const candidate=active.current||pending.current;if(!candidate||event.pointerId!==candidate.pointerId)return;
   candidate.currentX=event.clientX;candidate.currentY=event.clientY;const distance=Math.hypot(event.clientX-candidate.startX,event.clientY-candidate.startY);
   if(!active.current){if(candidate.pointerType==='touch'&&distance>9){clearPending();return;}if(candidate.pointerType!=='touch'&&distance>6)begin(candidate);else return;}
   if(event.cancelable)event.preventDefault();x.set(candidate.rect.left+event.clientX-candidate.startX);y.set(candidate.rect.top+event.clientY-candidate.startY);setDropHint(targetAt(event.clientX,event.clientY)?.dataset.drop||null);
  };
  const scroll=()=>{const c=active.current;if(!c)return;const speed=c.currentY>innerHeight-80?12:c.currentY<70?-12:0;if(speed)window.scrollBy(0,speed);autoScroll.current=requestAnimationFrame(scroll);};
  scrollStep.current=scroll;
  const up=(e:PointerEvent)=>{if((active.current||pending.current)?.pointerId===e.pointerId)end();};
  const cancel=()=>end(true),key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&(active.current||pending.current)){e.preventDefault();e.stopImmediatePropagation();end(true);}},click=(e:MouseEvent)=>{if(Date.now()<clickUntil.current){e.preventDefault();e.stopImmediatePropagation();clickUntil.current=0;}},touch=(e:TouchEvent)=>{if(active.current)e.preventDefault();};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);window.addEventListener('click',click,true);document.addEventListener('touchmove',touch,{passive:false});
  return()=>{clearPending();generation.current++;stopAnimations();cancelAnimationFrame(autoScroll.current);document.body.classList.remove('is-dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('click',click,true);document.removeEventListener('touchmove',touch);};
 },[reduce]);
 return{drag,dropHint,start,x,y,scale,opacity,tilt,announcement};
}
