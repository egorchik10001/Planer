export type Status = 'todo' | 'doing' | 'waiting' | 'done';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type Project = { id: string; name: string; color: string; deletedAt: string | null };
export type Subtask = { id: string; title: string; done: boolean };
export type Attachment = { key: string; name: string; type: string };
export type Task = {
  id: string; assigneeIds:string[]; title: string; notes: string; projectId: string | null; status: Status;
  date: string | null; time: string | null; dueDate: string | null;
  duration: number | null; important: boolean; starred: boolean; order: number;
  reminderAt: string | null; reminderEvery: number | null; waitingUntil: string | null;
  repeat: Repeat; seriesId: string | null; subtasks: Subtask[]; attachments: Attachment[];
  sourceText: string; createdAt: string; completedAt: string | null; deletedAt: string | null;
};
export type Preferences = { id: string; timezone: string; quietStart: string; quietEnd: string; dayMinutes: number; notifications: boolean };
export type Entity = { id: string; kind: 'task' | 'project' | 'settings'; data: Task | Project | Preferences; version: number; updatedAt: string };
export type Mutation = { opId: string; id: string; kind: Entity['kind']; changes: Record<string, unknown>; before: Record<string, unknown>; baseVersion: number; source: string };
export type Conflict = { opId: string; id: string; fields: string[]; current: Entity | null };
export const COLORS = ['#c3b5d5', '#e8bf7b', '#adc7c7', '#c9d3aa', '#d5acb1'];
export const STATUS: Record<Status, string> = { todo: 'Нужно сделать', doing: 'В процессе', waiting: 'Жду ответа', done: 'Выполнено' };
export const defaultProjects: Project[] = [
  { id: 'site', name: 'Сайт', color: COLORS[0], deletedAt: null },
  { id: 'personal', name: 'Личное', color: COLORS[1], deletedAt: null },
  { id: 'home', name: 'Дом', color: COLORS[2], deletedAt: null },
];
export const defaultPreferences: Preferences = { id: 'preferences', timezone: 'Asia/Novosibirsk', quietStart: '22:00', quietEnd: '08:00', dayMinutes: 480, notifications: false };
export function dateKey(d = new Date(), timezone = 'Asia/Novosibirsk') { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
export function addDays(value: string, days: number) { const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function weekDays(value: string) { const d = new Date(value + 'T12:00:00Z'); const start = addDays(value, -(d.getUTCDay() + 6) % 7); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
export function compareTasks(a: Task, b: Task) { return (a.time || '99:99').localeCompare(b.time || '99:99') || a.order - b.order || a.createdAt.localeCompare(b.createdAt); }
export function makeTask(title: string, patch: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), assigneeIds:[], title: title.trim(), notes: '', projectId: null, status: 'todo', date: null, time: null, dueDate: null, duration: null, important: false, starred: false, order: Date.now(), reminderAt: null, reminderEvery: null, waitingUntil: null, repeat: 'none', seriesId: null, subtasks: [], attachments: [], sourceText: '', createdAt: new Date().toISOString(), completedAt: null, deletedAt: null, ...patch };
}
export function nextDate(value: string, repeat: Repeat) {
  if (repeat === 'monthly') { const d = new Date(value + 'T12:00:00Z'), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, end)); return d.toISOString().slice(0, 10); }
  return addDays(value, repeat === 'weekly' ? 7 : 1);
}
export function nextTask(task: Task, today: string): Task | null {
  if (task.repeat === 'none') return null;
  let date = nextDate(task.date || today, task.repeat);
  for (let i = 0; date <= today && i < 3660; i++) date = nextDate(date, task.repeat);
  const seriesId = task.seriesId || task.id;
  return { ...task, id: seriesId + '@' + date, seriesId, date, dueDate: null, status: 'todo', completedAt: null, deletedAt: null, starred: false, reminderAt: null, createdAt: new Date().toISOString(), subtasks: task.subtasks.map(s => ({ ...s, done: false })) };
}
export function conflicts(tasks: Task[]) {
  const timed = tasks.filter(t => !t.deletedAt && t.status !== 'done' && t.time && t.duration).sort(compareTasks);
  const result: [Task, Task][] = [];
  const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) if (timed[i].date === timed[j].date && mins(timed[i].time!) + timed[i].duration! > mins(timed[j].time!)) result.push([timed[i], timed[j]]);
  return result;
}
export function formatDay(value: string, options: Intl.DateTimeFormatOptions = {}) { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC', ...options }).format(new Date(value + 'T12:00:00Z')); }
export function quietNow(prefs: Preferences, now = new Date()) {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: prefs.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return prefs.quietStart === prefs.quietEnd ? false : prefs.quietStart > prefs.quietEnd ? time >= prefs.quietStart || time < prefs.quietEnd : time >= prefs.quietStart && time < prefs.quietEnd;
}
export function demoTasks(today: string): Task[] {
  const p = { date: today };
  return [makeTask('Забрать документы', { ...p, time: '08:30', projectId: 'personal' }), makeTask('Позвонить в сервис по ноутбуку', { ...p, time: '10:00', projectId: 'personal', notes: 'Уточнить, готов ли ноутбук и когда можно забрать.', duration: 15 }), makeTask('Доделать шапку сайта', { ...p, time: '13:00', projectId: 'site', duration: 60, status: 'doing', subtasks: [{ id: crypto.randomUUID(), title: 'Проверить мобильную версию', done: false }] }), makeTask('Отправить макет клиенту', { ...p, time: '15:30', projectId: 'site', dueDate: addDays(today, 1), starred: true }), makeTask('Заказать продукты', { ...p, time: '18:00', projectId: 'home' }), makeTask('Купить кофе', { ...p, projectId: 'home' }), makeTask('Забрать посылку', { date: addDays(today, 1), time: '11:00', projectId: 'personal' }), makeTask('Разобрать фотографии', { projectId: 'personal' })];
}

export function formatTaskCount(n:number){const last=n%10,ending=n%100;return `${n} ${ending>=11&&ending<=14?'дел':last===1?'дело':last>=2&&last<=4?'дела':'дел'}`;}
