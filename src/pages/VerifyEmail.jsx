import React, { useEffect, useState } from 'react';
import RelayWordmark from '@/components/RelayWordmark';
import { Link } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import '@/drivebid.css';
import '@/verification.css';

// The primary signup path is Register.jsx's 6-digit OTP entry, which
// confirms the email in the same step. This page is the fallback landing
// spot for any Supabase auth email that instead links here (email change
// confirmation, or a signup template using a link instead of a code) — the
// Supabase client auto-processes the link's token into a session, so this
// just reports whether that happened.
export default function VerifyEmail(){
  const [state,setState]=useState({status:'loading',message:'Confirming your email…'});

  useEffect(()=>{
    let subscription;
    (async()=>{
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setState({status:'success',message:'Your email address has been verified.'});
        return;
      }
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          setState({status:'success',message:'Your email address has been verified.'});
        }
      });
      subscription = data.subscription;
      setTimeout(() => {
        setState((s) => s.status === 'loading' ? {status:'error',message:'This link is invalid or expired.'} : s);
      }, 4000);
    })();
    return () => subscription?.unsubscribe();
  },[]);

  return <div className="db-shell db-verification-page">
    <section className="db-panel db-verification-result">
      <div className="db-brand db-verification-brand"><RelayWordmark width={120} /></div>
      <div className={`db-verification-icon ${state.status}`}>{state.status==='loading'?'…':state.status==='success'?'✓':'!'}</div>
      <h1>{state.status==='loading'?'Verifying email':state.status==='success'?'Email verified':'Verification problem'}</h1>
      <p>{state.message}</p>
      {state.status!=='loading'&&<Link className="db-button db-verification-link" to={state.status==='success'?'/profile':'/login'}>{state.status==='success'?'Continue to my profile':'Return to login'}</Link>}
    </section>
  </div>;
}
