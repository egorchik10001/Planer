import { env } from 'cloudflare:workers';
import { defaultProjects, defaultPreferences, nextTask, dateKey, type Entity, type Mutation, type Conflict, type Task } from './planner';
import { taskSchema, projectSchema, settingsSchema } from './validation';

function db() { if (!env.DB) throw new Error('База данных пока недоступна. Попробуйте ещё раз.'); return env.DB; }
function entity(row: any): Entity { return { id: row.id, kind: row.kind, data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at }; }
export async function readEntity(owner: string, id: string): Promise<Entity | null> { const row = await db().prepare('SELECT * FROM planner_entities WHERE owner=? AND id=?').bind(owner,id).first(); return row ? entity(row) : null; }
export async function snapshot(owner: string): Promise<Entity[]> {
  const at=new Date().toISOString();
  await db().batch([...(owner.startsWith('space:')?[{id:'general',name:'Общее',color:defaultProjects[0].color,deletedAt:null}]:defaultProjects).map(p => db().prepare("INSERT OR IGNORE INTO planner_entities(owner,id,kind,data,version,updated_at,last_op) VALUES(?,?,'project',?,1,?,'initial')").bind(owner,p.id,JSON.stringify(p),at)), db().prepare("INSERT OR IGNORE INTO planner_entities(owner,id,kind,data,version,updated_at,last_op) VALUES(?,'preferences','settings',?,1,?,'initial')").bind(owner,JSON.stringify(defaultPreferences),at)]);
  const rows = await db().prepare('SELECT * FROM planner_entities WHERE owner=?').bind(owner).all();
  return rows.results.map(entity);
}
export async function applyMutation(owner: string, op: Mutation, options:{skipRepeat?:boolean}={}): Promise<{ accepted: boolean; conflict?: Conflict }> {
  if (await db().prepare('SELECT op_id FROM planner_receipts WHERE owner=? AND op_id=?').bind(owner,op.opId).first()) return { accepted: true };
  const current=await readEntity(owner,op.id), before=current?.data as any || {};
  if (current && current.kind !== op.kind) throw new Error('Нельзя изменить тип записи.');
  const fields = current && current.version !== op.baseVersion ? Object.keys(op.changes).filter(k => JSON.stringify(before[k]) !== JSON.stringify(op.before[k]) && JSON.stringify(before[k]) !== JSON.stringify(op.changes[k])) : [];
  if (fields.length || (!current && op.baseVersion > 0)) return { accepted: false, conflict: { opId: op.opId, id: op.id, fields: fields.length ? fields : ['record'], current } };
  const schema=op.kind==='task'?taskSchema:op.kind==='project'?projectSchema:settingsSchema;
  const after=schema.parse({ ...before, ...op.changes, id: op.id });
  if (op.kind==='task' && (after as Task).projectId) { const project=await readEntity(owner,(after as Task).projectId!); if (!project || project.kind!=='project' || (project.data as any).deletedAt) throw new Error('Выберите существующий проект.'); }
  if(op.kind==='task'&&'assigneeIds' in op.changes){const ids=(after as Task).assigneeIds;const allowed=owner.startsWith('space:')?(await db().prepare('SELECT user_id FROM planner_members WHERE space_id=?').bind(owner.slice(6)).all()).results.map((m:any)=>m.user_id):[owner];if(ids.some(id=>!allowed.includes(id)))throw new Error('Назначить дело можно только участнику этого пространства.');}
  if(op.kind==='task'&&(after as Task).attachments.some(a=>!a.key.startsWith(encodeURIComponent(owner)+'/')))throw new Error('Вложение относится к другому пространству.');
  const at=new Date().toISOString(), version=(current?.version||0)+1, afterJson=JSON.stringify(after);
  const write=current ? db().prepare('UPDATE planner_entities SET data=?,version=?,updated_at=?,last_op=? WHERE owner=? AND id=? AND version=?').bind(afterJson,version,at,op.opId,owner,op.id,current.version) : db().prepare('INSERT OR IGNORE INTO planner_entities(owner,id,kind,data,version,updated_at,last_op) VALUES(?,?,?,?,1,?,?)').bind(owner,op.id,op.kind,afterJson,at,op.opId);
  const results=await db().batch([write, db().prepare('INSERT OR IGNORE INTO planner_history(id,owner,entity_id,kind,before_data,after_data,at,source) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM planner_entities WHERE owner=? AND id=? AND last_op=?)').bind(op.opId,owner,op.id,op.kind,current?JSON.stringify(current.data):null,afterJson,at,op.source,owner,op.id,op.opId), db().prepare('INSERT OR IGNORE INTO planner_receipts(owner,op_id,at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM planner_entities WHERE owner=? AND id=? AND last_op=?)').bind(owner,op.opId,at,owner,op.id,op.opId)]);
  if (!results[0].meta.changes) return { accepted: false, conflict: { opId:op.opId,id:op.id,fields:Object.keys(op.changes),current:await readEntity(owner,op.id) } };
  if (!options.skipRepeat && op.kind==='task' && (after as Task).status==='done' && before.status!=='done') {
    const next=nextTask(after as Task,dateKey());
    if (next && !await readEntity(owner,next.id)) await applyMutation(owner,{opId:crypto.randomUUID(),id:next.id,kind:'task',changes:next as any,before:{},baseVersion:0,source:op.source});
  }
  return {accepted:true};
}
export async function taskHistory(owner:string,id:string) { const r=await db().prepare('SELECT * FROM planner_history WHERE owner=? AND entity_id=? ORDER BY at DESC LIMIT 100').bind(owner,id).all(); return r.results.map((x:any)=>({id:x.id,at:x.at,source:x.source,before:x.before_data?JSON.parse(x.before_data):null,after:JSON.parse(x.after_data)})); }
export async function restoreChange(owner:string,entityId:string,historyId:string) {
  const row:any=await db().prepare('SELECT * FROM planner_history WHERE owner=? AND entity_id=? AND id=?').bind(owner,entityId,historyId).first();
  if(!row)throw new Error('Изменение не найдено.');
  const current=await readEntity(owner,entityId);if(!current)throw new Error('Задача не найдена.');
  const previous=row.before_data?JSON.parse(row.before_data):null, recorded=JSON.parse(row.after_data), data=current.data as any;
  if(!previous)throw new Error('Это создание задачи. Для отмены переместите её в корзину.');
  const changes:Record<string,unknown>={},before:Record<string,unknown>={};
  for(const key of Object.keys(previous))if(key!=='id' && key!=='createdAt' && JSON.stringify(previous[key])!==JSON.stringify(recorded[key])){
    if(JSON.stringify(data[key])!==JSON.stringify(recorded[key]))throw new Error('Это поле уже изменилось позже. Откройте задачу и выберите нужное значение.');
    changes[key]=previous[key];before[key]=data[key];
  }
  return applyMutation(owner,{opId:crypto.randomUUID(),id:entityId,kind:current.kind,changes,before,baseVersion:current.version,source:'restore'});
}
