import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';
import '@/verification.css';
import { formatPhone } from '@/lib/phone';
import { isDriveBidOwner } from '@/lib/ownerAccess';
import PullToRefresh from '@/components/PullToRefresh';
import WalletPanel from '@/components/WalletPanel';
import { buildTripStatementCsv, downloadCsv } from '@/lib/earningsExport';
import { computeDriverBadges } from '@/lib/badges';

const hours=(minutes)=>Number(minutes||0)/60;
const money=(value)=>`$${Number(value||0).toFixed(2)}`;
const statusLabel=(value)=>value?value[0].toUpperCase()+value.slice(1):'Not submitted';

export default function AccountProfile(){
  const navigate=useNavigate();
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [trips,setTrips]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [deals,setDeals]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [form,setForm]=useState({full_name:'',email:'',phone:'',operating_area:''});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [sendingEmail,setSendingEmail]=useState(false);
  const [message,setMessage]=useState('');
  const [deleteModal,setDeleteModal]=useState(false);
  const [deleting,setDeleting]=useState(false);

  const load=async()=>{
    try{
      let current=await base44.auth.me();
      const pendingRole=sessionStorage.getItem('drivebid_signup_role');
      if(pendingRole&&['driver','broker','individual'].includes(pendingRole)){
        current=await base44.auth.updateMe({account_type:pendingRole,terms_accepted_at:new Date().toISOString()});
        sessionStorage.removeItem('drivebid_signup_role');
      }
      setUser(current);
      setForm({full_name:current.display_name||current.full_name||'',email:current.contact_email||current.email||'',phone:formatPhone(current.phone||''),operating_area:''});
      const notice=sessionStorage.getItem('drivebid_email_notice');
      if(notice){setMessage(notice);sessionStorage.removeItem('drivebid_email_notice');}
      if(sessionStorage.getItem('drivebid_send_email_verification')&& !current.email_link_verified){
        sessionStorage.removeItem('drivebid_send_email_verification');
        try{
          await base44.functions.invoke('request-email-verification',{});
          setMessage('A confirmation link was sent to your email.');
        }catch(error){setMessage(error?.response?.data?.error||error.message||'Use the button below to send your verification link.');}
      }
      const isPoster=current.account_type!=='driver';
      const entity=isPoster?'Broker':'Driver';
      const [profiles,ownTrips,ownExpenses,ownDeals,ownReviews]=await Promise.all([
        base44.entities[entity].filter({created_by_id:current.id},'-created_date',1),
        base44.entities.Trip.filter(isPoster?{broker_id:current.id}:{driver_id:current.id},'-created_date',250),
        base44.entities.TripExpense.filter(isPoster?{broker_id:current.id}:{driver_id:current.id},'-created_date',500),
        isPoster?base44.entities.Deal.filter({broker_id:current.id},'-created_date',500):Promise.resolve([]),
        base44.entities.Review.filter({reviewee_id:current.id},'-created_date',100)
      ]);
      const prof=profiles[0]||null;
      setProfile(prof);setTrips(ownTrips);setExpenses(ownExpenses);setDeals(ownDeals);setReviews(ownReviews);
      if(prof)setForm({full_name:prof.full_name||current.full_name||'',email:prof.email||current.email||'',phone:formatPhone(current.phone||prof.phone||''),operating_area:prof.operating_area||prof.home_location||''});
    }catch(error){setMessage(error.message||'Could not load your profile');}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);

  const save=async(e)=>{
    e.preventDefault();setSaving(true);setMessage('');
    try{
      const updated=await base44.auth.updateMe({phone:form.phone,display_name:form.full_name,contact_email:form.email});
      setUser(updated);
      if(profile){
        const entity=user.account_type!=='driver'?'Broker':'Driver';
        const saved=await base44.entities[entity].update(profile.id,{full_name:form.full_name,phone:form.phone,email:form.email,...(entity==='Driver'?{operating_area:form.operating_area}:{})});
        setProfile(saved);
        setForm({full_name:saved.full_name||form.full_name,email:saved.email||form.email,phone:formatPhone(form.phone),operating_area:saved.operating_area||form.operating_area||''});
      }
      setMessage('Account information saved.');
    }catch(error){setMessage(error.message||'Could not save your profile');}
    finally{setSaving(false);}
  };

  const sendVerificationEmail=async()=>{
    setSendingEmail(true);setMessage('');
    try{
      const response=await base44.functions.invoke('request-email-verification',{});
      const result=response?.data??response;
      setMessage(result?.already_verified?'Your email is already verified.':result?.recently_sent?'A link was sent recently. Check your inbox and spam folder.':'A secure confirmation link was sent to your email.');
    }catch(error){setMessage(error?.response?.data?.error||error.message||'Could not send the verification email.');}
    finally{setSendingEmail(false);}
  };

  const deleteAccount=async()=>{
    setDeleting(true);setMessage('');
    try{
      await base44.functions.invoke('delete-account',{});
      await base44.auth.logout(window.location.origin+'/login');
    }catch(error){setMessage(error?.response?.data?.error||error.message||'Could not delete account');setDeleting(false);}
  };

  const exportStatement=()=>{
    const csv=buildTripStatementCsv(trips,expenses,isPoster);
    const label=isPoster?'statement':'earnings-summary';
    downloadCsv(`relay-${label}-${new Date().toISOString().slice(0,10)}.csv`,csv);
  };

  const openDocument=async(uri)=>{
    if(!uri)return;
    try{
      if(uri.startsWith('http')){
        window.open(uri,'_blank','noopener,noreferrer');
      }else{
        const result=await base44.integrations.Core.CreateFileSignedUrl({file_uri:uri});
        window.open(result.signed_url||result.file_url||result.url,'_blank','noopener,noreferrer');
      }
    }catch(error){setMessage(error.message||'Could not open this document');}
  };

  const isPoster=user?.account_type==='broker'||user?.account_type==='individual';
  const isIndividual=user?.account_type==='individual';
  const isBroker=user?.account_type==='broker';
  const isAdmin=isDriveBidOwner(user);
  const completed=trips.filter(x=>x.status==='completed');
  const totalMinutes=trips.reduce((sum,x)=>sum+Number(x.tracked_minutes||0),0);
  const expenseTotal=expenses.filter(x=>x.status!=='rejected').reduce((sum,x)=>sum+Number(x.amount||0),0);
  const averageRating=reviews.length?reviews.reduce((sum,x)=>sum+Number(x.rating||0),0)/reviews.length:Number(profile?.rating||5);
  const stats=isPoster?[
    ['Jobs posted',deals.length],
    ['Jobs completed',completed.length],
    ['Payments sent',trips.filter(x=>x.payment_status==='sent').length],
    ['Payments pending',trips.filter(x=>x.payment_status!=='sent').length]
  ]:[
    ['Completed deliveries',completed.length||profile?.completed_deliveries||0],
    ['Overall hours',hours(totalMinutes).toFixed(1)],
    ['Tracked expenses',money(expenseTotal)],
    ['Average rating',`${averageRating.toFixed(1)} / 5`],
    ['Response rate',`${profile?.response_rate||100}%`]
  ];
  const documents=isIndividual?[
    ['Government ID',profile?.government_id_document]
  ]:isPoster?[
    ['W-9',profile?.w9_document],
    ["Broker's license",profile?.broker_license_document]
  ]:[
    ["License front",profile?.license_front],
    ["License back",profile?.license_back],
    ["Driving history",profile?.driving_history_report]
  ];

  if(loading)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading profile…</span></div></div>;
  return <div className="db-shell">
    <header className="db-topbar"><div className="db-brand"><div className="db-brandmark">R</div><span>Relay</span></div><button className="db-button secondary db-admin-back" onClick={()=>navigate(-1)}>← Back</button></header>
    <main className="db-page">
      <PullToRefresh onRefresh={load}/>
      <div className="db-heading-row"><div><div className="db-eyebrow">{isAdmin?'Admin':isIndividual?'Individual':isBroker?'Broker':'Driver'} account</div><h1>My profile</h1><p>Your contact information, documents, activity, and reviews.</p></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="db-button secondary" onClick={()=>navigate('/')}>Marketplace</button>{!isPoster&&<button className="db-button secondary" onClick={()=>navigate('/trips')}>My trips</button>}{isDriveBidOwner(user)&&<button className="db-button secondary" onClick={()=>navigate('/admin')}>Admin</button>}<button className="db-button danger" onClick={()=>base44.auth.logout(window.location.origin+'/login')}>Sign out</button></div></div>
      {!profile&&!isAdmin&&<div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>{isIndividual?'Identity verification required':isBroker?'Broker vetting required':'Driver vetting required'}</strong><p>Your account profile is active. Complete vetting to use live marketplace features.</p></div></div>}
      <section className="db-panel db-verification-panel">
        <div className="db-panel-head"><h2>Contact verification</h2><span className="db-count">Security</span></div>
        <div className="db-verification-grid">
          <div className="db-verification-item"><div className={`db-verification-badge ${user?.email_link_verified?'verified':''}`}>{user?.email_link_verified?'✓':'@'}</div><div><strong>Email address</strong><p>{user?.email||''}</p><small>{user?.email_link_verified?'Verified by confirmation link':'Confirmation link required'}</small></div>{!user?.email_link_verified&&<button className="db-link-btn" disabled={sendingEmail} onClick={sendVerificationEmail}>{sendingEmail?'Sending…':'Send verification link'}</button>}</div>
          <div className="db-verification-item"><div className="db-verification-badge">#</div><div><strong>Phone number</strong><p>{formatPhone(form.phone)||'Add a phone number below'}</p><small>SMS code verification will be added in the next phase.</small></div><span className="db-admin-status pending">Coming later</span></div>
        </div>
      </section>
      {message&&<div className="db-notice" style={{marginTop:16,marginBottom:0}}>{message}</div>}
      <div className="db-profile-layout" style={{marginTop:22}}>
        <section className="db-panel">
          <div className="db-panel-head"><h2>Account information</h2><span className={`db-admin-status ${isAdmin?'approved':profile?.status||'pending'}`}>{isAdmin?'Admin':statusLabel(profile?.status)}</span></div>
          <form className="db-form" onSubmit={save}><div className="db-form-grid">
            <Field label={isAdmin?'Admin name':isBroker?'Broker name':'Full name'} full><input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></Field>
            <Field label="Email address" full><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
            <Field label="Phone number" full><input required value={form.phone} onChange={e=>setForm({...form,phone:formatPhone(e.target.value)})}/></Field>
            {!isPoster&&!isAdmin&&<Field label="Public operating area" full><input required value={form.operating_area} onChange={e=>setForm({...form,operating_area:e.target.value})} placeholder="Example: NYC, Long Island, North Jersey"/></Field>}
            {profile?.company&&<Field label="Company" full><input value={profile.company} readOnly/></Field>}
          </div><div className="db-notice" style={{marginBottom:12}}>This updates the contact details on your profile. Your sign-in email is locked for security.</div><div className="db-form-actions"><button className="db-button" disabled={saving}>{saving?'Saving…':'Save information'}</button></div></form>
        </section>
        <aside className="db-panel">
          <div className="db-panel-head"><h2>Performance</h2></div>
          <div className="db-profile-stats">{stats.map(([label,value])=><div className="db-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          {!isPoster&&!isAdmin&&(()=>{const badges=computeDriverBadges(profile);return badges.length?<div className="db-chips" style={{padding:'0 20px 20px'}}>{badges.map(b=><span key={b.key} className="db-chip" title={b.label}>{b.emoji} {b.label}</span>)}</div>:null;})()}
        </aside>
      </div>
      {!isAdmin&&<section className="db-panel" style={{marginTop:22}}>
        <div className="db-panel-head"><h2>Payment history</h2><span className="db-count">{completed.length} completed {completed.length===1?'job':'jobs'}</span></div>
        <div className="db-side-body">
          <p className="db-job-meta" style={{margin:'0 0 14px'}}>{isPoster?'Download a statement of what you’ve paid, trip by trip — useful for your own records.':'Download a year-by-year summary of your completed jobs and payouts — useful for your own tax prep.'}</p>
          <button className="db-button" disabled={!completed.length} onClick={exportStatement}>{completed.length?`Download ${isPoster?'statement':'earnings summary'} (CSV)`:'No completed jobs yet'}</button>
        </div>
      </section>}
      <section className="db-panel" style={{marginTop:22}}>
        <div className="db-panel-head"><h2>Change password</h2><span className="db-count">Security</span></div>
        <div className="db-side-body">
          <p className="db-job-meta" style={{margin:'0 0 14px'}}>Update the password you use to sign in.</p>
          <button className="db-button" onClick={()=>navigate('/change-password')}>Change password →</button>
        </div>
      </section>
      <section className="db-panel" style={{marginTop:22,borderColor:'#f1cfd4'}}>
        <div className="db-panel-head"><h2>Delete account</h2><span className="db-count">Danger zone</span></div>
        <div className="db-side-body">
          <p className="db-job-meta" style={{margin:'0 0 14px'}}>Permanently delete your account and all associated data. This cannot be undone.</p>
          <button className="db-button danger" onClick={()=>setDeleteModal(true)}>Delete account</button>
        </div>
      </section>
      {!isAdmin&&<WalletPanel user={user}/>}
      <div className="db-profile-layout" style={{marginTop:22}}>
        <section className="db-panel"><div className="db-panel-head"><h2>Documents</h2>{!isAdmin&&<button className="db-link-btn" onClick={()=>navigate(isPoster?'/broker-application':'/?view=vetting')}>{profile?'Manage':'Complete vetting'}</button>}</div><div className="db-side-body">
          {documents.some(([,uri])=>uri)?documents.map(([label,uri])=><div className="db-document-row" key={label}><div><strong>{label}</strong><small>{uri?'Uploaded securely':'Not uploaded'}</small></div>{uri&&<button className="db-link-btn" onClick={()=>openDocument(uri)}>View</button>}</div>):<div className="db-empty"><strong>No documents uploaded</strong>Complete your vetting application to add documents.</div>}
        </div></section>
        <section className="db-panel"><div className="db-panel-head"><h2>Reviews</h2><span className="db-count">{reviews.length}</span></div><div className="db-side-body">
          {reviews.length?reviews.map(review=><article className="db-review" key={review.id}><strong>{'★'.repeat(Math.max(1,Math.min(5,Math.round(review.rating))))}</strong><p>{review.comment||'No written comment.'}</p><small>From {review.reviewer_name||review.reviewer_role}</small></article>):<div className="db-empty"><strong>No reviews yet</strong>Reviews appear after completed deliveries.</div>}
        </div></section>
      </div>
    </main>
      {deleteModal&&<Modal title="Delete account?" onClose={()=>setDeleteModal(false)}><div className="db-form"><div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>This action is permanent</strong><p>All your data will be permanently deleted: profile, trips, bids, wallet, documents, messages, and reviews. This cannot be undone.</p></div></div><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setDeleteModal(false)} disabled={deleting}>Cancel</button><button className="db-button danger" disabled={deleting} onClick={deleteAccount}>{deleting?'Deleting…':'Yes, delete my account'}</button></div></div></Modal>}
  </div>;
}
function Modal({title,onClose,children}){return <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="db-modal-card"><div className="db-modal-head"><h2>{title}</h2><button className="db-close" onClick={onClose} aria-label="Close">×</button></div>{children}</div></div>}
function Field({label,full=false,children}){return <div className={`db-field ${full?'full':''}`}><label>{label}</label>{children}</div>}