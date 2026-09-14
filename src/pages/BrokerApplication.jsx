import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';
import { formatPhone } from '@/lib/phone';

export default function BrokerApplication(){
  const navigate=useNavigate();
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [form,setForm]=useState({company:'',phone:'',mc_number:'',business_address:''});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{(async()=>{
    try{
      const current=await base44.auth.me();
      setUser(current);
      const records=await base44.entities.Broker.filter({created_by_id:current.id},'-created_date',1);
      if(records[0]){
        setProfile(records[0]);
        setForm({company:records[0].company||'',phone:formatPhone(records[0].phone||''),mc_number:records[0].mc_number||'',business_address:records[0].business_address||''});
      }
    }catch(error){setMessage(error.message||'Could not load your broker application');}
    finally{setLoading(false);}
  })();},[]);

  const submit=async(e)=>{
    e.preventDefault();setSaving(true);setMessage('');
    const files=new FormData(e.currentTarget);
    try{
      const uploadField=async(name,existing)=>{
        const file=files.get(name);
        if(file&&file.size){const uploaded=await base44.integrations.Core.UploadPrivateFile({file});return uploaded.file_uri;}
        return existing||'';
      };
      const [w9_document,broker_license_document]=await Promise.all([
        uploadField('w9_document',profile?.w9_document),
        uploadField('broker_license_document',profile?.broker_license_document)
      ]);
      const payload={...form,full_name:user.full_name||user.email,email:user.email,w9_document,broker_license_document};
      const saved=profile?await base44.entities.Broker.update(profile.id,payload):await base44.entities.Broker.create(payload);
      setProfile(saved);setMessage(saved.status==='approved'?'Broker profile updated.':'Application submitted. An administrator must approve it before jobs can be posted.');
    }catch(error){setMessage(error.message||'Could not save the broker application');}
    finally{setSaving(false);}
  };

  if(loading)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading broker application…</span></div></div>;
  const approved=profile?.status==='approved';
  return <div className="db-shell">
    <header className="db-topbar"><div className="db-brand"><div className="db-brandmark">R</div><span>Relay</span></div><button className="db-button secondary db-admin-back" onClick={()=>navigate(-1)}>← Back</button></header>
    <main className="db-page">
      <div className="db-heading-row"><div><div className="db-eyebrow">Broker onboarding</div><h1>Broker application</h1><p>Complete your company profile before posting delivery jobs.</p></div></div>
      <div className="db-verify-wrap">
        <section className="db-panel db-verify-card"><strong>Approval status</strong><div className={`db-alert ${approved?'':'pending'}`} style={{marginTop:18}}><div className="db-alert-icon">{approved?'✓':'!'}</div><div><strong>{approved?'Approved broker':profile?.status==='rejected'?'Changes required':profile?'Review in progress':'Application required'}</strong><p>{approved?'You can post jobs in the marketplace.':profile?.status==='rejected'?'Update and resubmit your company information.':profile?'The Relay administrator will review your application.':'Submit your business information for review.'}</p></div></div></section>
        <section className="db-panel"><div className="db-panel-head"><h2>Company information</h2></div><form className="db-form" onSubmit={submit}><div className="db-form-grid">
          <Field label="Company name" full><input required value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></Field>
          <Field label="Contact phone"><input required value={form.phone} onChange={e=>setForm({...form,phone:formatPhone(e.target.value)})}/></Field>
          <Field label="Business address" full><input value={form.business_address} onChange={e=>setForm({...form,business_address:e.target.value})}/></Field>
          <Field label="W-9 (required)" full><input name="w9_document" type="file" accept=".pdf,image/*" required={!profile?.w9_document}/><small>{profile?.w9_document?'A W-9 is already stored securely. Upload a file only to replace it.':'PDF or image. Stored privately for administrator review.'}</small></Field>
          <Field label="Broker’s license (optional)" full><input name="broker_license_document" type="file" accept=".pdf,image/*"/><small>{profile?.broker_license_document?'A broker license is already stored securely.':'Optional supporting document.'}</small></Field>
        </div>{message&&<div className="db-notice" style={{marginTop:16}}>{message}</div>}<div className="db-form-actions"><button className="db-button" disabled={saving}>{saving?'Saving…':approved?'Save changes':'Submit for approval'}</button></div></form></section>
      </div>
    </main>
  </div>;
}
function Field({label,full=false,children}){return <div className={`db-field ${full?'full':''}`}><label>{label}</label>{children}</div>}