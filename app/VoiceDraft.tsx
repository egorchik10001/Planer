import type {Project} from '../lib/planner';

export type DraftFields = {
  title: string;
  notes: string;
  projectId: string | null;
  date: string | null;
  time: string | null;
  dueDate: string | null;
};

export default function VoiceDraft({task, projects, onChange}: {
  task: DraftFields;
  projects: Project[];
  onChange: (changes: Partial<DraftFields>) => void;
}) {
  return <details className="voice-draft">
    <summary>Поправить дело</summary>
    <div className="voice-draft-fields">
      <label>Название<input value={task.title} maxLength={300} onChange={e => onChange({title: e.target.value})}/></label>
      <label>Проект<select value={task.projectId ?? ''} onChange={e => onChange({projectId: e.target.value || null})}>
        <option value="">Входящие</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select></label>
      <div className="form-grid">
        <label>День<input type="date" value={task.date ?? ''} onChange={e => onChange({date: e.target.value || null})}/></label>
        <label>Время<input type="time" value={task.time ?? ''} onChange={e => onChange({time: e.target.value || null})}/></label>
      </div>
      <label>Крайний срок<input type="date" value={task.dueDate ?? ''} onChange={e => onChange({dueDate: e.target.value || null})}/></label>
      <label>Заметка<textarea rows={2} value={task.notes} maxLength={5000} onChange={e => onChange({notes: e.target.value})}/></label>
    </div>
  </details>;
}
