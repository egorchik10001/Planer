import {useEffect,useState} from 'react';
export default function DesktopSettings(){
 const native=window.plannerDesktop;
 const [url,setURL]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[key,setKey]=useState(''),[voice,setVoice]=useState(false),[keyBusy,setKeyBusy]=useState(false),[keyMessage,setKeyMessage]=useState(''),[repository,setRepository]=useState(''),[updates,setUpdates]=useState(false),[version,setVersion]=useState('');
 useEffect(()=>{native.connection().then(d=>{setURL(d.url||'');setVoice(d.voice);setRepository(d.repository);setUpdates(d.updates);setVersion(d.version);}).catch(()=>setError('Не удалось прочитать настройки.'));if(location.hash==='#voice')document.getElementById('voice')?.scrollIntoView();},[]);
 return <main className="mac-connection">
  <p className="mac-eyebrow">ПЛАНЕР ДЛЯ MAC</p><h1>Твои дела.<br/>На твоих устройствах.</h1>
  <p className="mac-intro">Планер работает на этом Mac без регистрации и хостинга. Здесь можно подключить умный голос и синхронизацию.</p>
  <section className="mac-local-card"><span className="mac-dot"/><div><h2>На этом Mac</h2><p>Задачи сохраняются на компьютере.</p></div><button className="button primary" onClick={()=>void native.openLocal()}>Открыть план</button></section>
  <form id="voice" onSubmit={async e=>{
   e.preventDefault();setKeyBusy(true);setKeyMessage('');try{await native.saveVoiceKey(key);setKey('');setVoice(true);setKeyMessage('Ключ сохранён. Открой план и запиши дело голосом.');}catch{setKeyMessage('Не удалось сохранить ключ. Проверь его и доступ к Связке ключей Mac.');}finally{setKeyBusy(false);}
  }}>
   <h2>Умный голос</h2><p className="hint">{voice?'API-ключ сохранён в Связке ключей Mac.':'Подключи свой API-ключ OpenAI: речь превратится в короткие задачи с проектами и датами.'}</p>
   <p className="notice">При нажатии «Разобрать» запись и контекст плана отправятся в OpenAI. Используется лимит твоего API-аккаунта. Ключ хранится в Связке ключей Mac и не входит в исходники или копию плана.</p>
   <label htmlFor="voice-key">{voice?'Заменить API-ключ':'API-ключ OpenAI'}<input id="voice-key" type="password" autoComplete="off" placeholder="sk-…" value={key} onChange={e=>setKey(e.target.value)} minLength={20} maxLength={1024} required/></label>
   <div className="button-row"><button className="button secondary" disabled={keyBusy||key.length<20}>{keyBusy?'Сохраняю…':'Сохранить ключ'}</button>{voice&&<button className="text-action danger" type="button" onClick={async()=>{try{await native.removeVoiceKey();setVoice(false);setKeyMessage('Ключ удалён. Голосовые заметки остались на Mac.');}catch{setKeyMessage('Не удалось удалить ключ из Связки ключей.');}}}>Отключить</button>}</div>
   {keyMessage&&<p role="status" className="hint">{keyMessage}</p>}
  </form>
  <section className="mac-updates"><h2>Обновления · {version}</h2><p className="hint">Новые версии поступают из <a href={'https://github.com/'+repository+'/releases'} target="_blank" rel="noreferrer">{repository}</a>. Подпись проверяется перед установкой. Твои задачи остаются на Mac.</p><button className="button secondary" disabled={!updates} onClick={()=>void native.checkUpdates()}>Проверить обновления</button>{!updates&&<p className="hint">Доступно в установленной Mac-версии.</p>}</section>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await native.connect(url);if(r?.error)setError(r.error);}catch{setError('Не удалось подключить сервер.');}finally{setBusy(false);}}}>
   <h2>Синхронизация</h2><p className="hint">Нужен адрес самостоятельного сервера планера. Затем войди в один аккаунт на всех устройствах.</p>
   <label htmlFor="server-url">Адрес сервера<input id="server-url" type="url" required placeholder="https://planner.example.com" value={url} onChange={e=>setURL(e.target.value)} autoCapitalize="none" spellCheck={false}/></label>
   <p className="hint">Локальный и серверный планы хранятся отдельно. Чтобы перенести задачи, скачай копию в настройках локального плана и импортируй её в свой аккаунт на сервере.</p>
   {error&&<p role="alert" className="error-message">{error}</p>}<button className="button secondary" type="submit" disabled={busy}>{busy?'Подключаю…':'Подключить сервер'}</button>
  </form>
  <p className="mac-footnote">GitHub хранит исходники и версии приложения. Синхронизация задач работает через подключённый сервер.</p>
 </main>;
}
