import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';
import { isDriveBidOwner } from '@/lib/ownerAccess';
import { formatPhone } from '@/lib/phone';
import MobileSelect from '@/components/MobileSelect';
import PullToRefresh from '@/components/PullToRefresh';
import TripDetailModal from '@/components/TripDetailModal';
import { motion } from 'framer-motion';
import { refundTripFunding } from '@/lib/wallet';

const publicDriverName=(name)=>{
  const parts=String(name||'Driver').trim().split(/\s+/).filter(Boolean);
  return parts.length>1?`${parts[0]} ${parts[parts.length-1][0].toUpperCase()}.`:parts[0]||'Driver';
};
const EMPTY_JOB={vehicle_info:'',pickup_location:'',delivery_location:'',pickup_date:'',pickup_time:'',return_plan:'',estimated_hours:2,minimum_rate:20,payment_method:'Relay wallet',notes:'',preferred_driver_id:'',preferred_driver_name:'',preferred_only:false};

export default function DriveBid(){
  const navigate=useNavigate();
  const [user,setUser]=useState(null);
  const [role,setRole]=useState('broker');
  const [impersonating,setImpersonating]=useState(false);
  const [actAsId]=useState(()=>new URLSearchParams(window.location.search).get('actAs'));
  const [deals,setDeals]=useState([]);
  const [bids,setBids]=useState([]);
  const [trips,setTrips]=useState([]);
  const [driver,setDriver]=useState(null);
  const [allDrivers,setAllDrivers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState(()=>new URLSearchParams(window.location.search).get('view')==='vetting'?'vetting':'jobs');
  const [jobModal,setJobModal]=useState(false);
  const [bidModal,setBidModal]=useState(false);
  const [bidsModal,setBidsModal]=useState(false);
  const [selected,setSelected]=useState(null);
  const [job,setJob]=useState(EMPTY_JOB);
  const [bidRate,setBidRate]=useState('');
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState('');
  const [menu,setMenu]=useState(false);
  const [detailTrip,setDetailTrip]=useState(null);
  const [cancelBidTarget,setCancelBidTarget]=useState(null);

  const notify=(message)=>{setToast(message);window.setTimeout(()=>setToast(''),2800)};

  const load=async(showLoader=false)=>{
    if(showLoader)setLoading(true);
    try{
      const realMe=await base44.auth.me();
      let actingUser=realMe;
      if(actAsId&&isDriveBidOwner(realMe)){
        const users=await base44.entities.User.filter({id:actAsId},'-created_date',1);
        actingUser=users[0]||realMe;
        setImpersonating(true);
      }else{
        setImpersonating(false);
        if(isDriveBidOwner(realMe)){navigate('/admin',{replace:true});return;}
      }
      setUser(actingUser);
      setRole(actingUser.account_type||'driver');
      const [allDeals,allBids,userTrips,driverList]=await Promise.all([
        base44.entities.Deal.list('-created_date',100),
        base44.entities.Bid.list('-created_date',500),
        actingUser.account_type==='driver'
          ? base44.entities.Trip.filter({driver_id:actingUser.id},'-created_date',250)
          : base44.entities.Trip.filter({broker_id:actingUser.id},'-created_date',250),
        base44.entities.Driver.list('-created_date',500)
      ]);
      setDeals(allDeals);
      setBids(allBids);
      setTrips(userTrips);
      setAllDrivers(driverList);
      const profiles=await base44.entities.Driver.filter({created_by_id:actingUser.id},'-created_date',1);
      setDriver(profiles[0]||null);
    }catch(error){console.error(error);notify('Unable to load marketplace data');}
    finally{setLoading(false);}
  };

  useEffect(()=>{
    load(true);
    let debounceTimer=null;
    const debouncedLoad=()=>{if(debounceTimer)window.clearTimeout(debounceTimer);debounceTimer=window.setTimeout(()=>load(),300);};
    const offDeals=base44.entities.Deal.subscribe((event)=>{
      debouncedLoad();
      if(event.type==='create')notify('A new delivery job was posted');
      if(event.type==='update'&&event.data?.status==='cancelled'&&event.data?.cancelled_by==='driver'){
        notify('A driver cancelled an accepted job. You can repost it from the cancelled list.');
        if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
          try{new Notification('Relay · Driver cancellation',{body:'An accepted job was cancelled by the driver. Open Relay to repost it.'});}catch(error){}
        }
      }
    });
    const offBids=base44.entities.Bid.subscribe(debouncedLoad);
    const offTrips=base44.entities.Trip.subscribe(debouncedLoad);
    return()=>{offDeals?.();offBids?.();offTrips?.();if(debounceTimer)window.clearTimeout(debounceTimer);};
  },[]);

  const openDeals=deals.filter(d=>d.status==='open'&&(!d.preferred_only||d.preferred_driver_id===user?.id));
  const shownBrokerDeals=deals.filter(d=>d.broker_id===user?.id&&d.status==='open');
  const bidCount=(id)=>bids.filter(b=>b.deal_id===id&&b.status!=='withdrawn').length;
  const lowestBid=(id)=>{
    const values=bids.filter(b=>b.deal_id===id&&b.status!=='withdrawn').map(b=>Number(b.hourly_rate)).filter(Number.isFinite);
    return values.length?Math.min(...values):null;
  };
  const acceptedBids=bids.filter(b=>b.driver_id===user?.id&&b.status==='accepted').map(b=>({...b,deal:deals.find(d=>d.id===b.deal_id),trip:trips.find(t=>t.bid_id===b.id)}));
  const activeTrips=trips.filter(t=>['scheduled','in_progress','paused'].includes(t.status));
  const cancelledDeals=deals.filter(d=>d.broker_id===user?.id&&d.status==='cancelled'&&!d.reposted_at);
  const brokerJobCounts={
    open:deals.filter(d=>d.broker_id===user?.id&&d.status==='open').length,
    assigned:deals.filter(d=>d.broker_id===user?.id&&d.status==='assigned').length,
    completed:deals.filter(d=>d.broker_id===user?.id&&d.status==='completed').length
  };
  const completedTrips=trips.filter(t=>t.status==='completed');
  const pastDriversMap={};
  completedTrips.forEach(t=>{
    const id=t.driver_id; if(!id)return;
    const name=publicDriverName(t.driver_name||allDrivers.find(d=>d.created_by_id===id)?.full_name||'Driver');
    if(!pastDriversMap[id])pastDriversMap[id]={id,name,trips:0,lastDate:t.completed_at||t.created_date,lastTrip:t};
    pastDriversMap[id].trips+=1;
    const d=t.completed_at||t.created_date;
    if(d&&(!pastDriversMap[id].lastDate||d>pastDriversMap[id].lastDate)){pastDriversMap[id].lastDate=d;pastDriversMap[id].lastTrip=t;}
  });
  const pastDrivers=Object.values(pastDriversMap).sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||''));

  const openPost=async()=>{
    try{
      const profiles=await base44.entities.Broker.filter({created_by_id:user.id},'-created_date',1);
      const broker=profiles[0];
      if(broker?.status==='approved'){setJobModal(true);return;}
      const hasDocs=broker&&(broker.w9_document||broker.broker_license_document);
      if(!broker||!hasDocs){notify('Relay is awaiting your documents to get you approved.');navigate('/broker-application');}
      else{notify('Your broker application is awaiting approval. You can explore jobs meanwhile.');}
    }catch(error){notify(error.message||'Could not verify broker approval');}
  };

  const bookAgain=(pastDriver)=>{
    const last=pastDriver.lastTrip||{};
    const previous=deals.find(d=>d.id===last.deal_id)||{};
    setJob({...EMPTY_JOB,vehicle_info:previous.vehicle_info||last.vehicle_info||'',pickup_location:previous.pickup_location||last.pickup_location||'',delivery_location:previous.delivery_location||last.delivery_location||'',return_plan:previous.return_plan||'',estimated_hours:previous.estimated_hours||2,minimum_rate:previous.minimum_rate||previous.target_rate||last.accepted_rate||20,payment_method:previous.payment_method||last.payment_method||'Relay wallet',notes:previous.notes||'',preferred_driver_id:pastDriver.id,preferred_driver_name:pastDriver.name,preferred_only:true});
    setJobModal(true);
  };

  const postJob=async(e)=>{
    e.preventDefault();setSaving(true);
    const optimistic={...job,estimated_hours:Number(job.estimated_hours),minimum_rate:Number(job.minimum_rate),target_rate:Number(job.minimum_rate),is_lease_return:job.return_plan==='Lease return provided',uber_driver_back:job.return_plan==='Broker will Uber driver back',broker_id:user.id,broker_name:user.full_name||user.email,status:'open',id:`temp-${Date.now()}`,created_date:new Date().toISOString()};
    setDeals([optimistic,...deals]);
    setJob(EMPTY_JOB);setJobModal(false);notify('Job posted — drivers can now bid');
    try{
      await base44.entities.Deal.create(optimistic);
      await load();
    }catch(error){notify(error.message||'Could not post job');await load();}
    finally{setSaving(false);}
  };

  const openBid=(deal)=>{
    setSelected(deal);
    const current=lowestBid(deal.id);
    setBidRate(String(Math.max(Number(deal.minimum_rate||20),current?current-1:28)));
    setBidModal(true);
  };

  const placeBid=async(e)=>{
    e.preventDefault();
    const rate=Number(bidRate);
    const minimum=Number(selected.minimum_rate||0);
    if(rate<minimum){notify(`Minimum allowed bid is $${minimum}/hr`);return;}
    if(selected.preferred_only&&selected.preferred_driver_id!==user.id){notify('This opportunity is reserved for the broker’s preferred driver.');return;}
    setSaving(true);
    try{
      const existing=bids.find(b=>b.deal_id===selected.id&&b.driver_id===user.id&&b.status!=='withdrawn');
      const ownTrips=trips.filter(t=>t.driver_id===user.id);
      const completedJobs=ownTrips.filter(t=>t.status==='completed').length||Number(driver?.completed_deliveries||0);
      const cancelledTrips=ownTrips.filter(t=>t.status==='cancelled'&&t.cancelled_by==='driver').length||Number(driver?.cancelled_trips||0);
      const onTimeTrips=ownTrips.filter(t=>typeof t.started_on_time==='boolean');
      const onTimePercentage=onTimeTrips.length?Math.round((onTimeTrips.filter(t=>t.started_on_time).length/onTimeTrips.length)*1000)/10:Number(driver?.on_time_percentage??100);
      const cancellationRate=(completedJobs+cancelledTrips)>0?Math.round((cancelledTrips/(completedJobs+cancelledTrips))*1000)/10:0;
      const relevantExperience=[driver?.years_experience!=null?`${driver.years_experience} years experience`:null,driver?.vehicle_types,driver?.bio].filter(Boolean).join(' · ');
      const payload={deal_id:selected.id,driver_id:user.id,driver_name:publicDriverName(user.full_name||'Driver'),driver_operating_area:driver?.operating_area||driver?.home_location||'Area not provided',hourly_rate:rate,estimated_payout:rate*Number(selected.estimated_hours||0),driver_rating:Number(driver?.rating||5),completed_jobs:completedJobs,on_time_percentage:onTimePercentage,cancellation_rate:cancellationRate,relevant_experience:relevantExperience||'Verified delivery driver',vetting_status:driver?.status||'pending',status:'pending'};
      const tempId=existing?.id||`temp-${Date.now()}`;
      const optimistic={...payload,id:tempId,created_date:new Date().toISOString()};
      setBids(existing?bids.map(b=>b.id===existing.id?{...b,...optimistic}:b):[optimistic,...bids]);
      setBidModal(false);notify(existing?'Bid updated':'Bid submitted to broker');
      if(existing)await base44.entities.Bid.update(existing.id,payload); else await base44.entities.Bid.create(payload);
      await load();
    }catch(error){notify(error.message||'Could not place bid');await load();}
    finally{setSaving(false);}
  };

  const decideBid=async(bid,status)=>{
    setSaving(true);
    try{
      await base44.entities.Bid.update(bid.id,{status});
      if(status==='accepted'){
        await base44.entities.Deal.update(selected.id,{status:'assigned',assigned_driver_id:bid.driver_id,accepted_bid_id:bid.id});
        const existingTrips=await base44.entities.Trip.filter({bid_id:bid.id},'-created_date',1);
        if(!existingTrips[0])await base44.entities.Trip.create({
          deal_id:selected.id,bid_id:bid.id,broker_id:user.id,broker_name:user.full_name||user.email,
          driver_id:bid.driver_id,driver_name:bid.driver_name,vehicle_info:selected.vehicle_info,
          pickup_location:selected.pickup_location,delivery_location:selected.delivery_location,pickup_date:selected.pickup_date,pickup_time:selected.pickup_time,
          accepted_rate:Number(bid.hourly_rate),estimated_hours:Number(selected.estimated_hours||0),return_plan:selected.return_plan,job_notes:selected.notes||'',payment_method:selected.payment_method||'Relay wallet',funding_status:'pending',status:'scheduled',tracked_minutes:0,cancellation_fee_status:'not_applicable'
        });
        const others=bids.filter(x=>x.deal_id===selected.id&&x.id!==bid.id&&x.status==='pending');
        await Promise.all(others.map(x=>base44.entities.Bid.update(x.id,{status:'rejected'})));
      }
      notify(status==='accepted'?'Driver selected':'Bid declined');await load();
      if(status==='accepted')setBidsModal(false);
    }catch(error){notify(error.message||'Could not update bid');}
    finally{setSaving(false);}
  };

  const cancelAcceptedBid=async(b)=>{
    setSaving(true);
    try{
      const cancelledAt=new Date().toISOString();
      await base44.entities.Bid.update(b.id,{status:'withdrawn'});
      await base44.entities.Deal.update(b.deal_id,{status:'cancelled',cancelled_by:'driver',cancelled_at:cancelledAt});
      const trips=await base44.entities.Trip.filter({bid_id:b.id},'-created_date',1);
      if(trips[0]){await refundTripFunding(trips[0]);await base44.entities.Trip.update(trips[0].id,{status:'cancelled',cancelled_by:'driver',cancelled_at:cancelledAt,cancellation_fee_status:'policy_pending'});}
      if(driver)await base44.entities.Driver.update(driver.id,{cancelled_trips:(driver.cancelled_trips||0)+1});
      setCancelBidTarget(null);notify('Job cancelled. The broker has been alerted and can repost it.');await load();
    }catch(error){notify(error.message||'Could not cancel');}
    finally{setSaving(false);}
  };

  const brokerCancelJob=async(trip)=>{
    setSaving(true);
    try{
      const accepted=bids.find(x=>x.deal_id===trip.deal_id&&x.driver_id===trip.driver_id&&x.status==='accepted');
      if(accepted)await base44.entities.Bid.update(accepted.id,{status:'rejected'});
      const cancelledAt=new Date().toISOString();
      await base44.entities.Deal.update(trip.deal_id,{status:'cancelled',cancelled_by:'broker',cancelled_at:cancelledAt});
      await refundTripFunding(trip);
      await base44.entities.Trip.update(trip.id,{status:'cancelled',cancelled_by:'broker',cancelled_at:cancelledAt,cancellation_fee_status:'not_applicable'});
      notify('Job cancelled. You can repost it from the cancelled list.');await load();
    }catch(error){notify(error.message||'Could not cancel');}
    finally{setSaving(false);}
  };

  const repostDeal=async(deal)=>{
    setSaving(true);
    try{
      const copy={broker_id:user.id,broker_name:user.full_name||user.email,vehicle_info:deal.vehicle_info,pickup_location:deal.pickup_location,delivery_location:deal.delivery_location,pickup_date:deal.pickup_date,pickup_time:deal.pickup_time,return_plan:deal.return_plan,estimated_hours:Number(deal.estimated_hours||2),minimum_rate:Number(deal.minimum_rate||deal.target_rate||20),target_rate:Number(deal.minimum_rate||deal.target_rate||20),is_lease_return:Boolean(deal.is_lease_return),uber_driver_back:Boolean(deal.uber_driver_back),notes:deal.notes||'',status:'open',preferred_driver_id:'',preferred_driver_name:'',preferred_only:false,reposted_from_deal_id:deal.id};
      const created=await base44.entities.Deal.create(copy);
      await base44.entities.Deal.update(deal.id,{reposted_at:new Date().toISOString(),reposted_as_deal_id:created.id});
      notify('A fresh copy was posted to the load board. Previous bids were not carried over.');await load();
    }catch(error){notify(error.message||'Could not repost');}
    finally{setSaving(false);}
  };

  const submitVetting=async(e)=>{
    e.preventDefault();setSaving(true);
    const form=new FormData(e.currentTarget);
    try{
      const uploadField=async(name,existing)=>{
        const file=form.get(name);
        if(file&&file.size){const uploaded=await base44.integrations.Core.UploadPrivateFile({file});return uploaded.file_uri;}
        return existing||'';
      };
      const [license_front,license_back,driving_history_report]=await Promise.all([
        uploadField('license_front',driver?.license_front),
        uploadField('license_back',driver?.license_back),
        uploadField('driving_history_report',driver?.driving_history_report)
      ]);
      const payload={
        full_name:user.full_name||form.get('full_name'),email:user.email,phone:form.get('phone'),
        license_state:form.get('license_state'),license_number:form.get('license_number'),
        license_expiration:form.get('license_expiration'),license_front,license_back,driving_history_report,
        driving_history_consent:true,operating_area:form.get('operating_area'),
        rating:driver?.rating||5,completed_deliveries:driver?.completed_deliveries||0,response_rate:driver?.response_rate||100
      };
      const saved=driver?await base44.entities.Driver.update(driver.id,payload):await base44.entities.Driver.create(payload);
      setDriver(saved);setView('jobs');notify('Application submitted for review');
    }catch(error){notify(error.message||'Could not submit application');}
    finally{setSaving(false);}
  };

  const initials=(user?.full_name||user?.email||'DB').split(/\s|@/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const approved=driver?.status==='approved';
  const progress=approved?100:driver?75:35;
  const driverInfo=(bid)=>{
    const d=allDrivers.find(x=>x.created_by_id===bid.driver_id);
    const completed=Number(bid.completed_jobs??d?.completed_deliveries??0);
    const cancelled=Number(d?.cancelled_trips||0);
    return {name:publicDriverName(bid.driver_name||d?.full_name||'Verified driver'),operatingArea:bid.driver_operating_area||d?.operating_area||d?.home_location||'Area not provided',vetted:(bid.vetting_status||d?.status)==='approved',rating:Number(bid.driver_rating??d?.rating??5),completed,onTime:Number(bid.on_time_percentage??d?.on_time_percentage??100),cancellationRate:Number(bid.cancellation_rate??((completed+cancelled)>0?(cancelled/(completed+cancelled))*100:0)),experience:bid.relevant_experience||[d?.years_experience!=null?`${d.years_experience} years experience`:null,d?.vehicle_types,d?.bio].filter(Boolean).join(' · ')||'Verified delivery driver'};
  };
  const rankedBids=useMemo(()=>{
    if(!selected)return [];
    const rows=bids.filter(b=>b.deal_id===selected.id&&b.status!=='withdrawn');
    const rates=rows.map(b=>Number(b.hourly_rate||0)).filter(x=>x>0);
    const minRate=rates.length?Math.min(...rates):1;
    return rows.map(b=>{const info=driverInfo(b);const price=Math.min(1,minRate/Math.max(1,Number(b.hourly_rate||0)));const score=(price*.35)+(Math.min(1,info.rating/5)*.25)+(Math.min(1,info.onTime/100)*.2)+(Math.min(1,info.completed/20)*.1)+(Math.max(0,1-info.cancellationRate/100)*.1);return {...b,_info:info,_valueScore:score};}).sort((a,b)=>b._valueScore-a._valueScore||Number(a.hourly_rate)-Number(b.hourly_rate));
  },[bids,selected,allDrivers]);

  if(loading)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading Relay…</span></div></div>;

  return <div className="db-shell">
    <header className="db-topbar">
      <div className="db-brand"><div className="db-brandmark">R</div><span>Relay</span></div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:14}}>
        {impersonating&&<button className="db-button secondary" onClick={()=>navigate('/admin')}>Exit to admin</button>}
        {isDriveBidOwner(user)&&<button className="db-admin-toplink" onClick={()=>navigate('/admin')}>Admin</button>}
        <button className="db-avatar" onClick={()=>setMenu(!menu)} aria-label="Account menu">{initials}</button>
      </div>
    </header>
    {menu&&<div className="db-user-menu">
      <button onClick={()=>navigate('/profile')}>My profile</button>
      {role==='driver'&&<button onClick={()=>navigate('/trips')}>My trips</button>}
      {role==='driver'&&<button onClick={()=>{setView('vetting');setMenu(false)}}>Driver application</button>}
      {role==='broker'&&<button onClick={()=>navigate('/broker-application')}>Broker application</button>}
      {isDriveBidOwner(user)&&<button onClick={()=>navigate('/admin')}>Admin dashboard</button>}
      <button onClick={()=>base44.auth.logout(window.location.origin+'/login')}>Sign out</button>
    </div>}

    <main className="db-page">
      <PullToRefresh onRefresh={load}>
      {impersonating&&<div className="db-trip-notice"><strong>Admin preview:</strong> You are viewing and acting as {user?.full_name||user?.email} ({role}). Changes are recorded under this account. <button className="db-link-btn" style={{marginLeft:8}} onClick={()=>navigate('/admin')}>Exit to admin</button></div>}
      {role==='driver'&&view==='vetting'?<VettingView driver={driver} progress={progress} onBack={()=>setView('jobs')} onSubmit={submitVetting} saving={saving} user={user}/>:
      role==='broker'?<BrokerView deals={shownBrokerDeals} bids={bids} bidCount={bidCount} lowestBid={lowestBid} onPost={openPost} onView={(deal)=>{setSelected(deal);setBidsModal(true)}} activeTrips={activeTrips} completedTrips={completedTrips} pastDrivers={pastDrivers} cancelledDeals={cancelledDeals} jobCounts={brokerJobCounts} onRepost={repostDeal} onBrokerCancel={brokerCancelJob} onOpenTrip={()=>navigate('/trips')} onBookAgain={bookAgain} busy={saving}/>:
      <DriverView deals={openDeals} bidCount={bidCount} lowestBid={lowestBid} driver={driver} approved={approved} onVetting={()=>setView('vetting')} onBid={openBid} acceptedBids={acceptedBids} onCancelBid={setCancelBidTarget} busy={saving} onGoToTrips={()=>navigate('/trips')}/>}
    </PullToRefresh></main>

    {jobModal&&<Modal title="Post a delivery" onClose={()=>setJobModal(false)}>
      <form className="db-form" onSubmit={postJob}>
        {job.preferred_only&&<div className="db-alert"><div className="db-alert-icon">✓</div><div><strong>Preferred-driver invitation</strong><p>This opportunity will be visible only to {job.preferred_driver_name}. Remove the preference to post it to the full load board.</p></div><button type="button" className="db-link-btn" onClick={()=>setJob({...job,preferred_driver_id:'',preferred_driver_name:'',preferred_only:false})}>Post publicly instead</button></div>}
        <div className="db-form-grid">
          <Field label="Vehicle" full><input value={job.vehicle_info} onChange={e=>setJob({...job,vehicle_info:e.target.value})} placeholder="2026 BMW X3" required/></Field>
          <Field label="Pickup location"><input value={job.pickup_location} onChange={e=>setJob({...job,pickup_location:e.target.value})} placeholder="Dealership or full address" required/></Field>
          <Field label="Delivery location"><input value={job.delivery_location} onChange={e=>setJob({...job,delivery_location:e.target.value})} placeholder="Customer or full address" required/></Field>
          <Field label="Pickup date"><input type="date" value={job.pickup_date} onChange={e=>setJob({...job,pickup_date:e.target.value})} required/></Field>
          <Field label="Pickup window"><input type="time" value={job.pickup_time} onChange={e=>setJob({...job,pickup_time:e.target.value})} required/></Field>
          <Field label="Driver’s return arrangement" full><MobileSelect value={job.return_plan} onChange={v=>setJob({...job,return_plan:v})} placeholder="Select one" required><option value="">Select one</option><option>Lease return provided</option><option>Broker will Uber driver back</option><option>Driver arranges own return</option></MobileSelect></Field>
          <Field label="Estimated job time"><MobileSelect value={job.estimated_hours} onChange={v=>setJob({...job,estimated_hours:v})}>{[2,3,4,5,6,7,8].map(h=><option value={h} key={h}>{h} hours</option>)}</MobileSelect></Field>
          <Field label="Minimum hourly bid"><input type="number" min="15" value={job.minimum_rate} onChange={e=>setJob({...job,minimum_rate:e.target.value})} required/></Field>
          <Field label="Payment method"><MobileSelect value={job.payment_method} onChange={v=>setJob({...job,payment_method:v})} required><option>Relay wallet</option></MobileSelect></Field>
          <Field label="Other relevant information" full><textarea value={job.notes} onChange={e=>setJob({...job,notes:e.target.value})} placeholder="Tolls, paperwork, plates, customer handoff instructions, or other details"/></Field>
        </div>
        <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setJobModal(false)}>Cancel</button><button className="db-button" disabled={saving}>{saving?'Posting…':job.preferred_only?`Invite ${job.preferred_driver_name}`:'Alert vetted drivers'}</button></div>
      </form>
    </Modal>}

    {bidModal&&selected&&<Modal title="Submit your bid" onClose={()=>setBidModal(false)}>
      <div className="db-form"><strong>{selected.vehicle_info}</strong><p style={{color:'var(--db-muted)',marginBottom:0}}>{selected.pickup_location} → {selected.delivery_location} · {selected.estimated_hours} estimated hours</p></div>
      {!approved?(()=>{const hasDocs=driver&&(driver.license_front&&driver.license_back&&driver.driving_history_report);return <div className="db-bid-box"><div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>{hasDocs?'Approval in progress':'Documents required'}</strong><p>{hasDocs?'Your application is awaiting approval. You can explore jobs but cannot bid until approved.':'Upload your license (front & back) and driving history to get approved for bidding.'}</p></div></div>{hasDocs?<button className="db-button secondary" onClick={()=>setBidModal(false)}>Got it</button>:<button className="db-button" onClick={()=>{setBidModal(false);setView('vetting')}}>Upload documents</button>}</div>;})():
      <form className="db-bid-box" onSubmit={placeBid}><div className="db-bid-row"><Field label="Your hourly rate"><input type="number" min={selected.minimum_rate||0} value={bidRate} onChange={e=>setBidRate(e.target.value)} required/></Field><Field label="Estimated payout"><input value={`$${(Number(bidRate||0)*Number(selected.estimated_hours||0)).toFixed(0)} estimated`} readOnly/></Field><button className="db-button" disabled={saving}>{saving?'Submitting…':'Place bid'}</button></div></form>}
    </Modal>}

    {bidsModal&&selected&&<Modal title="Compare driver bids" onClose={()=>setBidsModal(false)}>
      <div className="db-notice">Contact details remain private until a driver is selected. Best Value weighs rate, rating, on-time performance, completed jobs, cancellations, and vetting.</div>
      <div className="db-bids db-bid-comparison">
        {rankedBids.length===0?<div className="db-empty"><strong>No bids yet</strong>Approved drivers will be alerted to this job.</div>:
        rankedBids.map((b,index)=>{
          const info=b._info;
          const estimated=Number(b.hourly_rate||0)*Number(selected.estimated_hours||0);
          return <div className={`db-bid-item db-bid-detailed ${index===0?'best-value':''}`} key={b.id}>
            <div className="db-bid-avatar">{(info.name||'D')[0].toUpperCase()}</div>
            <div className="db-bid-info">
              <div className="db-bid-title"><strong>{info.name}</strong>{index===0&&<span className="db-best-value">Best Value</span>}<span className={`db-admin-status ${info.vetted?'approved':'pending'}`}>{info.vetted?'Vetted':'Pending review'}</span></div>
              <div className="db-bid-metrics">
                <span><strong>${Number(b.hourly_rate||0).toFixed(2)}/hr</strong> Hourly rate</span>
                <span><strong>${estimated.toFixed(2)}</strong> Estimated total</span>
                <span><strong>{info.rating.toFixed(1)} / 5</strong> Driver rating</span>
                <span><strong>{info.completed}</strong> Completed jobs</span>
                <span><strong>{info.onTime.toFixed(0)}%</strong> On-time</span>
                <span><strong>{info.cancellationRate.toFixed(1)}%</strong> Cancellation rate</span>
              </div>
              <small className="db-bid-experience"><strong>Operating area:</strong> {info.operatingArea}</small>
              <small className="db-bid-experience"><strong>Relevant experience:</strong> {info.experience}</small>
            </div>
            {b.status==='pending'?<div className="db-inline-actions db-bid-actions"><button className="db-small-btn" disabled={saving} onClick={()=>decideBid(b,'accepted')}>Accept bid</button><button className="db-small-btn" style={{background:'#fff0f1',color:'var(--db-danger)'}} disabled={saving} onClick={()=>decideBid(b,'rejected')}>Decline</button></div>:<span className={`db-admin-status ${b.status==='accepted'?'approved':'pending'}`}>{b.status}</span>}
          </div>;
        })}
      </div>
    </Modal>}
    {cancelBidTarget&&<Modal title="Cancel accepted job?" onClose={()=>setCancelBidTarget(null)}><div className="db-form"><div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>This cancellation will be recorded</strong><p>Your cancellation rate will increase and the broker will be alerted. A cancellation fee may apply after DriveBid’s fee amount and collection policy are formally activated.</p></div></div><p className="db-job-meta">Do you want to continue cancelling this accepted job?</p><div className="db-form-actions"><button className="db-button secondary" onClick={()=>setCancelBidTarget(null)} disabled={saving}>Keep job</button><button className="db-button danger" onClick={()=>cancelAcceptedBid(cancelBidTarget)} disabled={saving}>{saving?'Cancelling…':'Yes, cancel job'}</button></div></div></Modal>}
    {detailTrip&&<TripDetailModal trip={detailTrip} deals={deals} bids={bids} onClose={()=>setDetailTrip(null)} onChanged={load}/>}
    {toast&&<div className="db-toast" role="status">{toast}</div>}
  </div>;
}

