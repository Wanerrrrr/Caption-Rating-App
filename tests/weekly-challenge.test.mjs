// Offline integration checks: exercise the real route without spending Gemini
// quota or impersonating accounts in the production database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

function load(file, modules, globals = {}) {
    const sandbox = { exports: {}, require: name => {
        if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
        return modules[name];
    }, Buffer, File, FormData, Response, Request, URL, Date, Error, process: {env:{GEMINI_API_KEY:'test-only',CHALLENGE_SERVER_SECRET:'test-only'}}, ...globals };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
    return sandbox.exports;
}
function fixture({failStage, reserveError, callError, challengeId=null, closed=false, responses}={}) {
    let aiCalls=0, acquired=0, published=0; const reservations=[],finishes=[],drafts=[];
    const client={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},rpc:async(name,args)=>{
        if(name==='reserve_generation'){reservations.push(args);return reserveError ? {error:{message:reserveError}} : {data:'reservation-id'};}
        if(name==='acquire_provider_call'){acquired++;return callError ? {error:{message:callError}} : {error:null};}
        throw new Error(`Unexpected RPC ${name}`);
    }};
    const challenge={id:challengeId,theme:'Campus chaos',image_url:'https://test/challenge.png'};
    const realProvider = responses ? load('lib/gemini.ts', {'server-only':{}}, {
        AbortSignal, console:{info:()=>{},error:()=>{}}, process:{env:{GEMINI_API_KEY:'test-only',GROQ_API_KEY:'test-only'}},
        fetch:async()=>{aiCalls++;const response=responses.shift();if(!response)throw new Error('Unexpected call');return new Response(JSON.stringify(response.body),{status:response.status??200});}
    }) : null;
    const route=load('app/api/generate/route.ts',{
        'node:crypto':crypto,
        '@/lib/supabase/server':{createClient:async()=>client},
        '@/lib/challenge':{UUID:/^[a-f0-9-]{36}$/,getChallenge:async()=>challenge,assertCanEnter:async()=>{if(closed)throw new Error('This challenge is not open.');},fixedChallengeImage:async()=>new File(['fixture'],'fixed.png',{type:'image/png'}),serverSecret:()=> 'test-only',finishCredit:async(_,id,success)=>{finishes.push({id,success});return {weekly:9,bonus:0,total:9};}},
        '@/lib/gemini':realProvider ?? {aiConfigured:()=>true,ProviderFailure:Error,logGeneration:()=>{},captionPrompt:(description,direction)=>description+' '+direction,generateWithFallback:async(_,max,context,acquire)=>{await acquire("gemini");aiCalls++;if(context.stage===failStage)throw new Error('Simulated upstream failure');return {text:context.stage==='description'?'photo description':'caption',provider:'gemini',model:'gemini-3.8-flash'};}},
        '@/lib/caption-image':{imageExtensions:{'image/png':'png'},matchesImage:()=>true,prepareDescriptionImage:async()=>({descriptionPrompt:'Describe',images:[]})},
        '@/lib/generation-draft':{imageHash:()=> 'image-hash',signDraft:fields=>{drafts.push(fields);return 'signed-draft';}}
    });
    return {async run(){const form=new FormData();if(challengeId)form.set('challengeId',challengeId);else form.set('photo',new File(['fixture'],'test.png',{type:'image/png'}));return route.POST(new Request('https://app.test/api/generate',{method:'POST',headers:{origin:'https://app.test'},body:form}));}, reservations,finishes,drafts,get counts(){return {aiCalls,acquired,published};}};
}
test('success reserves once, authorizes both API calls and charges once before returning the preview',async()=>{
 const f=fixture();const response=await f.run();assert.equal(response.status,200);const json=await response.json();assert.equal(json.draft,'signed-draft');assert.equal(json.credits.total,9);assert.equal(f.reservations.length,1);assert.equal(f.counts.aiCalls,2);assert.equal(f.counts.acquired,2);assert.deepEqual(f.finishes,[{id:'reservation-id',success:true}]);assert.equal(f.drafts[0].generationId,'reservation-id');assert.equal(f.drafts[0].challengeId,null);assert.equal(f.counts.published,0);
});
for(const stage of ['description','caption'])test(`${stage} failure refunds without returning a publishable draft`,async()=>{
 const f=fixture({failStage:stage});const response=await f.run();assert.equal(response.status,502);assert.equal((await response.json()).draft,undefined);assert.deepEqual(f.finishes,[{id:'reservation-id',success:false}]);assert.equal(f.drafts.length,0);
});
test('exhausted balance prevents any AI call',async()=>{const f=fixture({reserveError:'No generation credits left'});assert.equal((await f.run()).status,429);assert.equal(f.counts.aiCalls,0);assert.equal(f.finishes.length,0);});
test('global request limit refunds the reservation without calling AI',async()=>{const f=fixture({callError:'Daily AI capacity reached'});assert.equal((await f.run()).status,502);assert.equal(f.counts.aiCalls,0);assert.deepEqual(f.finishes,[{id:'reservation-id',success:false}]);});
test('fixed-image challenge is supplied by the server and bound into the signed preview',async()=>{const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';const f=fixture({challengeId:id});assert.equal((await f.run()).status,200);assert.equal(f.reservations[0].p_challenge_id,id);assert.equal(f.drafts[0].challengeId,id);assert(f.drafts[0].prompt.includes('Campus chaos'));});
test('closed challenge cannot reserve credits or call AI',async()=>{const f=fixture({challengeId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',closed:true});assert.equal((await f.run()).status,400);assert.equal(f.reservations.length,0);assert.equal(f.counts.aiCalls,0);});
test('signed previews reject changed image, user, challenge fields and tampering',()=>{
 const draft=load('lib/generation-draft.ts',{'server-only':{},'node:crypto':crypto});const bytes=Buffer.from('image');const token=draft.signDraft({userId:'user',imageHash:draft.imageHash(bytes),mime:'image/png',caption:'caption',description:'description',descriptionPrompt:'describe',prompt:'prompt',model:'gemini-3.8-flash',generationId:'reservation',challengeId:'challenge'});
 assert.equal(draft.verifyDraft(token,'user',bytes,'image/png').generationId,'reservation');assert.throws(()=>draft.verifyDraft(token,'other',bytes,'image/png'));assert.throws(()=>draft.verifyDraft(token,'user',Buffer.from('changed'),'image/png'));
 const [payload,mac]=token.split('.');const changed=JSON.parse(Buffer.from(payload,'base64url'));changed.challengeId='other';assert.throws(()=>draft.verifyDraft(Buffer.from(JSON.stringify(changed)).toString('base64url')+'.'+mac,'user',bytes,'image/png'));
});

test('real fallback route returns Groq preview, charges once and records actual models',async()=>{
 const f=fixture({responses:[{status:503,body:{error:{message:'overloaded'}}},{body:{choices:[{finish_reason:'stop',message:{content:'photo description'}}]}},{body:{choices:[{finish_reason:'stop',message:{content:'caption'}}]}}]});
 assert.equal((await f.run()).status,200);assert.deepEqual(f.finishes,[{id:'reservation-id',success:true}]);assert.equal(f.counts.acquired,3);assert.equal(f.counts.aiCalls,3);assert.equal(f.drafts[0].model,'qwen/qwen3.8-27b');assert.equal(f.drafts[0].descriptionModel,'qwen/qwen3.8-27b');assert.equal(f.counts.published,0);
});
test('real fallback route refunds once when both services fail',async()=>{
 const f=fixture({responses:[{status:503,body:{}},{status:503,body:{}}]});assert.equal((await f.run()).status,502);assert.deepEqual(f.finishes,[{id:'reservation-id',success:false}]);assert.equal(f.drafts.length,0);assert.equal(f.counts.aiCalls,2);
});
test('Publish accepts signed Groq preview, saves model provenance and spends no further credit',async()=>{
 const drafts=load('lib/generation-draft.ts',{'server-only':{},'node:crypto':crypto});const bytes=Buffer.from('fixture');
 const token=drafts.signDraft({userId:'test-user',imageHash:drafts.imageHash(bytes),mime:'image/png',caption:'caption',description:'description',descriptionPrompt:'describe',prompt:'prompt',model:'qwen/qwen3.8-27b',descriptionModel:'gemini-3.8-flash',generationId:'reservation-id',challengeId:null});
 const saved=[],uploads=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from:table=>{
  const chain={select:()=>chain,eq:()=>chain,limit:()=>chain,maybeSingle:async()=>({data:table==='profiles'?{nickname:'Tester'}:null,error:null}),insert:async row=>{saved.push(row);return {error:null};}};return chain;
 },storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'https://test/image.png'}}),upload:async(...args)=>{uploads.push(args);return {error:null};}})}};
 const route=load('app/api/publish/route.ts',{'@/lib/challenge':{UUID:/^[a-f0-9-]{36}$/},'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/caption-image':{imageExtensions:{'image/png':'png'},matchesImage:()=>true},'@/lib/generation-draft':drafts});
 const form=new FormData();form.set('draft',token);form.set('photo',new File([bytes],'test.png',{type:'image/png'}));
 const response=await route.POST(new Request('https://app.test/api/publish',{method:'POST',headers:{origin:'https://app.test'},body:form}));assert.equal(response.status,200);assert.equal(saved[0].generation_model,'qwen/qwen3.8-27b');assert.equal(saved[0].description_model,'gemini-3.8-flash');assert.equal(saved[0].generation_id,'reservation-id');assert.equal(uploads.length,1);
});
