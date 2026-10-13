import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

function fixture(responses, env = { GEMINI_API_KEY: 'gemini-secret', GROQ_API_KEY: 'groq-secret' }) {
    const calls = [], logs = [], authorized = [];
    const sandbox = { exports: {}, require: name => { if (name === 'server-only') return {}; throw new Error(name); },
        process: { env }, Error, Date, AbortSignal,
        console: { info: s => logs.push(JSON.parse(s)), error: s => logs.push(JSON.parse(s)) },
        fetch: async (url, options) => {
            calls.push({ url, options });
            const response = responses.shift();
            if (response instanceof Error) throw response;
            assert(response, 'Unexpected extra provider call');
            return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
        } };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gemini.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, sandbox);
    const api = sandbox.exports;
    return { api, calls, logs, authorized, run: (stage='description', preferred='gemini', acquire=async p=>authorized.push(p), deadline=Date.now()+110000) => api.generateWithFallback(
        [{text:'private user input'}, {inline_data:{mime_type:'image/png',data:'private-image'}}], 240, {requestId:'test-request',stage}, acquire, deadline, preferred) };
}
const gemini = text => ({ body: {candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]} });
const groq = text => ({ body: {choices:[{finish_reason:'stop',message:{content:text}}]} });

test('healthy Gemini stays primary and never calls Groq', async()=>{
    const f=fixture([gemini('caption')]); const r=await f.run();
    assert.equal(r.model,'gemini-3.8-flash');assert.deepEqual(f.authorized,['gemini']);assert.equal(f.calls.length,1);
});
for (const status of [408,429,503]) test(`Gemini ${status} switches to vision-capable Groq and logs no private data`, async()=>{
    const f=fixture([{status,body:{error:{status:'UNAVAILABLE',message:'overload private user input gemini-secret'}}},groq('backup caption')]);
    const r=await f.run(); assert.equal(r.model,'qwen/qwen3.8-27b');assert.deepEqual(f.authorized,['gemini','groq']);
    const body=JSON.parse(f.calls[1].options.body);assert.equal(body.reasoning_effort,'none');
    assert.equal(body.messages[0].content[1].image_url.url,'data:image/png;base64,private-image');
    assert(f.logs.some(l=>l.provider==='groq'&&l.outcome==='success'));
    const logged=JSON.stringify(f.logs);for(const secret of ['private user input','private-image','gemini-secret','groq-secret','backup caption']) assert(!logged.includes(secret));
});
for(const error of [new TypeError('private connection detail'),Object.assign(new Error('private timeout'),{name:'TimeoutError'})])test(`transient ${error.name} falls back`,async()=>{
    const f=fixture([error,groq('caption')]);assert.equal((await f.run()).provider,'groq');
});
for(const status of [400,401,403,404]) test(`Gemini ${status} does not bypass invalid configuration through fallback`,async()=>{
    const f=fixture([{status,body:{error:{message:'private detail'}}}]);await assert.rejects(f.run());assert.equal(f.calls.length,1);
});
test('blocked and malformed Gemini output do not bypass validation',async()=>{
    for(const response of [{body:{candidates:[{finishReason:'SAFETY'}]}},{body:{candidates:[]}},{body:{candidates:[{finishReason:'STOP',content:{parts:[{text:'a'.repeat(241)}]}}]}}]){
        const f=fixture([response]);await assert.rejects(f.run());assert.equal(f.calls.length,1);
    }
});
test('Groq is used directly without Gemini key; missing backup preserves existing failure',async()=>{
    const f=fixture([groq('caption')],{GROQ_API_KEY:'groq-secret'});assert.equal((await f.run()).provider,'groq');assert.deepEqual(f.authorized,['groq']);
    const noBackup=fixture([{status:503,body:{}}],{GEMINI_API_KEY:'gemini-secret'});await assert.rejects(noBackup.run());assert.equal(noBackup.calls.length,1);
});
test('after description fallback, caption goes directly to Groq',async()=>{
    const f=fixture([{status:503,body:{}},groq('description'),groq('caption')]);const description=await f.run();
    assert.equal((await f.run('caption',description.provider)).text,'caption');assert.deepEqual(f.authorized,['gemini','groq','groq']);
});
test('Gemini app capacity can fall back, but reservation authorization cannot',async()=>{
    const f=fixture([groq('caption')]);await f.run('description','gemini',async p=>{if(p==='gemini')throw new f.api.ProviderFailure('Daily AI capacity reached',true);});assert.equal(f.calls.length,1);
    const denied=fixture([]);await assert.rejects(denied.run('description','gemini',async()=>{throw new Error('Generation reservation expired');}));assert.equal(denied.calls.length,0);
});
test('both providers failing returns a safe failure with bounded attempts',async()=>{
    const f=fixture([{status:503,body:{}},{status:429,body:{error:{message:'secret echo'}}}]);await assert.rejects(f.run(),/AI request limit reached/);assert.equal(f.calls.length,2);assert(!JSON.stringify(f.logs).includes('secret echo'));
});
test('expired overall budget sends no request',async()=>{
    const f=fixture([]);await assert.rejects(f.run('caption','gemini',undefined,Date.now()-1),/too long/);assert.equal(f.calls.length,0);
});
test('Groq preview model provenance stays signed and cannot be substituted',()=>{
    const sandbox={exports:{},require:n=>n==='server-only'?{}:crypto,Buffer,Date,Error,process:{env:{CHALLENGE_SERVER_SECRET:'test-draft-secret'}}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/generation-draft.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
    const d=sandbox.exports,bytes=Buffer.from('image');
    const token=d.signDraft({userId:'user',imageHash:d.imageHash(bytes),mime:'image/png',caption:'caption',description:'description',descriptionPrompt:'describe',prompt:'prompt',model:'qwen/qwen3.8-27b',descriptionModel:'gemini-3.8-flash',generationId:'reservation',challengeId:null});
    assert.equal(d.verifyDraft(token,'user',bytes,'image/png').descriptionModel,'gemini-3.8-flash');
    const [payload,mac]=token.split('.'),changed=JSON.parse(Buffer.from(payload,'base64url'));changed.model='other';
    assert.throws(()=>d.verifyDraft(Buffer.from(JSON.stringify(changed)).toString('base64url')+'.'+mac,'user',bytes,'image/png'));
});
