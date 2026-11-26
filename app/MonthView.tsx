import {addDays, formatDay, formatTaskCount, weekDays, type Task} from '../lib/planner';

export function monthOffset(date:string, offset:number){
 const start=new Date(date.slice(0,7)+'-01T12:00:00Z');
 start.setUTCMonth(start.getUTCMonth()+offset);
 return start.toISOString().slice(0,10);
}

export default function MonthView({date,today,tasks,onDay}:{date:string;today:string;tasks:Task[];onDay:(date:string)=>void}){
 const month=date.slice(0,7), start=weekDays(month+'-01')[0];
 const end=weekDays(addDays(monthOffset(date,1),-1))[6];
 const days=[];
 for(let day=start;day<=end;day=addDays(day,1))days.push(day);
 const counts=new Map<string,number>();
 for(const task of tasks)if(task.date)counts.set(task.date,(counts.get(task.date)??0)+1);
 return <section className="month-view">
  <div className="view-heading"><h1>Месяц</h1></div>
  <div className="month-grid">
   {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(label=><span className="month-weekday" key={label}>{label}</span>)}
   {days.map(day=>{
    const count=counts.get(day)??0;
    return <button key={day} type="button" className={'month-day'+(day.startsWith(month)?'':' outside-month')+(day===today?' current-day':'')}
      aria-current={day===today?'date':undefined} aria-label={formatDay(day)+', '+formatTaskCount(count)} onClick={()=>onDay(day)}>
     <span>{Number(day.slice(8))}</span>{count>0&&<span className="month-count" aria-hidden="true">{count}</span>}
    </button>;
   })}
  </div>
 </section>;
}
