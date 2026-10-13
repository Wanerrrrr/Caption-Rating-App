import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const target='11111111-1111-4111-8111-111111111111';
function fixture(user,error=null){
 const calls=[],invalidated=[];
 const client={auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{calls.push({name,args});return {error};}};
 const modules={'@/lib/supabase/server':{createClient:async()=>client},'next/cache':{revalidatePath:(...args)=>invalidated.push(args)},'@/lib/challenge':{UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i}};
 const sandbox={exports:{},require:name=>modules[name]};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/me/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
 return {...sandbox.exports,calls,invalidated};
}
for(const user of [null,{id:'owner',is_anonymous:true}])test(`unsigned/anonymous session cannot follow or display badges: ${user?.id??'none'}`,async()=>{
 const f=fixture(user);assert.ok((await f.followMember(target,true)).error);assert.ok((await f.displayBadge('first-post',true)).error);assert.equal(f.calls.length,0);
});
test('invalid identifiers and non-boolean values never reach the database',async()=>{const f=fixture({id:'owner'});assert.ok((await f.followMember('bad',true)).error);assert.ok((await f.followMember(target,'yes')).error);assert.ok((await f.displayBadge('first-post','yes')).error);assert.equal(f.calls.length,0);});
test('follow/unfollow use the authenticated RPC and refresh both profiles',async()=>{const f=fixture({id:'owner'});assert.equal((await f.followMember(target,true)).error,null);assert.equal((await f.followMember(target,false)).error,null);assert.equal(f.calls[0].name,'set_member_follow');assert.equal(f.calls[1].args.p_follow,false);assert.ok(f.invalidated.some(args=>args[0]===`/members/${target}`));});
test('database refusal cannot be mistaken for a saved follow or earned badge',async()=>{const f=fixture({id:'owner'},{message:'private database details'});const a=await f.followMember(target,true),b=await f.displayBadge('winner',true);assert.ok(a.error);assert.ok(b.error);assert.equal(f.invalidated.length,0);assert.ok(!JSON.stringify([a,b]).includes('private database details'));});
test('badge selection refreshes the displayed profile without accepting a user id',async()=>{const f=fixture({id:'owner'});assert.equal((await f.displayBadge('first-post',true)).error,null);assert.equal(f.calls[0].args.p_badge_id,'first-post');assert.equal(Object.hasOwn(f.calls[0].args,'user_id'),false);assert.equal(f.invalidated[0][1],'layout');});
for(const user of [null,{id:'owner',is_anonymous:true}])test('badge notifications require a real authenticated account',async()=>{
 const f=fixture(user);assert.ok((await f.acknowledgeBadge('first-post')).error);assert.equal(f.calls.length,0);
});
test('badge acknowledgement accepts only an identifier and scopes the RPC to the caller',async()=>{
 const f=fixture({id:'owner'});assert.ok((await f.acknowledgeBadge('')).error);assert.ok((await f.acknowledgeBadge('a'.repeat(51))).error);assert.equal(f.calls.length,0);
 assert.equal((await f.acknowledgeBadge('first-post')).error,null);assert.equal(f.calls[0].name,'acknowledge_badge');assert.equal(f.calls[0].args.p_badge_id,'first-post');assert.equal(Object.keys(f.calls[0].args).length,1);assert.equal(f.invalidated[0][1],'layout');
});
test('failed acknowledgement preserves notification eligibility and hides database details',async()=>{
 const f=fixture({id:'owner'},{message:'private error'});const result=await f.acknowledgeBadge('first-post');assert.ok(result.error);assert(!JSON.stringify(result).includes('private error'));assert.equal(f.invalidated.length,0);
});
