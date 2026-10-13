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
    if(result.error){setError('Could not save your notification. Please try again.');return;}
    setDismissed(ids=>[...ids,id]);
   } catch {setError('Could not save your notification. Please try again.');}
  });
 }
 if(!mounted||!badge)return null;
 return createPortal(<dialog ref={dialog} className="badge-unlock-panel" aria-labelledby="badge-unlock-title" aria-describedby="badge-unlock-condition" onCancel={event=>{event.preventDefault();dismiss();}}>
  <button type="button" className="badge-unlock-close share-close" aria-label="Close badge notification" disabled={pending} onClick={dismiss}><Icon name="close"/></button>
  <span className="badge-unlock-medal"><Icon name="award"/></span>
  <h2 id="badge-unlock-title">You earned a new badge!</h2>
  <strong className="badge-unlock-name">{badge.name}</strong>
  <p id="badge-unlock-condition"><span>Earned by</span>{badge.description}</p>
  {remaining>1&&<p className="badge-unlock-more">{remaining-1} more {remaining===2?'badge':'badges'} to celebrate</p>}
  {error&&<p className="badge-unlock-error" role="alert">{error}</p>}
  <button type="button" className="pill-button" disabled={pending} onClick={dismiss}>{pending?'Saving…':remaining>1?'Next badge':'Got it'}</button>
 </dialog>,document.body);
}
