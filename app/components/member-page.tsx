import Image from 'next/image';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {getMember,achievements} from '@/lib/community';
import {withPostAuthors} from '@/lib/post-authors';
import {UUID,getCredits} from '@/lib/challenge';
import type {ExploreCaption} from '@/lib/explore';
import SiteFrame from './site-frame';
import ExploreGallery from '../explore/explore-gallery';
import Icon from './ui-icon';
import {FollowButton,BadgeToggle} from './member-controls';
export default async function MemberPage({id,connections}:{id?:string;connections?:string}){
 const client=await createClient();const {data:auth}=await client.auth.getUser();const user=auth.user&&!auth.user.is_anonymous?auth.user:null;
 if(!user)redirect('/login');const target=id??user!.id;if(!UUID.test(target))notFound();
 const own=user?.id===target;const member=await getMember(client,target);if(!member)notFound();
 const {data:profile}=user?await client.from('profiles').select('first_name,last_name,avatar_url,nickname').eq('id',user.id).maybeSingle():{data:null};
 const captions:ExploreCaption[]=[];
 for(let start=0;;start+=500){const {data,error}=await client.from('captions').select('id,caption,image_url,image_alt,image_description,created_at,created_by,like_count,challenge_id').eq('created_by',target).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+499);if(error)throw new Error('Could not load these posts.');captions.push(...(data??[]).map(p=>({...p,like_count:Number(p.like_count),ownVote:null})));if(!data||data.length<500)break;}
 const votes=new Map<number,1|-1>();let votesFailed=false;
 if(user)for(let start=0;;start+=500){const {data,error}=await client.from('caption_votes').select('id,caption_id,vote').eq('user_id',user.id).order('id').range(start,start+499);if(error){votesFailed=true;break;}for(const v of data??[])if(v.vote===1||v.vote===-1)votes.set(v.caption_id,v.vote);if(!data||data.length<500)break;}
 const {data:closed}=await client.from('weekly_challenges').select('id').lte('ends_at',new Date().toISOString());const closedIds=new Set((closed??[]).map(c=>c.id));
 const posts=await withPostAuthors(client,captions.map(p=>({...p,ownVote:votes.get(p.id)??null,votingClosed:Boolean(p.challenge_id&&closedIds.has(p.challenge_id))})));
 const credits=own?await getCredits(client):null;
 const kind=own&&(connections==='following'||connections==='followers')?connections:null;
 const {data:people,error:listError}=kind?await client.rpc('my_member_connections',{p_kind:kind}):{data:[],error:null};
 return <SiteFrame active={!user?'login':own?'me':'member'} profile={profile}><div className="member-content">
 <section className="member-header details-card"><div className="member-identity"><span className="member-avatar">{member.avatar_url?<Image src={member.avatar_url} alt={`${member.nickname}'s avatar`} width={80} height={80} unoptimized/>:<Icon name="user"/>}</span><div><span className="eyebrow">{own?'MY CORNER':'CAPTION CLUB MEMBER'}</span><h1>{member.nickname}</h1></div>{own?<Link className="pill-button" href="/profile">Edit profile</Link>:user?<FollowButton id={target} following={member.isFollowing}/>:<Link className="pill-button" href="/login">Sign in to follow</Link>}</div>
 <div className="member-stats"><div><strong>{member.posts}</strong><span>Posts</span></div><div><strong>{member.likes}</strong><span>Likes received</span></div>{(['following','followers'] as const).map(k=>own?<Link key={k} href={`/me?connections=${k}`}><strong>{member[k]}</strong><span>{k==='following'?'Following':'Followers'}</span></Link>:<div key={k}><strong>{member[k]}</strong><span>{k==='following'?'Following':'Followers'}</span></div>)}</div>
 <div className="profile-badges">{member.badges.filter(b=>b.displayed).map(b=><span className="public-badge" key={b.id}><Icon name="award"/>{achievements.find(a=>a.id===b.id)?.name??b.id}</span>)}</div>
 </section>
 {own&&<details className="mobile-badge-manager details-card"><summary>Credits, achievements & badges</summary>{credits&&<div className="mobile-credit-status"><strong>{credits.weekly} / 10 weekly credits left · {credits.bonus} rewards</strong><progress aria-label="Weekly credits remaining" max={10} value={credits.weekly}/></div>}<div className="achievement-list">{achievements.map(a=><p key={a.id}><strong>{a.name}</strong> · {member.badges.some(b=>b.id===a.id)?"Completed ✓":`${Math.min(a.goal,member.progress?.[a.metric]??0)} / ${a.goal}`}<small>{a.description}</small></p>)}</div><h2>My badges</h2><div className="earned-badges">{member.badges.map(b=><div className="earned-badge" key={b.id}><strong>{achievements.find(a=>a.id===b.id)?.name}</strong><BadgeToggle id={b.id} displayed={b.displayed}/></div>)}</div>{!member.badges.length&&<p>Complete an achievement to earn badges.</p>}</details>}
 {kind?<section className="connections-card details-card"><div className="connections-heading"><h2>{kind==='following'?'Following':'Followers'}</h2><Link href="/me">My posts ↗</Link></div>{listError?<p role="alert">Could not load this list.</p>:!people?.length?<p>No {kind} yet.</p>:(people as {id:string;nickname:string;avatar_url:string|null}[]).map(p=><Link className="connection-person" key={p.id} href={`/members/${p.id}`}><span className="post-author-avatar">{p.avatar_url?<Image src={p.avatar_url} alt="" width={28} height={28} unoptimized/>:<Icon name="user"/>}</span>{p.nickname}</Link>)}</section>:<ExploreGallery captions={posts} votesUnavailable={!user||votesFailed} memberFeed/>}
 </div></SiteFrame>;
}