function BrokerView({deals,bids,bidCount,lowestBid,onPost,onView,activeTrips,completedTrips,pastDrivers,cancelledDeals,jobCounts,onRepost,onBrokerCancel,onOpenTrip,onBookAgain,busy}){
  return <><div className="db-heading-row"><div><div className="db-eyebrow">Broker workspace</div><h1>Delivery jobs</h1><p>Post a route, track active trips, and review drivers you've worked with.</p></div><button className="db-button" onClick={onPost}>+ Post a delivery</button></div>
  {activeTrips?.length>0&&<section className="db-panel" style={{marginBottom:22}}><div className="db-panel-head"><h2>Active trips</h2><span className="db-count">{activeTrips.length}</span></div><div className="db-side-body">{activeTrips.map(t=>{const started=t.status==='in_progress';return <div key={t.id} style={{marginBottom:12}}><div className={`db-alert ${started?'':'pending'}`} style={{marginBottom:6}}><div className="db-alert-icon">{started?'✓':'!'}</div><div><strong>{started?'Driver has started the job':'Trip assigned — waiting for driver to start'}</strong><p>{t.vehicle_info||'Vehicle'} · {t.pickup_location||'—'} → {t.delivery_location||'—'} · Driver: {t.driver_name||'—'}</p></div></div><div className="db-inline-actions"><button className="db-button secondary" onClick={()=>onOpenTrip(t)}>View details</button><button className="db-button danger" disabled={busy} onClick={()=>onBrokerCancel(t)}>Cancel job</button></div></div>;})}</div></section>}
  {completedTrips?.length>0&&<section className="db-panel" style={{marginBottom:22}}><div className="db-panel-head"><h2>Past jobs</h2><span className="db-count">{completedTrips.length}</span></div><div className="db-side-body">{completedTrips.map(t=><div key={t.id} style={{marginBottom:12}}><div className="db-alert" style={{marginBottom:6}}><div className="db-alert-icon">✓</div><div><strong>{t.vehicle_info||'Vehicle'}</strong><p>{t.pickup_location||'—'} → {t.delivery_location||'—'} · Driver: {t.driver_name||'—'}{t.completed_at?` · ${new Date(t.completed_at).toLocaleDateString()}`:''}</p></div></div><button className="db-button secondary" onClick={()=>onOpenTrip(t)}>View details & pay</button></div>)}</div></section>}
  {cancelledDeals?.length>0&&<section className="db-panel" style={{marginBottom:22}}><div className="db-panel-head"><h2>Cancelled jobs</h2><span className="db-count">{cancelledDeals.length}</span></div><div className="db-side-body">{cancelledDeals.map(d=><div key={d.id} style={{marginBottom:12}}><div className="db-alert pending" style={{marginBottom:6}}><div className="db-alert-icon">!</div><div><strong>{d.cancelled_by==='driver'?'Driver cancelled — repost available':d.vehicle_info||'Vehicle'}</strong><p>{d.pickup_location||'—'} → {d.delivery_location||'—'} · {d.cancelled_by==='driver'?'The cancellation was recorded on the driver’s profile. Post a fresh copy to alert the load board.':'This job was cancelled and can be reposted.'}</p></div></div><button className="db-button secondary" onClick={()=>onRepost(d)}>Repost to load board</button></div>)}</div></section>}
  <div className="db-grid"><div className="db-panel"><div className="db-panel-head"><h2>Posted jobs</h2><span className="db-count">{deals.length} open</span></div><div className="db-job-list">{deals.length?deals.map(d=><JobCard key={d.id} deal={d} count={bidCount(d.id)} low={lowestBid(d.id)} action="View bids" onAction={()=>onView(d)}/>):<Empty broker/>}</div></div>
  <aside className="db-panel"><div className="db-panel-head"><h2>At a glance</h2></div><div className="db-stats"><Stat value={jobCounts?.open??deals.length} label="Open jobs"/><Stat value={jobCounts?.assigned??0} label="Assigned jobs"/><Stat value={jobCounts?.completed??0} label="Completed jobs"/></div><div className="db-side-body"><div className="db-mini-title">Drivers you've used</div>{pastDrivers?.length?pastDrivers.map(d=><div className="db-status-row" key={d.id} style={{alignItems:'flex-start'}}><div><strong>{d.name}</strong><small style={{display:'block',color:'var(--db-muted)'}}>{d.trips} trip{d.trips===1?'':'s'}</small></div><button className="db-small-btn" onClick={()=>onBookAgain(d)}>Book again</button></div>):<div className="db-empty"><strong>No past drivers yet</strong>Drivers you've worked with appear here after a job is completed.</div>}</div></aside></div></>;
}

