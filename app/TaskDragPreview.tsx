'use client';
import {motion,useTransform,type MotionValue} from 'motion/react';
import type {Task} from '../lib/planner';
export default function TaskDragPreview({drag,color,projectName,x,y,scale,opacity,tilt}:{drag:{task:Task;width:number;height:number};color:string;projectName:string;x:MotionValue<number>;y:MotionValue<number>;scale:MotionValue<number>;opacity:MotionValue<number>;tilt:MotionValue<number>}){
 const transform=useTransform([x,y,scale,tilt],([px,py,s,r])=>`translate3d(${px}px,${py}px,0) scale(${s}) rotate(${r}deg)`);
 return <motion.div className="task-drag-preview" aria-hidden="true" style={{transform,opacity,width:drag.width,minHeight:drag.height,background:color}}><div className="drag-preview-time">{drag.task.time||'Без времени'}</div><div><strong>{drag.task.title}</strong><span>{projectName}</span></div></motion.div>;
}
