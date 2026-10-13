'use client';

import {createPortal} from 'react-dom';
import {useEffect,useRef,useState,useSyncExternalStore,useTransition} from 'react';
import {acknowledgeBadge} from '@/app/me/actions';
import Icon from './ui-icon';

type NewBadge = {id:string;name:string;description:string};
const subscribe = () => () => {};

export default function BadgeUnlockPanel({badges}:{badges:NewBadge[]}) {
 const mounted=useSyncExternalStore(subscribe,()=>true,()=>false);
 const [dismissed,setDismissed]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [pending,start]=useTransition();
 const dialog=useRef<HTMLDialogElement>(null);
 const badge=badges.find(b=>!dismissed.includes(b.id));
 const remaining=badges.filter(b=>!dismissed.includes(b.id)).length;
 useEffect(()=>{
  if(!mounted||!badge)return;
  const panel=dialog.current;
  const previous=document.activeElement;
  panel?.showModal();
  return ()=>{panel?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[mounted,badge]);
 function dismiss() {
  if(!badge||pending)return;
  const id=badge.id;
  setError('');
  start(async()=>{
   try {
    const result=await acknowledgeBadge(id);
    if(result.error){setError('暂时无法保存，请再试一次。');return;}
    setDismissed(ids=>[...ids,id]);
   } catch {setError('暂时无法保存，请再试一次。');}
  });
 }
 if(!mounted||!badge)return null;
 return createPortal(<dialog ref={dialog} className="badge-unlock-panel" aria-labelledby="badge-unlock-title" aria-describedby="badge-unlock-condition" onCancel={event=>{event.preventDefault();dismiss();}}>
  <button type="button" className="badge-unlock-close share-close" aria-label="关闭徽章通知" disabled={pending} onClick={dismiss}><Icon name="close"/></button>
  <span className="badge-unlock-medal"><Icon name="award"/></span>
  <h2 id="badge-unlock-title">你新获得了一个徽章</h2>
  <strong className="badge-unlock-name">{badge.name}</strong>
  <p id="badge-unlock-condition"><span>获得条件</span>{badge.description}</p>
  {remaining>1&&<p className="badge-unlock-more">还有 {remaining-1} 枚新徽章</p>}
  {error&&<p className="badge-unlock-error" role="alert">{error}</p>}
  <button type="button" className="pill-button" disabled={pending} onClick={dismiss}>{pending?'保存中…':remaining>1?'查看下一枚':'知道了'}</button>
 </dialog>,document.body);
}