function DriverView({deals,bidCount,lowestBid,driver,approved,onVetting,onBid,acceptedBids,onCancelBid,busy,onGoToTrips}){
  return <><div className="db-heading-row"><div><div className="db-eyebrow">Driver marketplace</div><h1>Nearby opportunities</h1><p>Bid your hourly rate on delivery jobs that fit your schedule.</p></div><button className="db-button secondary" onClick={onVetting}>View vetting status</button></div>
  {acceptedBids?.length>0&&<section className="db-panel" style={{marginBottom:22}}><div className="db-panel-head"><h2>Accepted jobs</h2><span className="db-count">{acceptedBids.length}</span></div><div className="db-side-body">{acceptedBids.map(b=><div key={b.id} style={{marginBottom:12}}><div className="db-alert" style={{marginBottom:6}}><div className="db-alert-icon">{b.trip?.funding_status==='confirmed'?'✓':'!'}</div><div><strong>{b.trip?.funding_status==='confirmed'?'Funding confirmed — complete pickup record':'Your bid was accepted — awaiting broker funding'}</strong><p>{b.deal?`${b.deal.vehicle_info||'Delivery'} · ${b.deal.pickup_location||'—'} → ${b.deal.delivery_location||'—'}`:'The broker accepted your bid.'} · Accepted rate ${Number(b.hourly_rate||0).toFixed(0)}/hr</p></div></div><button className="db-button danger" disabled={busy} onClick={()=>onCancelBid(b)}>Cancel this job</button></div>)}<button className="db-button" onClick={onGoToTrips} style={{marginTop:6}}>Go to my trips →</button></div></section>}
  <div className="db-grid"><div className="db-panel"><div className="db-panel-head"><h2>Available jobs</h2><span className="db-count">Alerts on</span></div><div className="db-job-list">{deals.length?deals.map(d=><JobCard key={d.id} deal={d} count={bidCount(d.id)} low={lowestBid(d.id)} action="Bid on job" onAction={()=>onBid(d)}/>):<Empty/>}</div></div>
  <aside className="db-panel"><div className="db-panel-head"><h2>Your profile</h2></div><div className="db-side-body"><div className={`db-alert ${approved?'':'pending'}`}><div className="db-alert-icon">{approved?'✓':'!'}</div><div><strong>{approved?'Verified driver':driver?'Review in progress':'Vetting required'}</strong><p>{approved?'Your profile can receive alerts and bid on open jobs.':driver?'Your application is waiting for review.':'Complete your application before bidding.'}</p></div></div><div className="db-mini-title">Marketplace standing</div><div className="db-status-row">Completed deliveries <span>{driver?.completed_deliveries||0}</span></div><div className="db-status-row">Driver rating <span>{Number(driver?.rating||5).toFixed(1)} / 5</span></div><div className="db-status-row">Response rate <span>{driver?.response_rate||100}%</span></div>
<div className="db-status-row">On-time percentage <span>{Number(driver?.on_time_percentage??100).toFixed(0)}%</span></div><div className="db-status-row">Cancellation rate <span>{(()=>{const c=Number(driver?.cancelled_trips||0),n=Number(driver?.completed_deliveries||0)+c;return n?`${((c/n)*100).toFixed(1)}%`:'0.0%'})()}</span></div></div></aside></div></>;
}

