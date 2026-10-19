import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

function load(file,modules){
 const sandbox={exports:{},Date,Boolean,Number,Map,Promise,URL,Request,FormData,Error,process:{env:{GEMINI_API_KEY:'test',CHALLENGE_SERVER_SECRET:'test'}},require:name=>{assert(name in modules,`Unexpected dependency ${name}`);return modules[name];}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,sandbox);
 return sandbox.exports;
}
const component=name=>({__esModule:true,default:name});
const round={id:'round',title:'NYC Moments',theme:'NYC life',starts_at:'2026-10-12T04:00:00Z',ends_at:'2026-10-19T04:00:00Z',week_start:'2026-10-12',settled_at:null,image_url:null};
function fixture({user={id:'owner'},entered=false,closed=false,entriesError=false}={}){
 const tables=[],entry={caption_id:1,user_id:entered?'owner':'other',submitted_at:'2026-10-14T00:00:00Z',rank:null,reward:null,final_likes:null};let creditReads=0;
 const client={auth:{getUser:async()=>({data:{user}})},rpc:async()=>({error:null}),from:table=>{
  tables.push(table);const result=table==='profiles'?{first_name:'Test',last_name:'Member',nickname:'Tester'}:table==='weekly_challenges'?[round]:table==='challenge_entries'?[entry]:table==='captions'?[{id:1,caption:'caption',like_count:2,challenge_id:'round'}]:[];
  const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,maybeSingle:()=>query,then:resolve=>resolve({data:result,error:entriesError&&table==='challenge_entries'?{message:'Unavailable'}:null})};return query;
 }};
 const page=load('app/page.tsx',{'react/jsx-runtime':jsxRuntime,'./components/challenge-panel':component('ChallengePanel'),'./create/generate-form':component('GenerateForm'),'next/link':component('Link'),'next/navigation':{redirect:url=>{throw new Error('redirect:'+url);}},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/challenge':{challengeTime:()=>Date.parse(closed?'2026-10-20T00:00:00Z':'2026-10-18T00:00:00Z'),getCredits:async()=>{creditReads++;return {weekly:10,bonus:0,total:10};}},'@/lib/profile':{hasCompleteProfile:()=>true},'@/lib/post-authors':{withPostAuthors:async(_,rows)=>rows},'./components/site-frame':component('SiteFrame'),'./explore/explore-gallery':component('ExploreGallery')});
 return {run:params=>page.default({searchParams:Promise.resolve(params??(closed?{round:'round'}:{view:'challenge'}))}),tables,get creditReads(){return creditReads;}};
}
function elements(node,type){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>elements(n,type));return [...(node.type===type?[node]:[]),...elements(node.props?.children,type)];}
test('before publishing, Challenge embeds generation and does not load other entries into the gallery',async()=>{
 const f=fixture();const page=await f.run();assert.equal(elements(page,'GenerateForm').length,1);assert.equal(elements(page,'GenerateForm')[0].props.challenge.id,'round');assert.equal(elements(page,'ExploreGallery').length,0);assert(!f.tables.includes('captions'));assert.equal(f.creditReads,1);assert.equal(elements(page,'ChallengePanel')[0].props.enterHref,undefined);
});
test('after publishing, server refresh shows all submissions and removes generation to enforce one entry',async()=>{
 const f=fixture({entered:true});const page=await f.run();assert.equal(elements(page,'GenerateForm').length,0);assert.equal(elements(page,'ExploreGallery').length,1);assert.equal(elements(page,'ExploreGallery')[0].props.captions.length,1);assert.equal(f.creditReads,0);
});
test('guests may read challenge information but cannot generate or see the gated current submissions',async()=>{
 const f=fixture({user:null});const page=await f.run();assert.equal(elements(page,'GenerateForm').length,0);assert.equal(elements(page,'ExploreGallery').length,0);assert(elements(page,'Link').some(link=>link.props.href==='/login'));assert.equal(f.creditReads,0);
});
test('closed rounds show results without a generation form, including to guests',async()=>{
 const f=fixture({user:null,closed:true});const page=await f.run();assert.equal(elements(page,'GenerateForm').length,0);assert.equal(elements(page,'ExploreGallery').length,1);assert.equal(elements(page,'ChallengePanel')[0].props.closed,true);
});
test('an entry lookup error does not accidentally allow duplicate generation',async()=>{
 const f=fixture({entriesError:true});const page=await f.run();assert.equal(elements(page,'GenerateForm').length,0);assert.equal(elements(page,'ExploreGallery').length,0);assert.equal(f.creditReads,0);
});
for(const user of [null,{id:'owner'}])test(`root defaults to Explore for ${user?'signed-in visitors':'guests'}`,async()=>{
 await assert.rejects(fixture({user}).run({}),/redirect:\/explore/);
});
test('OAuth callback lands on Explore and preserves the existing error redirect',async()=>{
 const callback=load('app/auth/callback/route.ts',{'next/server':{NextResponse:{redirect:url=>({url})}},'@/lib/supabase/server':{createClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:null})}})}});
 assert.equal((await callback.GET(new Request('https://app.test/auth/callback?code=test'))).url,'https://app.test/explore');assert.equal((await callback.GET(new Request('https://app.test/auth/callback'))).url,'https://app.test/login?error=auth');
});
test('completing account details redirects to Explore after saving',async()=>{
 const invalidated=[];let saved;
 const query={update:row=>{saved=row;return query;},eq:()=>query,select:()=>query,single:async()=>({data:{id:'owner'},error:null})};
 const actions=load('app/profile/actions.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:'owner'}}})},from:()=>query})},'next/navigation':{redirect:url=>{throw new Error('redirect:'+url);}},'next/cache':{revalidatePath:(...args)=>invalidated.push(args)}});
 const form=new FormData();form.set('nickname','Tester');form.set('first_name','Test');form.set('last_name','Member');
 await assert.rejects(actions.updateProfile(form),/redirect:\/explore/);assert.equal(saved.nickname,'Tester');assert.equal(invalidated[0][1],'layout');
});
