import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';
import { isDriveBidOwner } from '@/lib/ownerAccess';
import ApplicantProfileModal from '@/components/ApplicantProfileModal';
import JobManager from '@/components/JobManager';
import TripDetailModal from '@/components/TripDetailModal';
import { formatPhone } from '@/lib/phone';
import { approveTransaction, rejectTransaction, refundTripFunding, money } from '@/lib/wallet';

const dateText=(value)=>value?new Date(value).toLocaleDateString():'—';
const statusClass=(status)=>`db-admin-status ${status||'pending'}`;
const PAGE_SIZE=100;
const ENTITY_KEYS=['users','brokers','drivers','deals','bids','trips','reviews','walletTxns','wallets','incidents'];
const ENTITY_NAMES={users:'User',brokers:'Broker',drivers:'Driver',deals:'Deal',bids:'Bid',trips:'Trip',reviews:'Review',walletTxns:'WalletTransaction',wallets:'Wallet',incidents:'TripIncident'};

export default function AdminDashboard(){
  const navigate=useNavigate();
  const [me,setMe]=useState(null);
  const [data,setData]=useState({users:[],brokers:[],drivers:[],deals:[],bids:[],trips:[],reviews:[],walletTxns:[],wallets:[],incidents:[]});
  const [tab,setTab]=useState('overview');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [approvalFilter,setApprovalFilter]=useState('pending');
  const [selected,setSelected]=useState(null);
  const [selectedTrip,setSelectedTrip]=useState(null);
  const [menu,setMenu]=useState(false);
  const [hasMore,setHasMore]=useState({});
  const [loadingMore,setLoadingMore]=useState(false);
  const [resolvingIncident,setResolvingIncident]=useState(null);
  const [resolutionText,setResolutionText]=useState('');

  const load=async()=>{
    setError('');
    try{
      const user=await base44.auth.me();
      setMe(user);
      if(!isDriveBidOwner(user)){setLoading(false);return;}
      const results=await Promise.allSettled(
        ENTITY_KEYS.map(key=>base44.entities[ENTITY_NAMES[key]].list('-created_date',PAGE_SIZE+1))
      );
      const newData={};const more={};
      results.forEach((result,i)=>{
        const key=ENTITY_KEYS[i];
        const values=result.status==='fulfilled'?result.value:[];
        more[key]=values.length>PAGE_SIZE;
        newData[key]=values.slice(0,PAGE_SIZE);
      });
      setData(newData);setHasMore(more);
      if(results.some(r=>r.status==='rejected'))setError('Some records could not be loaded. Refresh or check your admin permissions.');
    }catch(err){setError(err.message||'Could not load the admin dashboard');}
    finally{setLoading(false);}
  };

  const loadMore=async()=>{
    setLoadingMore(true);
    try{
      const results=await Promise.allSettled(
        ENTITY_KEYS.map(key=>{
          if(!hasMore[key])return Promise.resolve([]);
          const records=data[key];
          const oldest=records.length?records[records.length-1].created_date:null;
          if(!oldest)return base44.entities[ENTITY_NAMES[key]].list('-created_date',PAGE_SIZE+1);
          return base44.entities[ENTITY_NAMES[key]].filter({created_date:{$lt:oldest}},'-created_date',PAGE_SIZE+1);
        })
      );
      const appended={};const more={...hasMore};
      results.forEach((result,i)=>{
        const key=ENTITY_KEYS[i];
        const values=result.status==='fulfilled'?result.value:[];
        if(!values.length){more[key]=false;return;}
        more[key]=values.length>PAGE_SIZE;
        appended[key]=[...(data[key]||[]),...values.slice(0,PAGE_SIZE)];
      });
      setData(prev=>({...prev,...appended}));setHasMore(more);
    }catch(err){setError(err.message||'Could not load more records');}
    finally{setLoadingMore(false);}
  };

  useEffect(()=>{load();},[]);

  const removeBrokerRole=async()=>{
    try{await base44.auth.updateMe({account_type:'admin'});setError('Your broker role has been removed.');await load();}
    catch(err){setError(err.message||'Could not update your role');}
  };

  const updateStatus=async(entity,record,status)=>{
    setSaving(`${entity}-${record.id}`);
    const key=entity.toLowerCase()+'s';
    setData(prev=>({...prev,[key]:prev[key].map(r=>r.id===record.id?{...r,status}:r)}));
    try{
      await base44.entities[entity].update(record.id,{status});
      await load();
    }catch(err){await load();setError(err.message||`Could not update ${entity.toLowerCase()}`);}
    finally{setSaving('');}
  };

  const saveJob=async(id,changes)=>{
    setSaving(`job-${id}`);
    try{ await base44.entities.Deal.update(id,changes); await load(); setError('Job updated.'); }
    catch(err){ setError(err.message||'Could not update job'); }
    finally{ setSaving(''); }
  };

  const createJob=async(payload)=>{
    setSaving('job-new');
    try{
      await base44.entities.Deal.create({ ...payload, broker_id: me.id, broker_name: me.full_name||me.email });
      await load(); setError('Job posted to the load board.');
    }catch(err){ setError(err.message||'Could not post job'); }
    finally{ setSaving(''); }
  };

  const deleteJob=async(id)=>{
    setSaving(`job-${id}`);
    try{ await base44.entities.Deal.delete(id); await load(); setError('Job deleted.'); }
    catch(err){ setError(err.message||'Could not delete job'); }
    finally{ setSaving(''); }
  };

  const cancelJob=async(deal)=>{
    setSaving(`job-${deal.id}`);
    try{
      const trip=data.trips.find(t=>t.deal_id===deal.id&&!['completed','cancelled'].includes(t.status));
      if(trip){
        if(trip.funding_status==='confirmed')await refundTripFunding(trip);
        const acceptedBid=data.bids.find(b=>b.deal_id===deal.id&&b.driver_id===trip.driver_id&&b.status==='accepted');
        if(acceptedBid)await base44.entities.Bid.update(acceptedBid.id,{status:'rejected'});
        await base44.entities.Trip.update(trip.id,{status:'cancelled',cancelled_by:'admin',timer_started_at:null});
      }
      await base44.entities.Deal.update(deal.id,{status:'cancelled',cancelled_by:'admin'});
      await load();
      setError(trip?'Job and its active trip were cancelled. Any reserved funding was refunded.':'Job cancelled.');
    }catch(err){ setError(err.message||'Could not cancel job'); }
    finally{ setSaving(''); }
  };

  const decideBid=async(deal,bid,status)=>{
    setSaving(`bid-${bid.id}`);
    setData(prev=>({...prev,bids:prev.bids.map(b=>b.id===bid.id?{...b,status}:b)}));
    if(status==='accepted'){setData(prev=>({...prev,deals:prev.deals.map(d=>d.id===deal.id?{...d,status:'assigned',assigned_driver_id:bid.driver_id,accepted_bid_id:bid.id}:d)}));}
    try{
      await base44.entities.Bid.update(bid.id,{status});
      if(status==='accepted'){
        await base44.entities.Deal.update(deal.id,{status:'assigned',assigned_driver_id:bid.driver_id,accepted_bid_id:bid.id});
        const existingTrips=await base44.entities.Trip.filter({bid_id:bid.id},'-created_date',1);
        if(!existingTrips[0])await base44.entities.Trip.create({
          deal_id:deal.id,bid_id:bid.id,broker_id:deal.broker_id,broker_name:deal.broker_name,
          driver_id:bid.driver_id,driver_name:bid.driver_name,vehicle_info:deal.vehicle_info,
          pickup_location:deal.pickup_location,delivery_location:deal.delivery_location,
          accepted_rate:Number(bid.hourly_rate),status:'scheduled',tracked_minutes:0
        });
        const others=data.bids.filter(x=>x.deal_id===deal.id&&x.id!==bid.id&&x.status==='pending');
        await Promise.all(others.map(x=>base44.entities.Bid.update(x.id,{status:'rejected'})));
      }
      setError(status==='accepted'?'Bid accepted on behalf of broker.':'Bid declined.');
      await load();
    }catch(err){await load();setError(err.message||'Could not update bid');}
    finally{setSaving('');}
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
    }catch(err){setError(err.message||'Could not open this private document');}
  };

  const decideSelected=async(status)=>{
    if(!selected)return;
    await updateStatus(selected.entity,selected.record,status);
    setSelected(null);
  };

  const requestInfo=async()=>{
    if(!selected)return;
    const {entity,record}=selected;
    setSaving(`${entity}-info-${record.id}`);
    try{
      const name=record.full_name||record.company||'applicant';
      await base44.integrations.Core.SendEmail({to:record.email,subject:'Additional information needed — Relay application',body:`Hi ${name},\n\nThanks for applying to join Relay. Before we can finish reviewing your ${entity.toLowerCase()} application, we need a little more information. Please reply with any missing license or document details, or clarifications on your application.\n\nOnce we receive it, we'll continue your review right away.\n\n— Relay Review Team`});
      setError(`Information request sent to ${record.email}`);
    }catch(err){setError(err.message||'Could not send information request');}
    finally{setSaving('');}
  };

  const refreshData=async()=>{setRefreshing(true);setError('');try{await load();setError('Data refreshed.');}catch(e){setError(e.message||'Could not refresh');}finally{setRefreshing(false);}};
  const approveWalletTxn=async(id)=>{setSaving(`wallet-${id}`);try{await approveTransaction(id);await load();}catch(err){setError(err.message||'Could not approve');}finally{setSaving('');}};
  const rejectWalletTxn=async(id)=>{setSaving(`wallet-${id}`);try{await rejectTransaction(id);await load();}catch(err){setError(err.message||'Could not reject');}finally{setSaving('');}};
  const pendingWallet=data.walletTxns.filter(x=>x.status==='pending').sort((a,b)=>(b.speed==='instant'?1:0)-(a.speed==='instant'?1:0));
  const userNameFor=(id)=>{const u=data.users.find(x=>x.id===id);return u?.full_name||u?.email||(data.drivers.find(d=>d.created_by_id===id)?.full_name)||'User';};
  const disputedTrips=data.trips.filter(t=>t.delivery_review_status==='disputed');
  const openIncidents=data.incidents.filter(i=>i.status!=='resolved');
  const resolveIncident=async(incident)=>{
    if(!resolutionText.trim()){setError('Add resolution notes before closing this incident.');return;}
    setSaving(`incident-${incident.id}`);
    try{
      await base44.entities.TripIncident.update(incident.id,{status:'resolved',resolution_notes:resolutionText.trim(),resolved_at:new Date().toISOString()});
      setResolvingIncident(null);setResolutionText('');await load();
    }catch(err){setError(err.message||'Could not resolve incident');}
    finally{setSaving('');}
  };

  const pendingBrokers=data.brokers.filter(x=>x.status==='pending'||!x.status);
  const pendingDrivers=data.drivers.filter(x=>x.status==='pending'||!x.status);
  const filteredBrokers=approvalFilter==='all'?data.brokers:data.brokers.filter(x=>(x.status||'pending')===approvalFilter);
  const filteredDrivers=approvalFilter==='all'?data.drivers:data.drivers.filter(x=>(x.status||'pending')===approvalFilter);
  const openDeals=data.deals.filter(x=>x.status==='open');
  const approvedDrivers=data.drivers.filter(x=>x.status==='approved');
  const approvedBrokers=data.brokers.filter(x=>x.status==='approved');
  const driverTripsFor=(d)=>data.trips.filter(t=>t.driver_id===d.created_by_id);
  const brokerDealsFor=(b)=>data.deals.filter(x=>x.broker_id===b.created_by_id);
  const completedTrips=data.trips.filter(t=>t.status==='completed');
  const cancelledTrips=data.trips.filter(t=>t.status==='cancelled');
  const totalDriverMinutes=data.trips.reduce((s,t)=>s+Number(t.tracked_minutes||0),0);
  const completedDeals=data.deals.filter(x=>x.status==='completed');
  const cancelledDeals=data.deals.filter(x=>x.status==='cancelled');
  const paymentsSent=data.trips.filter(t=>t.payment_status==='sent').length;
  const paymentsPending=data.trips.filter(t=>t.status==='completed'&&t.payment_status!=='sent').length;
  const tabs=[
    ['overview','Overview'],
    ['approvals',`Approvals (${pendingBrokers.length+pendingDrivers.length})`],
    ['drivers',`Drivers (${data.drivers.length})`],
    ['brokers',`Brokers (${data.brokers.length})`],
    ['users',`Users (${data.users.length})`],
    ['jobs',`Jobs (${data.deals.length})`],
    ['bids',`Bids (${data.bids.length})`],
    ['trips',`Trips (${data.trips.length})`],
    ['disputes',`Disputes (${disputedTrips.length+openIncidents.length})`],
    ['wallet',`Wallet (${pendingWallet.length})`]
  ];

  if(loading)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading owner dashboard…</span></div></div>;
  if(!isDriveBidOwner(me))return <div className="db-shell"><main className="db-page"><div className="db-panel db-admin-denied"><h1>Admin access required</h1><p>This page is available only to the Relay owner account.</p><button className="db-button" onClick={()=>navigate('/')}>Return to Relay</button></div></main></div>;

  return <div className="db-shell">
    <header className="db-topbar">
      <div className="db-brand"><div className="db-brandmark">R</div><span>Relay Admin</span></div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:14}}>
        <button className="db-avatar" onClick={()=>setMenu(!menu)} aria-label="Account menu">{(me?.full_name||me?.email||'A').split(/\s|@/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</button>
      </div>
    </header>
    {menu&&<div className="db-user-menu">
      <button onClick={()=>{setMenu(false);navigate('/profile')}}>My profile</button>
      <button onClick={()=>base44.auth.logout(window.location.origin+'/login')}>Sign out</button>
    </div>}
    <main className="db-page">
      <div className="db-heading-row"><div><div className="db-eyebrow">Owner control center</div><h1>Admin dashboard</h1><p>Review approvals and monitor the full Relay marketplace.</p></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{isDriveBidOwner(me)&&me?.account_type==='broker'&&<button className="db-button secondary" onClick={removeBrokerRole}>Remove my broker role</button>}<button className="db-button secondary" onClick={refreshData} disabled={refreshing}>{refreshing?'Refreshing…':'Refresh data'}</button></div></div>
      {error&&<div className="db-notice">{error}</div>}
      <div className="db-admin-tabs">{tabs.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>

      {tab==='overview'&&<>
        <div className="db-admin-stats">
          <Stat value={data.users.length} label="Registered users"/>
          <Stat value={pendingBrokers.length} label="Brokers awaiting"/>
          <Stat value={pendingDrivers.length} label="Drivers awaiting"/>
          <Stat value={approvedBrokers.length} label="Approved brokers"/>
          <Stat value={approvedDrivers.length} label="Approved drivers"/>
          <Stat value={openDeals.length} label="Open jobs"/>
          <Stat value={completedDeals.length} label="Completed jobs"/>
          <Stat value={data.bids.length} label="Total bids"/>
          <Stat value={completedTrips.length} label="Completed trips"/>
          <Stat value={paymentsSent} label="Payments sent"/>
        </div>
        <div className="db-grid">
          <section className="db-panel"><div className="db-panel-head"><h2>Approval queue</h2><span className="db-count">{pendingBrokers.length+pendingDrivers.length}</span></div><div className="db-side-body">{pendingBrokers.length+pendingDrivers.length?<><p><strong>{pendingBrokers.length}</strong> broker applications</p><p><strong>{pendingDrivers.length}</strong> driver applications</p><button className="db-button" onClick={()=>setTab('approvals')}>Review applications</button></>:<div className="db-empty"><strong>All caught up</strong>No pending applications.</div>}</div></section>
          <section className="db-panel"><div className="db-panel-head"><h2>Marketplace health</h2></div><div className="db-side-body"><Status text="Open jobs" value={openDeals.length}/><Status text="Assigned jobs" value={data.deals.filter(x=>x.status==='assigned').length}/><Status text="Completed jobs" value={completedDeals.length}/><Status text="Cancelled jobs" value={cancelledDeals.length}/><Status text="Accepted bids" value={data.bids.filter(x=>x.status==='accepted').length}/></div></section>
        </div>
        <div className="db-grid" style={{marginTop:22}}>
          <section className="db-panel"><div className="db-panel-head"><h2>Driver activity</h2><span className="db-count">{data.drivers.length} drivers</span></div><div className="db-side-body"><Status text="Approved drivers" value={approvedDrivers.length}/><Status text="Completed deliveries" value={data.drivers.reduce((s,d)=>s+Number(d.completed_deliveries||0),0)}/><Status text="Cancelled trips" value={data.drivers.reduce((s,d)=>s+Number(d.cancelled_trips||0),0)}/><Status text="Completed trips" value={completedTrips.length}/><Status text="Total tracked hours" value={(totalDriverMinutes/60).toFixed(1)}/></div></section>
          <section className="db-panel"><div className="db-panel-head"><h2>Broker activity</h2><span className="db-count">{data.brokers.length} brokers</span></div><div className="db-side-body"><Status text="Approved brokers" value={approvedBrokers.length}/><Status text="Jobs posted" value={data.deals.length}/><Status text="Completed jobs" value={completedDeals.length}/><Status text="Cancelled jobs" value={cancelledDeals.length}/><Status text="Payments sent" value={paymentsSent}/><Status text="Payments pending" value={paymentsPending}/></div></section>
        </div>
      </>}

      {tab==='approvals'&&<div className="db-admin-sections">
        <div className="db-chips">{['pending','approved','rejected','all'].map(f=><button key={f} className="db-link-btn" style={approvalFilter===f?{background:'var(--db-navy)',color:'white'}:{}} onClick={()=>setApprovalFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div>
        <ApprovalSection title="Broker & individual applications" empty="No applications are waiting." records={filteredBrokers} render={(broker)=><ApprovalCard key={broker.id} title={broker.company||broker.full_name||'Broker'} subtitle={broker.email} status={broker.status} onClick={()=>setSelected({entity:'Broker',record:broker})}>
          <Info label="Poster type" value={broker.poster_type==='individual'?'Individual':'Business'}/><Info label="Contact" value={formatPhone(broker.phone)}/>{broker.poster_type!=='individual'&&<><Info label="MC number" value={broker.mc_number}/><Info label="Address" value={broker.business_address}/></>}<Info label="Jobs posted" value={brokerDealsFor(broker).length}/><Info label="Rating" value={broker.rating?`${Number(broker.rating).toFixed(1)}/5`:null}/>
          <div className="db-admin-docs">{broker.poster_type==='individual'?broker.government_id_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.government_id_document)}>Government ID</button>:<>{broker.w9_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.w9_document)}>W-9</button>}{broker.broker_license_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.broker_license_document)}>Broker license</button>}</>}</div>
          <ApprovalActions busy={saving===`Broker-${broker.id}`} status={broker.status||'pending'} onApprove={()=>updateStatus('Broker',broker,'approved')} onReject={()=>updateStatus('Broker',broker,'rejected')}/>
        </ApprovalCard>}/>
        <ApprovalSection title="Driver applications" empty="No driver applications are waiting." records={filteredDrivers} render={(driver)=><ApprovalCard key={driver.id} title={driver.full_name||'Driver'} subtitle={driver.email} status={driver.status} onClick={()=>setSelected({entity:'Driver',record:driver})}>
          <Info label="Phone" value={formatPhone(driver.phone)}/><Info label="License" value={[driver.license_state,driver.license_number].filter(Boolean).join(' · ')}/><Info label="Expires" value={driver.license_expiration}/><Info label="Completed deliveries" value={driver.completed_deliveries||0}/><Info label="Cancelled trips" value={driver.cancelled_trips||0}/><Info label="Rating" value={driver.rating?`${Number(driver.rating).toFixed(1)}/5`:null}/>
          <div className="db-admin-docs" onClick={e=>e.stopPropagation()}>
            {driver.license_document&&<button className="db-link-btn" onClick={()=>openDocument(driver.license_document)}>License file</button>}
            {driver.license_front&&<button className="db-link-btn" onClick={()=>openDocument(driver.license_front)}>License front</button>}
            {driver.license_back&&<button className="db-link-btn" onClick={()=>openDocument(driver.license_back)}>License back</button>}
            {driver.driving_history_report&&<button className="db-link-btn" onClick={()=>openDocument(driver.driving_history_report)}>Driving history</button>}
          </div>
          <ApprovalActions busy={saving===`Driver-${driver.id}`} status={driver.status||'pending'} onApprove={()=>updateStatus('Driver',driver,'approved')} onReject={()=>updateStatus('Driver',driver,'rejected')}/>
        </ApprovalCard>}/>
      </div>}

      {tab==='drivers'&&<div className="db-admin-sections">
        <ApprovalSection title="All drivers" empty="No drivers yet." records={data.drivers} countLabel="drivers" render={(driver)=><ApprovalCard key={driver.id} title={driver.full_name||'Driver'} subtitle={driver.email} status={driver.status} onClick={()=>setSelected({entity:'Driver',record:driver})}>
          <Info label="Phone" value={formatPhone(driver.phone)}/>
          <Info label="License" value={[driver.license_state,driver.license_number].filter(Boolean).join(' · ')}/>
          <Info label="Completed deliveries" value={driver.completed_deliveries||0}/>
          <Info label="Cancelled trips" value={driver.cancelled_trips||0}/>
          <Info label="Trips" value={driverTripsFor(driver).length}/>
          <Info label="Rating" value={driver.rating?`${Number(driver.rating).toFixed(1)}/5`:null}/>
          <div className="db-admin-docs" onClick={e=>e.stopPropagation()}>
            {driver.license_front&&<button className="db-link-btn" onClick={()=>openDocument(driver.license_front)}>License front</button>}
            {driver.license_back&&<button className="db-link-btn" onClick={()=>openDocument(driver.license_back)}>License back</button>}
            {driver.driving_history_report&&<button className="db-link-btn" onClick={()=>openDocument(driver.driving_history_report)}>Driving history</button>}
          </div>
          <LifecycleActions busy={saving===`Driver-${driver.id}`} status={driver.status||'pending'} onApprove={()=>updateStatus('Driver',driver,'approved')} onReject={()=>updateStatus('Driver',driver,'rejected')} onSuspend={()=>updateStatus('Driver',driver,'suspended')} onReinstate={()=>updateStatus('Driver',driver,'approved')}/>
        </ApprovalCard>}/>
      </div>}

      {tab==='brokers'&&<div className="db-admin-sections">
        <ApprovalSection title="All brokers & individuals" empty="No brokers or individuals yet." records={data.brokers} countLabel="posters" render={(broker)=><ApprovalCard key={broker.id} title={broker.company||broker.full_name||'Broker'} subtitle={broker.email} status={broker.status} onClick={()=>setSelected({entity:'Broker',record:broker})}>
          <Info label="Poster type" value={broker.poster_type==='individual'?'Individual':'Business'}/>
          <Info label="Contact" value={formatPhone(broker.phone)}/>
          {broker.poster_type!=='individual'&&<Info label="Company" value={broker.company}/>}
          <Info label="Jobs posted" value={brokerDealsFor(broker).length}/>
          <Info label="Rating" value={broker.rating?`${Number(broker.rating).toFixed(1)}/5`:null}/>
          <div className="db-admin-docs" onClick={e=>e.stopPropagation()}>
            {broker.poster_type==='individual'?
              broker.government_id_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.government_id_document)}>Government ID</button>
            :<>
              {broker.w9_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.w9_document)}>W-9</button>}
              {broker.broker_license_document&&<button className="db-link-btn" onClick={()=>openDocument(broker.broker_license_document)}>Broker license</button>}
            </>}
          </div>
          <LifecycleActions busy={saving===`Broker-${broker.id}`} status={broker.status||'pending'} onApprove={()=>updateStatus('Broker',broker,'approved')} onReject={()=>updateStatus('Broker',broker,'rejected')} onSuspend={()=>updateStatus('Broker',broker,'suspended')} onReinstate={()=>updateStatus('Broker',broker,'approved')}/>
        </ApprovalCard>}/>
      </div>}

      {tab==='trips'&&<div className="db-panel db-admin-table-wrap">{data.trips.length?<table className="db-admin-table"><thead><tr><th>Driver</th><th>Broker</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Payment</th><th>Tracked</th><th></th></tr></thead><tbody>{data.trips.map(trip=>(<tr key={trip.id} style={{cursor:'pointer'}} onClick={()=>setSelectedTrip(trip)}><td>{trip.driver_name||'—'}</td><td>{trip.broker_name||'—'}</td><td>{trip.vehicle_info||'—'}</td><td>{trip.pickup_location||'—'} → {trip.delivery_location||'—'}</td><td><span className={`db-admin-status ${trip.status==='completed'?'approved':trip.status==='cancelled'?'rejected':'pending'}`}>{trip.status||'—'}</span></td><td>{trip.payment_status||'—'}</td><td>{Number(trip.tracked_minutes||0).toFixed(0)}m</td><td><button className="db-small-btn" onClick={e=>{e.stopPropagation();setSelectedTrip(trip);}}>View</button></td></tr>))}</tbody></table>:<div className="db-empty"><strong>No trips yet</strong>Trips appear when a broker accepts a driver's bid.</div>}</div>}

      {tab==='disputes'&&<div className="db-admin-sections">
        <ApprovalSection title="Disputed trips" empty="No open trip disputes." records={disputedTrips} countLabel="disputed" render={(trip)=><ApprovalCard key={trip.id} title={trip.vehicle_info||'Trip'} subtitle={`${trip.pickup_location||'—'} → ${trip.delivery_location||'—'}`} status="disputed" onClick={()=>setSelectedTrip(trip)}>
          <Info label="Driver" value={trip.driver_name}/>
          <Info label="Broker" value={trip.broker_name}/>
          <Info label="Dispute reason" value={trip.dispute_reason}/>
          <Info label="Opened" value={dateText(trip.dispute_opened_at)}/>
          <div className="db-inline-actions db-admin-actions" onClick={e=>e.stopPropagation()}><button className="db-button" onClick={()=>setSelectedTrip(trip)}>Review & resolve</button></div>
        </ApprovalCard>}/>
        <ApprovalSection title="Open incident reports" empty="No open incident reports." records={openIncidents} countLabel="open" render={(incident)=><article className="db-panel db-admin-card" key={incident.id}>
          <div className="db-admin-card-head"><div><h3>{(incident.category||'other').replace('_',' ')}</h3><p>{userNameFor(incident.reporter_id)} ({incident.reporter_role}) · Trip {(incident.trip_id||'').slice(0,8)}</p></div><span className={`db-admin-status ${incident.status==='resolved'?'approved':incident.status==='reviewing'?'pending':''}`}>{incident.status}</span></div>
          <p className="db-job-meta" style={{margin:'0 0 12px'}}>{incident.description}</p>
          {incident.photo&&<div className="db-admin-docs"><button className="db-link-btn" onClick={()=>openDocument(incident.photo)}>Photo</button></div>}
          {resolvingIncident===incident.id?<div className="db-form" style={{marginTop:12}}>
            <div className="db-field full"><label>Resolution notes</label><textarea value={resolutionText} onChange={e=>setResolutionText(e.target.value)} required/></div>
            <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>{setResolvingIncident(null);setResolutionText('');}}>Cancel</button><button className="db-button" disabled={saving===`incident-${incident.id}`} onClick={()=>resolveIncident(incident)}>{saving===`incident-${incident.id}`?'Saving…':'Mark resolved'}</button></div>
          </div>:<div className="db-inline-actions db-admin-actions"><button className="db-button" disabled={Boolean(saving)} onClick={()=>{setResolvingIncident(incident.id);setResolutionText(incident.resolution_notes||'');}}>Resolve</button></div>}
        </article>}/>
      </div>}

      {tab==='users'&&<Table headers={['Name','Email','Account type','Platform role','Joined']} rows={data.users.map(user=>[
        user.full_name||'—',user.email||'—',user.account_type||'Not selected',user.role||'user',dateText(user.created_date)
      ])} empty="No registered users yet."/>}

      {tab==='jobs'&&<JobManager deals={data.deals} bids={data.bids} onSave={saveJob} onDelete={deleteJob} onCancel={cancelJob} onDecideBid={decideBid} onCreate={createJob} busy={Boolean(saving)}/>}

      {tab==='bids'&&<Table headers={['Driver','Hourly rate','Status','Job ID','Submitted']} rows={data.bids.map(bid=>[
        bid.driver_name||'—',`$${Number(bid.hourly_rate||0).toFixed(2)}/hr`,bid.status||'—',bid.deal_id||'—',dateText(bid.created_date)
      ])} empty="No bids yet."/>}

      {tab==='wallet'&&<div className="db-admin-sections">
        <ApprovalSection title="Pending wallet requests" empty="No pending wallet requests." records={pendingWallet} countLabel="pending" render={(txn)=><article className="db-panel db-admin-card" key={txn.id} style={txn.speed==='instant'?{borderColor:'var(--db-danger)'}:{}}>
          <div className="db-admin-card-head"><div><h3>{userNameFor(txn.user_id)}{txn.speed==='instant'&&<span className="db-chip" style={{marginLeft:8,background:'#fff0f1',color:'var(--db-danger)'}}>⚡ Instant</span>}</h3><p>{txn.type.replace('_',' ')} · {money(txn.amount)}</p></div><span className={`db-admin-status ${txn.status==='completed'?'approved':txn.status==='rejected'?'rejected':'pending'}`}>{txn.status}</span></div>
          <Info label="Type" value={txn.type.replace('_',' ')}/>
          <Info label="Amount" value={money(txn.amount)}/>
          {txn.fee_amount>0&&<Info label="Instant fee" value={money(txn.fee_amount)}/>}
          <Info label="Role" value={txn.role}/>
          {txn.bank_name&&<Info label="Bank" value={`${txn.bank_name} ****${txn.bank_account_last4}`}/>}
          {txn.bank_routing&&<Info label="Routing" value={txn.bank_routing}/>}
          <ApprovalActions busy={saving===`wallet-${txn.id}`} status={txn.status} onApprove={()=>approveWalletTxn(txn.id)} onReject={()=>rejectWalletTxn(txn.id)}/>
        </article>}/>
        <section>
          <div className="db-heading-row db-admin-subhead"><div><h2>All wallets</h2></div><span className="db-count">{data.wallets.length} wallets</span></div>
          <div className="db-panel db-admin-table-wrap">{data.wallets.length?<table className="db-admin-table"><thead><tr><th>User</th><th>Role</th><th>Balance</th><th>Pending deposits</th><th>Pending withdrawals</th></tr></thead><tbody>{data.wallets.map(w=><tr key={w.id}><td>{userNameFor(w.user_id)}</td><td>{w.role}</td><td>{money(w.balance)}</td><td>{money(w.pending_deposits)}</td><td>{money(w.pending_withdrawals)}</td></tr>)}</tbody></table>:<div className="db-empty"><strong>No wallets yet</strong>Wallets are created when a user opens their profile.</div>}</div>
        </section>
      </div>}
      {Object.values(hasMore).some(v=>v)&&<div style={{textAlign:'center',margin:'22px 0'}}><button className="db-button secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Loading…':'Load more records'}</button></div>}
      <ApplicantProfileModal applicant={selected} trips={data.trips} deals={data.deals} reviews={data.reviews} onClose={()=>setSelected(null)} onApprove={()=>decideSelected('approved')} onReject={()=>decideSelected('rejected')} onRequestInfo={requestInfo} busy={selected&&(saving===`${selected.entity}-${selected.record.id}`||saving===`${selected.entity}-info-${selected.record.id}`)} openDocument={openDocument}/>
      <TripDetailModal trip={selectedTrip} deals={data.deals} bids={data.bids} onClose={()=>setSelectedTrip(null)} onChanged={load}/>
    </main>
  </div>;
}

function Stat({value,label}){return <div className="db-stat"><strong>{value}</strong><span>{label}</span></div>}
function Status({text,value}){return <div className="db-status-row"><div className="db-status-dot"/>{text}<span>{value}</span></div>}
function Info({label,value}){return value?<div className="db-admin-info"><span>{label}</span><strong>{value}</strong></div>:null}
function ApprovalSection({title,empty,records,render,countLabel='pending'}){return <section><div className="db-heading-row db-admin-subhead"><div><h2>{title}</h2></div><span className="db-count">{records.length} {countLabel}</span></div><div className="db-admin-card-grid">{records.length?records.map(render):<div className="db-panel db-empty"><strong>Nothing waiting</strong>{empty}</div>}</div></section>}
function ApprovalCard({title,subtitle,status,onClick,children}){return <article className="db-panel db-admin-card" style={{cursor:'pointer'}} onClick={onClick}><div className="db-admin-card-head"><div><h3>{title}</h3><p>{subtitle||'No email provided'}</p></div><span className={statusClass(status)}>{status||'pending'}</span></div>{children}</article>}
function ApprovalActions({busy,status,onApprove,onReject}){return <div className="db-inline-actions db-admin-actions" onClick={e=>e.stopPropagation()}><button className="db-button" disabled={busy||status==='approved'} onClick={onApprove}>{status==='approved'?'Approved':'Approve'}</button><button className="db-button danger" disabled={busy||status==='rejected'} onClick={onReject}>{status==='rejected'?'Rejected':'Reject'}</button></div>}
function LifecycleActions({busy,status,onApprove,onReject,onSuspend,onReinstate}){
  return <div className="db-inline-actions db-admin-actions" onClick={e=>e.stopPropagation()}>
    {status==='approved'&&<button className="db-button danger" disabled={busy} onClick={onSuspend}>Suspend</button>}
    {status==='suspended'&&<button className="db-button" disabled={busy} onClick={onReinstate}>Reinstate</button>}
    {(status==='pending'||!status)&&<><button className="db-button" disabled={busy} onClick={onApprove}>Approve</button><button className="db-button danger" disabled={busy} onClick={onReject}>Reject</button></>}
    {status==='rejected'&&<button className="db-button secondary" disabled={busy} onClick={onApprove}>Approve</button>}
  </div>;
}
function Table({headers,rows,empty}){return <div className="db-panel db-admin-table-wrap">{rows.length?<table className="db-admin-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>:<div className="db-empty"><strong>Nothing to show</strong>{empty}</div>}</div>}