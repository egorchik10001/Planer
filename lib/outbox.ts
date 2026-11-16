import type { Mutation } from './planner';
type StorageLike=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
export function outboxPrefix(owner:string){return 'planner-outbox:'+owner+':';}
export function readOutbox(storage:StorageLike,owner:string):Mutation[]{
 const prefix=outboxPrefix(owner),records:{operation:Mutation;at:number}[]=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;try{const record=JSON.parse(storage.getItem(key)||'null');if(record?.operation?.opId)records.push(record);}catch{}}
 return records.sort((a,b)=>a.at-b.at).map(r=>r.operation);
}
export function appendOutbox(storage:StorageLike,owner:string,operation:Mutation){storage.setItem(outboxPrefix(owner)+operation.opId,JSON.stringify({operation,at:Date.now()}));}
export function removeOutbox(storage:StorageLike,owner:string,ids:string[]){for(const id of ids)storage.removeItem(outboxPrefix(owner)+id);}
