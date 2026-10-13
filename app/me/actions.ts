'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {UUID} from '@/lib/challenge';
export async function followMember(id:string,follow:boolean) {
 if(!UUID.test(id)||typeof follow!=='boolean') return {error:'Invalid member.'};
 const client=await createClient(); const {data}=await client.auth.getUser();
 if(!data.user||data.user.is_anonymous) return {error:'Sign in to follow members.'};
 const {error}=await client.rpc('set_member_follow',{p_user_id:id,p_follow:follow});
 if(error) return {error:'Could not save your follow. Please retry.'};
 revalidatePath('/me');revalidatePath(`/members/${id}`);return {error:null};
}
export async function displayBadge(id:string,displayed:boolean) {
 if(typeof id!=='string'||id.length>50||typeof displayed!=='boolean')return {error:'Invalid badge.'};
 const client=await createClient();const {data}=await client.auth.getUser();
 if(!data.user||data.user.is_anonymous)return {error:'Sign in to choose badges.'};
 const {error}=await client.rpc('set_displayed_badge',{p_badge_id:id,p_displayed:displayed});
 if(error)return {error:'Could not save your badge. Only earned badges can be displayed.'};
 revalidatePath('/', 'layout');return {error:null};
}

export async function acknowledgeBadge(id:string) {
 if(typeof id!=='string'||!id||id.length>50)return {error:'Invalid badge.'};
 const client=await createClient();const {data}=await client.auth.getUser();
 if(!data.user||data.user.is_anonymous)return {error:'Sign in to continue.'};
 const {error}=await client.rpc('acknowledge_badge',{p_badge_id:id});
 if(error)return {error:'Could not save this badge notification.'};
 revalidatePath('/','layout');return {error:null};
}
