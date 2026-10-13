'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {followMember,displayBadge} from '@/app/me/actions';
export function FollowButton({id,following}:{id:string;following:boolean}){
 const [pending,start]=useTransition();const [error,setError]=useState('');const router=useRouter();
 return <div><button className="pill-button" disabled={pending} onClick={()=>start(async()=>{try {const result=await followMember(id,!following);setError(result.error??'');if(!result.error)router.refresh();}catch{setError('Could not save your follow. Please retry.');}})}>{pending?'Saving…':following?'Following ✓':'Follow +'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
export function BadgeToggle({id,displayed}:{id:string;displayed:boolean}){
 const [pending,start]=useTransition();const [error,setError]=useState('');const router=useRouter();
 return <div><label className="badge-toggle"><input type="checkbox" checked={displayed} disabled={pending} onChange={e=>{const value=e.target.checked;start(async()=>{try{const result=await displayBadge(id,value);setError(result.error??'');if(!result.error)router.refresh();}catch{setError('Could not save your badge. Please retry.');}});}}/>Show on profile</label>{error&&<p role="alert">{error}</p>}</div>;
}