function VettingView({driver,progress,onBack,onSubmit,saving,user}){
  return <><div className="db-heading-row"><div><div className="db-eyebrow">Driver application</div><h1>Vetting status</h1><p>Complete each requirement before you can bid on jobs.</p></div><button className="db-button secondary" onClick={onBack}>← Back to jobs</button></div>
  <div className="db-verify-wrap"><div className="db-panel db-verify-card"><strong>Application progress</strong><div className="db-progress"><span style={{width:`${progress}%`}}/></div><ul className="db-checklist"><Check done text="Identity confirmed" sub="Account and email confirmed"/><Check done={Boolean(driver?.license_state)} text="Driver’s license" sub={driver?'License details received':'License details required'}/><Check done={Boolean(driver?.driving_history_consent)} text="Driving history" sub="Authorization required"/><Check done={driver?.status==='approved'} text="Eligibility review" sub={driver?.status==='approved'?'Approved to bid':'Completed by administrator'}/></ul></div>
  <div className="db-panel"><div className="db-panel-head"><h2>Driver application</h2></div><form className="db-form" onSubmit={onSubmit}><div className="db-notice">License files are stored privately. Access should remain limited to authorized application reviewers.</div><div className="db-form-grid"><Field label="Full name" full><input name="full_name" defaultValue={driver?.full_name||user?.full_name||''} required/></Field><Field label="Phone number"><input name="phone" defaultValue={driver?.phone||''} onChange={e=>{e.target.value=formatPhone(e.target.value)}} inputMode="tel" placeholder="(555) 123-4567" required/></Field><Field label="Operating area"><input name="operating_area" defaultValue={driver?.operating_area||driver?.home_location||''} placeholder="Example: NYC, Long Island, North Jersey" required/></Field><Field label="License state"><MobileSelect name="license_state" defaultValue={driver?.license_state||''} placeholder="Select state" required><option value="">Select state</option><option>New York</option><option>New Jersey</option><option>Other</option></MobileSelect></Field><Field label="License number"><input name="license_number" defaultValue={driver?.license_number||''} required/></Field><Field label="License expiration"><input name="license_expiration" type="date" defaultValue={driver?.license_expiration||''} required/></Field><Field label="Driver's License — Front" full><input name="license_front" type="file" accept="image/*,.pdf" required={!driver?.license_front}/></Field>
<Field label="Driver's License — Back" full><input name="license_back" type="file" accept="image/*,.pdf" required={!driver?.license_back}/></Field>
<Field label="Driver's Abstract (Driving History)" full><input name="driving_history_report" type="file" accept="image/*,.pdf" required={!driver?.driving_history_report}/></Field><Field label="Authorization" full><label style={{display:'flex',alignItems:'center',gap:8,fontWeight:600}}><input type="checkbox" required defaultChecked={Boolean(driver?.driving_history_consent)} style={{width:'auto'}}/>I authorize an approved provider to review my driving history.</label></Field></div><div className="db-form-actions"><button className="db-button" disabled={saving}>{saving?'Submitting…':'Submit for review'}</button></div></form></div></div></>;
}

