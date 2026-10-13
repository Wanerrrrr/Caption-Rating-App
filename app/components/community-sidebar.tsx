import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {getMember,achievements} from '@/lib/community';
import {getCredits} from '@/lib/challenge';
import Icon from './ui-icon';
import ProfileSummary, {type FrameProfile} from './profile-summary';
import {BadgeToggle} from './member-controls';
export default async function CommunitySidebar({profile}:{profile?:FrameProfile|null}){
 const client=await createClient();const {data}=await client.auth.getUser();
 if(!data.user||data.user.is_anonymous)return null;
 const [member,credits]=await Promise.all([getMember(client,data.user.id),getCredits(client)]);
 if(!member)return <ProfileSummary profile={profile}/>;
 const earned=new Set(member.badges.map(b=>b.id));
 return <>
 <ProfileSummary profile={{...profile,first_name:profile?.first_name??null,last_name:profile?.last_name??null,nickname:member.nickname,avatar_url:member.avatar_url}} badges={member.badges.filter(b=>b.displayed).map(b=>({id:b.id,name:achievements.find(a=>a.id===b.id)?.name??b.id}))}/>
 <div className="member-stats sidebar-member-stats"><Link href="/me"><strong>{member.likes}</strong><span>Likes received</span></Link><Link href="/me?connections=following"><strong>{member.following}</strong><span>Following</span></Link><Link href="/me?connections=followers"><strong>{member.followers}</strong><span>Followers</span></Link></div>
 <section className="sidebar-section"><div className="section-heading"><h3 className="folder-tab">Weekly credits</h3></div><div className="credit-progress-heading"><strong>{credits.weekly} / 10 left</strong><small>Resets Monday</small></div><progress aria-label="Weekly credits remaining" value={credits.weekly} max={10}/><p className="credit-bonus">{credits.bonus} reward credits</p></section>
 <section className="sidebar-section"><div className="section-heading"><h3 className="folder-tab">Achievements</h3></div><div className="achievement-list">{achievements.map(a=>{const done=earned.has(a.id);const current=Math.min(a.goal,member.progress?.[a.metric]??0);return <div className={`community-achievement${done?' achieved':''}`} key={a.id}><span className="feature-icon"><Icon name={done?'award':'lock'}/></span><div><strong>{a.name}</strong><small>{a.description}</small><span className="achievement-progress">{done?'Completed ✓':`${current} / ${a.goal}`}</span></div></div>;})}</div></section>
 <section className="sidebar-section"><div className="section-heading"><h3 className="folder-tab">My badges</h3></div><div className="earned-badges">{member.badges.length?member.badges.map(b=>{const a=achievements.find(a=>a.id===b.id);return <div key={b.id} className="earned-badge"><span className="badge-medal"><Icon name="award"/></span><strong>{a?.name??b.id}</strong><BadgeToggle id={b.id} displayed={b.displayed}/></div>;}):<p>Complete an achievement to earn your first badge.</p>}</div></section>
 </>;
}
