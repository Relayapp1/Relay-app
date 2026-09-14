import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import '@/drivebid.css';
import '@/verification.css';

export default function VerifyEmail(){
  const [params]=useSearchParams();
  const [state,setState]=useState({status:'loading',message:'Confirming your email…'});
  const started=useRef(false);

  useEffect(()=>{
    if(started.current)return;
    started.current=true;
    const token=params.get('token')||'';
    if(!token){setState({status:'error',message:'This verification link is missing its secure token.'});return;}
    (async()=>{
      try{
        const response=await base44.functions.invoke('confirm-email-verification',{token});
        const result=response?.data??response;
        if(!result?.success)throw new Error(result?.error||'Verification failed');
        setState({status:'success',message:'Your email address has been verified.'});
      }catch(error){
        setState({status:'error',message:error?.response?.data?.error||error.message||'This link is invalid or expired.'});
      }
    })();
  },[params]);

  return <div className="db-shell db-verification-page">
    <section className="db-panel db-verification-result">
      <div className="db-brand db-verification-brand"><div className="db-brandmark">DB</div><span>DriveBid</span></div>
      <div className={`db-verification-icon ${state.status}`}>{state.status==='loading'?'…':state.status==='success'?'✓':'!'}</div>
      <h1>{state.status==='loading'?'Verifying email':state.status==='success'?'Email verified':'Verification problem'}</h1>
      <p>{state.message}</p>
      {state.status!=='loading'&&<Link className="db-button db-verification-link" to={state.status==='success'?'/profile':'/login'}>{state.status==='success'?'Continue to my profile':'Return to login'}</Link>}
    </section>
  </div>;
}