function JobCard({deal,count,low,action,onAction}){
  const date=[deal.pickup_date,deal.pickup_time].filter(Boolean).join(' · ')||'Time pending';
  return <article className="db-job"><div className="db-job-top"><div className="db-route"><div className="db-route-line"><span className="db-dot"/><span className="db-stem"/><span className="db-dot end"/></div><div><strong>{deal.pickup_location}</strong><small>Pickup</small><div style={{height:13}}/><strong>{deal.delivery_location}</strong><small>Delivery</small></div></div><div className="db-job-price"><strong>{low?`$${low}/hr`:'No bids'}</strong><span>{low?'current low bid':'be the first'}</span></div></div><div className="db-chips"><span className="db-chip">{deal.vehicle_info||'Vehicle pending'}</span><span className="db-chip">{date}</span><span className="db-chip">Est. {deal.estimated_hours||'?'} hrs</span><span className="db-chip">{deal.return_plan||'Return plan pending'}</span>{deal.preferred_only&&<span className="db-chip">Preferred: {deal.preferred_driver_name||'selected driver'}</span>}</div>{deal.notes&&<p className="db-job-meta" style={{margin:'0 0 13px'}}>{deal.notes}</p>}<div className="db-job-footer"><span className="db-job-meta">{count} bid{count===1?'':'s'} · Minimum ${deal.minimum_rate||deal.target_rate||0}/hr</span><button className="db-link-btn" onClick={onAction}>{action}</button></div></article>;
}
function Empty({broker=false}){return <div className="db-empty"><strong>{broker?'No delivery jobs posted':'No open jobs right now'}</strong>{broker?'Post your first route to alert vetted drivers.':'You will be alerted when a broker posts a route.'}</div>}
function Stat({value,label}){return <div className="db-stat"><strong>{value}</strong><span>{label}</span></div>}
function Status({text}){return <div className="db-status-row"><div className="db-status-dot"/>{text}<span>Required</span></div>}
function Check({done,text,sub}){return <li><span className={`db-check ${done?'':'pending'}`}>{done?'✓':'!'}</span><div><strong>{text}</strong><br/><small>{sub}</small></div></li>}
function Field({label,full=false,children}){return <div className={`db-field ${full?'full':''}`}><label>{label}</label>{children}</div>}
function Modal({title,onClose,children}){return <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><motion.div className="db-modal-card" initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} transition={{duration:0.2,ease:'easeOut'}}><div className="db-modal-head"><h2>{title}</h2><button className="db-close" onClick={onClose} aria-label="Close">×</button></div>{children}</motion.div></div>}