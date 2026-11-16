import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTask,compareTasks,weekDays,nextDate,nextTask,conflicts,dateKey,quietNow,defaultPreferences} from '../lib/planner.ts';
test('time order includes midnight, keeps stable manual order and puts untimed last',()=>{
 const tasks=[makeTask('Без времени',{time:null,order:0}),makeTask('Позднее',{time:'18:00'}),makeTask('Первое в полночь',{time:'00:00'}),makeTask('Второе',{time:'10:00',order:2}),makeTask('Первое',{time:'10:00',order:1})];
 assert.deepEqual(tasks.sort(compareTasks).map(t=>t.title),['Первое в полночь','Первое','Второе','Позднее','Без времени']);
});
test('week runs Monday to Sunday across a year boundary',()=>assert.deepEqual(weekDays('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']));
test('monthly recurrence clamps month-end rather than skipping February',()=>assert.equal(nextDate('2026-01-31','monthly'),'2026-02-28'));
test('overdue recurrence advances beyond today and resets checklist once per series date',()=>{const t=makeTask('Повтор',{id:'series',date:'2026-11-01',repeat:'weekly',subtasks:[{id:'s',title:'Шаг',done:true}]});const a=nextTask(t,'2026-11-13'),b=nextTask(t,'2026-11-13');assert.equal(a.date,'2026-11-15');assert.equal(a.id,b.id);assert.equal(a.subtasks[0].done,false);});
test('workload only flags real same-day intersections with known durations',()=>{const tasks=[makeTask('A',{date:'2026-11-13',time:'10:00',duration:60}),makeTask('B',{date:'2026-11-13',time:'10:30',duration:15}),makeTask('C',{date:'2026-11-14',time:'10:00',duration:120}),makeTask('D',{date:'2026-11-13',time:'10:45',duration:null})];assert.equal(conflicts(tasks).length,1);});
test('timezone determines local date and overnight quiet hours',()=>{assert.equal(dateKey(new Date('2026-11-12T20:00:00Z'),'Asia/Novosibirsk'),'2026-11-13');assert.equal(quietNow(defaultPreferences,new Date('2026-11-12T20:00:00Z')),true);assert.equal(quietNow(defaultPreferences,new Date('2026-11-13T05:00:00Z')),false);});
