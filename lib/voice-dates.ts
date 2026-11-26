import {addDays} from './planner';

const weekdays = ['воскресень', 'понедельник', 'вторник', 'сред', 'четверг', 'пятниц', 'суббот'];
const weekdayPattern = '(?:воскресень[еяю]|понедельник(?:у|а)?|вторник(?:у|а)?|сред[аеуы]|четверг(?:у|а)?|пятниц[аеуы]|суббот[аеуы])';
const dateWord = '(?:сегодня|завтра|послезавтра|' + weekdayPattern + ')';
const namedDate = new RegExp('(?<![а-яё])(?:(к|до|на|в|во)\\s+)?(' + dateWord + ')(?![а-яё])', 'giu');
const modifiers = /следующ|прошл|предыдущ|кажд|через|после\s|раньше|позже|перед\s|кроме|либо|\sили\s|не\s+(?:к|до|на|в)\s|\d{1,2}[./-]\d{1,2}|\d+\s+(?:январ|феврал|марта|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр)/i;

function calendarDay(word: string, today: string) {
  if (word === 'сегодня') return today;
  if (word === 'завтра') return addDays(today, 1);
  if (word === 'послезавтра') return addDays(today, 2);
  const weekday = weekdays.findIndex(stem => word.startsWith(stem));
  const current = new Date(today + 'T12:00:00Z').getUTCDay();
  return addDays(today, (weekday - current + 7) % 7);
}

type Proposal = {title: string; date: string | null; dueDate: string | null};
export function groundSpokenDates(text: string, tasks: Proposal[], today: string) {
  const clauses = text.toLowerCase().split(/[!?;\n]+|[.,](?=\s|$)|\s+(?:а ещё|и ещё|а потом)\s+/u)
    .map(part => part.trim()).filter(Boolean);
  const matches = tasks.map(task => {
    const words = task.title.toLowerCase().match(/[а-яёa-z]{3,}/gu) ?? [];
    const scores = clauses.map(clause => words.filter(word => clause.includes(word)).length);
    const best = Math.max(...scores);
    return best > 0 && scores.filter(score => score === best).length === 1 ? scores.indexOf(best) : -1;
  });
  for (const [index, task] of tasks.entries()) {
    const match = matches[index];
    if (match < 0 || matches.filter(other => other === match).length !== 1) continue;
    const clause = clauses[match];
    if (modifiers.test(clause)) continue;
    const dates = [...clause.matchAll(namedDate)];
    const deadlines = dates.filter(match => match[1] === 'к' || match[1] === 'до');
    const planned = dates.filter(match => !deadlines.includes(match));
    if (deadlines.length === 1) {
      task.dueDate = calendarDay(deadlines[0][2], today);
      if (!planned.length && !/\d|недел|месяц/.test(clause.replace(deadlines[0][0], ''))) task.date = null;
    }
    if (planned.length === 1) task.date = calendarDay(planned[0][2], today);
  }
}
