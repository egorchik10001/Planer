import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft} from 'lucide-react';
import Planner from '../../app/Planner';
import {LOCAL_USER} from '../../lib/local-plan';
import '../../app/globals.css';
import './ios.css';
import {installLocalRequests} from './runtime';
import {native,setUpNativeBridge} from './device-bridge';

type VoiceStatus={stage:string;description:string;percent:number};

function Settings({onBack,section}:{onBack:()=>void;section:'voice'|'server'}) {
  const [address,setAddress]=useState('');
  const [error,setError]=useState('');
  const [voice,setVoice]=useState<VoiceStatus>();
  useEffect(()=>{
    let active=true;
    const update=()=>native<VoiceStatus>('voiceStatus').then(value=>{if(active)setVoice(value);}).catch(()=>{});
    void update();
    void native<string|null>('serverAddress').then(value=>{if(active)setAddress(value??'');}).catch(()=>{});
    const timer=setInterval(update,900);
    return ()=>{active=false;clearInterval(timer);};
  },[]);
  async function openServer(e:React.FormEvent){
    e.preventDefault();setError('');
    try{await native('openServer',{address:address.trim()});}
    catch(e){setError(e instanceof Error?e.message:'Не удалось открыть сервер.');}
  }
  return <section className="ios-settings">
    <header><button className="text-action" onClick={onBack}><ArrowLeft size={18}/> Назад в планер</button></header>
    <h1>Настройки планера</h1>
    {section==='server'&&<form onSubmit={openServer}>
      <h2>Синхронизация</h2>
      <p>Введи HTTPS-адрес своего сервера и войди в тот же аккаунт, что на компьютере. Чтобы перенести локальные задачи, сначала сохрани копию плана в «Файлы».</p>
      <label>Адрес сервера<input type="url" required value={address} onChange={e=>setAddress(e.target.value)} placeholder="https://planer.example.com" inputMode="url" autoCapitalize="none" spellCheck={false}/></label>
      <button type="submit" className="button primary">Открыть сервер</button>
    </form>}
    <section>
      <h2>Локальный голос</h2>
      <p>{voice?.description??'Проверяю модели…'}</p>
      {voice?.stage==='downloading'&&<progress max={100} value={voice.percent} aria-label="Подготовка голоса"/>}
      {voice?.stage==='downloading'&&<button type="button" className="button secondary" onClick={()=>void native('pauseVoice').catch(()=>{})}>Пауза</button>}
      {voice&&!['ready','downloading','unavailable','verifying'].includes(voice.stage)&&<button type="button" className="button primary" onClick={()=>void native('prepareVoice').catch(e=>setError(e.message))}>{voice.stage==='paused'?'Продолжить загрузку':'Подготовить голос'}</button>}
    </section>
    {error&&<p className="error-message" role="alert">{error}</p>}
  </section>;
}

function App({recovered}:{recovered:boolean}){
  const [section,setSection]=useState<'voice'|'server'|null>(location.hash==='#voice'?'voice':null);
  useEffect(()=>{const open=()=>setSection('voice');window.addEventListener('planner:voice-settings',open);return ()=>window.removeEventListener('planner:voice-settings',open);},[]);
  return section?<Settings section={section} onBack={()=>setSection(null)}/>:<>
    {recovered&&<p className="ios-recovery" role="status">Загружена предыдущая копия плана.</p>}
    <Planner owner={LOCAL_USER+':'+LOCAL_USER} currentUserId={LOCAL_USER} email="Личный план на iPhone" spaces={[]} spaceId={null} localMode onConnect={()=>setSection('server')} onVoiceSettings={()=>setSection('voice')}/>
  </>;
}

const node=document.getElementById('root');
if(!node)throw Error('Нет контейнера приложения.');
const root=createRoot(node);
try{
  setUpNativeBridge();
  installLocalRequests().then(recovered=>root.render(<App recovered={recovered}/>)).catch(showStartupError);
}catch(error){showStartupError(error);}

function showStartupError(error:unknown){
  root.render(<main className="ios-settings"><h1>Не удалось открыть план</h1><p>{error instanceof Error?error.message:'Попробуй открыть приложение заново.'}</p><button type="button" className="button primary" onClick={()=>location.reload()}>Повторить</button></main>);
}
