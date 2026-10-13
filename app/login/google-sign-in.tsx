'use client';
import {createClient} from '@/lib/supabase/client';
export default function GoogleSignIn(){
 async function login(){
  const client=createClient();
  const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback`}});
  if(error)console.error('Login error:',error.message);
 }
 return <button onClick={login} className="pill-button">Sign in with Google <span aria-hidden="true">↗</span></button>;
}
