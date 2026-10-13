import 'server-only';
import { createClient } from '@/lib/supabase/server';
export const achievements = [
 {id:'first-post',name:'Hello, Club',description:'Publish your first caption',metric:'posts',goal:1},
 {id:'ten-posts',name:'Caption Creator',description:'Publish 10 captions',metric:'posts',goal:10},
 {id:'first-like',name:'First Heart',description:'Like a caption',metric:'given',goal:1},
 {id:'ten-likes',name:'Good Taste',description:'Like 10 captions',metric:'given',goal:10},
 {id:'ten-received',name:'Crowd Pleaser',description:'Receive 10 total likes',metric:'received',goal:10},
 {id:'fifty-received',name:'Club Favorite',description:'Receive 50 total likes',metric:'received',goal:50},
 {id:'challenger',name:'Challenge Accepted',description:'Publish a challenge entry',metric:'entries',goal:1},
 {id:'winner',name:'On the Podium',description:'Win a weekly challenge prize',metric:'wins',goal:1},
 {id:'five-followers',name:'Your Little Crowd',description:'Reach 5 followers',metric:'followers',goal:5},
] as const;
export type Member = {id:string;nickname:string;avatar_url:string|null;posts:number;likes:number;following:number;followers:number;isFollowing:boolean;badges:{id:string;earnedAt:string;displayed:boolean}[];progress:Record<string,number>|null};
export async function getMember(client:Awaited<ReturnType<typeof createClient>>,id:string):Promise<Member|null> {
 const {data,error}=await client.rpc('community_profile',{p_user_id:id});
 if(error) throw new Error('Could not load this member. Please refresh.');
 return data;
}
