import {useEffect,useState} from 'react';
import {ArrowLeft,Check,Download,LoaderCircle,Pause} from 'lucide-react';
import {installBackGesture} from '../../lib/back-gesture';
export type LocalVoiceStatus={ready:boolean;stage:string;error:string;current:string;downloaded:number;total:number;percent:number;models:{id:string;name:string;bytes:number;ready:boolean}[]};
const missing:LocalVoiceStatus={ready:false,stage:'missing',error:'',current:'',downloaded:0,total:2687366607,percent:0,models:[]};
export default function DesktopSettings(){
 const native=window.plannerDesktop;
 const [url,setURL]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[voice,setVoice]=useState<LocalVoiceStatus>(missing),[repository,setRepository]=useState(''),[updates,setUpdates]=useState(false),[version,setVersion]=useState('');
 const [platform,setPlatform]=useState('');
 const loading=voice.stage==='downloading'||voice.stage==='checking',gb=(n:number)=>(n/1e9).toFixed(2)+' ГБ';
 useEffect(()=>{
  let active=true;native.connection().then(d=>{if(!active)return;setURL(d.url||'');setRepository(d.repository);setUpdates(d.updates);setVersion(d.version);setPlatform(d.platform);}).catch(()=>{if(active)setError('Не удалось прочитать настройки.');});
  const refresh=()=>native.localVoiceStatus().then(s=>{if(active)setVoice(s);}).catch(()=>{});void refresh();const poll=setInterval(refresh,1000);
  const stop=installBackGesture(window,()=>void native.goBack());if(location.hash==='#voice')document.getElementById('voice')?.scrollIntoView();
  return()=>{active=false;clearInterval(poll);stop();};
 },[]);
 return <>
 <header className="desktop-settings-header"><button className="desktop-back" data-app-back onClick={()=>void native.goBack()}><ArrowLeft size={20}/><span>Назад в планер</span></button><span>Настройки</span></header>
 <main className="mac-connection">
  <h1>Настройки планера</h1>
  <section id="voice" className="mac-voice-section">
   <div className="section-line"><h2>Локальный голос</h2>{voice.ready&&<span className="voice-ready"><Check size={17}/> Готов</span>}</div>
   <p className="hint">Речь распознаётся через Whisper, а короткие задачи собирает локальная модель. Записи остаются на компьютере. ChatGPT, API-ключ и подписка для этого не нужны.</p>
   {platform==='win32'&&<p className="hint">Для локального разбора голоса нужен процессор с AVX2 и желательно от 8 ГБ оперативной памяти.</p>}
   {!voice.ready&&<p className="notice">Один раз скачай модели — около 2,7 ГБ. После этого можно разбирать голос без интернета. Загрузка продолжится с места остановки.</p>}
   {(loading||voice.downloaded>0)&&!voice.ready&&<div className="model-progress" role="status"><div className="section-line"><span>{voice.stage==='checking'?'Проверяю файлы':voice.current||'Подготовка голоса'}</span><span>{voice.percent}%</span></div><progress max={100} value={voice.percent}/><p className="hint">{gb(voice.downloaded)} из {gb(voice.total)}</p></div>}
   {voice.ready?<p className="notice">Всё готово. Запиши дела и нажми «Остановить». Проверь предложенные задачи и поправь их перед добавлением.</p>:<div className="button-row"><button className="button primary" disabled={loading} onClick={async()=>{try{setVoice(await native.prepareLocalVoice());}catch{setError('Не удалось начать загрузку. Проверь подключение к интернету.');}}}>{loading?<LoaderCircle className="spin" size={18}/>:<Download size={18}/>} {loading?'Подготавливаю…':voice.stage==='paused'?'Продолжить загрузку':voice.stage==='error'?'Повторить загрузку':'Подготовить голос'}</button>{voice.stage==='downloading'&&<button className="button secondary" onClick={()=>void native.pauseLocalVoice()}><Pause size={17}/> Пауза</button>}</div>}
   {voice.error&&<p className="error-message" role="status">{voice.error}</p>}
   <p className="hint">Движки: <a href="https://github.com/ggml-org/whisper.cpp" target="_blank" rel="noreferrer">whisper.cpp</a> и <a href="https://github.com/ggml-org/llama.cpp" target="_blank" rel="noreferrer">llama.cpp</a>. Модели хранятся отдельно от приложения и сохраняются при обновлении.</p>
  </section>
  <section className="mac-updates"><h2>Обновления · {version}</h2>
   {platform==='win32'?<>
    <p className="hint">Скачай новый установщик с GitHub и запусти его поверх текущей версии. Твои задачи хранятся отдельно от приложения.</p>
    <button className="button secondary" onClick={()=>void native.checkUpdates()}>Скачать новую версию Windows</button>
   </>:<>
    <p className="hint">Новые версии поступают из <a href={'https://github.com/'+repository+'/releases'} target="_blank" rel="noreferrer">{repository}</a>. Подпись проверяется перед установкой. Твои задачи остаются на Mac.</p>
    <button className="button secondary" disabled={!updates} onClick={()=>void native.checkUpdates()}>Проверить обновления</button>
    {!updates&&<p className="hint">Доступно в установленной Mac-версии.</p>}
   </>}
  </section>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await native.connect(url);if(r?.error)setError(r.error);}catch{setError('Не удалось подключить сервер.');}finally{setBusy(false);}}}>
   <h2>Синхронизация</h2><p className="hint">Нужен адрес самостоятельного сервера планера. Затем войди в один аккаунт на всех устройствах.</p>
   <label htmlFor="server-url">Адрес сервера<input id="server-url" type="url" required placeholder="https://planner.example.com" value={url} onChange={e=>setURL(e.target.value)} autoCapitalize="none" spellCheck={false}/></label>
   <p className="hint">Локальный и серверный планы хранятся отдельно. Чтобы перенести задачи, скачай копию в настройках локального плана и импортируй её в свой аккаунт на сервере.</p>
   {error&&<p role="alert" className="error-message">{error}</p>}<button className="button secondary" type="submit" disabled={busy}>{busy?'Подключаю…':'Подключить сервер'}</button>
  </form>
  <p className="mac-footnote">GitHub хранит исходники и версии приложения. Синхронизация задач работает через подключённый сервер.</p>
 </main></>;
}
