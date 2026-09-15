import React, { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { entities } from '@/api/supabaseEntities';
import { uploadPrivateFile, createSignedUrl } from '@/lib/supabaseStorage';
import { useSupabaseSubscription } from '@/hooks/useSupabaseSubscription';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';
import MobileSelect from '@/components/MobileSelect';
import PullToRefresh from '@/components/PullToRefresh';
import { processTripPayment, reserveTripFunding, refundTripFunding } from '@/lib/wallet';
import { approveTripDelivery, disputeTripDelivery } from '@/lib/tripReview';
import { submitTripReview } from '@/lib/reviews';
import { motion } from 'framer-motion';

const today=()=>new Date().toISOString().slice(0,10);
const minutesFor=(trip,now)=>{
  let total=Number(trip.tracked_minutes||0);
  if(trip.status==='in_progress'&&trip.timer_started_at)total+=(now-new Date(trip.timer_started_at).getTime())/60000;
  return Math.max(0,total);
};
const timeText=(minutes)=>{
  const total=Math.floor(minutes);
  return `${Math.floor(total/60)}h ${String(total%60).padStart(2,'0')}m`;
};
const money=(value)=>`$${Number(value||0).toFixed(2)}`;

export default function TripCenter(){
  const navigate=useNavigate();
  const watchRef=useRef(null);
  const lastSentRef=useRef(0);
  const pollRef=useRef(null);
  const watchTripIdRef=useRef(null);
  const userIdRef=useRef(null);
  const chatTripRef=useRef(null);
  const chatScrollRef=useRef(null);
  const reminderRef=useRef({});
  const [user,setUser]=useState(null);
  const [trips,setTrips]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [myReviews,setMyReviews]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState('');
  const [message,setMessage]=useState('');
  const nowRef=useRef(Date.now());
  const tripsRef=useRef([]);
  const containerRef=useRef(null);
  const [consents,setConsents]=useState({});
  const [expenseTrip,setExpenseTrip]=useState(null);
  const [expense,setExpense]=useState({category:'Gas',amount:'',notes:'',expense_date:today(),receipt:null});
  const [reviewTrip,setReviewTrip]=useState(null);
  const [review,setReview]=useState({rating:5,comment:''});
  const [proofTrip,setProofTrip]=useState(null);
  const [proof,setProof]=useState({pickup_odometer:'',delivery_odometer:'',pickup_photo:null,delivery_photo:null,delivery_condition_notes:'',delivery_condition_acknowledged:false});
  const [pickupTrip,setPickupTrip]=useState(null);
  const [pickup,setPickup]=useState({pickup_odometer:'',pickup_photo:null,pickup_condition_notes:'',pickup_condition_acknowledged:false});
  const [locations,setLocations]=useState([]);
  const [routeTrip,setRouteTrip]=useState(null);
  const [incidents,setIncidents]=useState([]);
  const [incidentTrip,setIncidentTrip]=useState(null);
  const [incident,setIncident]=useState({category:'vehicle_condition',description:'',photo:null});
  const [disputeTrip,setDisputeTrip]=useState(null);
  const [disputeReason,setDisputeReason]=useState('');
  const [bids,setBids]=useState([]);
  const [tipInput,setTipInput]=useState({});
  const [messages,setMessages]=useState([]);
  const [chatTrip,setChatTrip]=useState(null);
  const [draft,setDraft]=useState('');
  const [alert,setAlert]=useState('');
  const [notifPrompt,setNotifPrompt]=useState(typeof Notification!=='undefined'&&Notification.permission==='default');

  const load=async()=>{
    try{
      const current=await getCurrentUser();setUser(current);
      const [asDriver,asBroker,allExpenses,reviews,allBids,allMessages,allLocations,allIncidents]=await Promise.all([
        entities.Trip.filter({driver_id:current.id},'-created_date',250),
        entities.Trip.filter({broker_id:current.id},'-created_date',250),
        entities.TripExpense.list('-created_date',500),
        entities.Review.filter({reviewer_id:current.id},'-created_date',250),
        entities.Bid.list('-created_date',500),
        entities.Message.list('-created_date',1000),
        entities.TripLocation.list('-recorded_at',2000),
        entities.TripIncident.list('-created_date',500)
      ]);
      const merged=[...asDriver,...asBroker].filter((trip,index,array)=>array.findIndex(x=>x.id===trip.id)===index).sort((a,b)=>new Date(b.created_date)-new Date(a.created_date));
      setTrips(merged);setExpenses(allExpenses);setMyReviews(reviews);setBids(allBids);setMessages(allMessages);setLocations(allLocations);setIncidents(allIncidents);
    }catch(error){setMessage(error.message||'Could not load trips');}
    finally{setLoading(false);}
  };

  const enableNotifications=()=>{
    setNotifPrompt(false);
    if(typeof Notification!=='undefined')Notification.requestPermission().catch(()=>{});
  };

  useEffect(()=>{
    load();
    return()=>{if(watchRef.current!==null)navigator.geolocation?.clearWatch(watchRef.current);if(pollRef.current!==null)window.clearInterval(pollRef.current);};
  },[]);

  useSupabaseSubscription('trips',()=>load());
  useSupabaseSubscription('trip_expenses',()=>load());
  useSupabaseSubscription('trip_locations',()=>load());
  useSupabaseSubscription('trip_incidents',()=>load());
  useSupabaseSubscription('messages',(payload)=>{
    if(payload.eventType==='INSERT'&&payload.new&&payload.new.sender_id!==userIdRef.current&&payload.new.trip_id!==chatTripRef.current){
      setAlert(`New message from ${payload.new.sender_name||payload.new.sender_role}`);
      window.setTimeout(()=>setAlert(''),5000);
      if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification('Relay · New trip message',{body:payload.new.content});}catch(e){}}
    }
    load();
  });

  useEffect(()=>{tripsRef.current=trips;},[trips]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      nowRef.current=Date.now();
      if(containerRef.current){
        const clocks=containerRef.current.querySelectorAll('[data-trip-clock]');
        clocks.forEach(el=>{
          const trip=tripsRef.current.find(t=>t.id===el.getAttribute('data-trip-clock'));
          if(trip)el.textContent=timeText(minutesFor(trip,nowRef.current));
        });
      }
    },1000);
    return()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{userIdRef.current=user?.id;},[user]);
  useEffect(()=>{chatTripRef.current=chatTrip?.id;},[chatTrip]);
  useEffect(()=>{
    if(chatTrip&&chatScrollRef.current){chatScrollRef.current.scrollTop=chatScrollRef.current.scrollHeight;}
  },[chatTrip,messages]);
  useEffect(()=>{
    const checkReminders=()=>{
      const now=Date.now();
      trips.forEach(trip=>{
        if(trip.status!=='in_progress'||!trip.timer_started_at||trip.driver_id!==user?.id)return;
        const elapsedHours=(now-new Date(trip.timer_started_at).getTime())/3600000;
        const lastReminder=reminderRef.current[trip.id]||0;
        if(elapsedHours>=4&&(now-lastReminder)>=4*3600000){
          reminderRef.current[trip.id]=now;
          setAlert(`⏰ Reminder: You've been tracking hours for ${Math.floor(elapsedHours)}h on ${trip.vehicle_info||'your trip'}. Tap "Complete trip" when finished.`);
          window.setTimeout(()=>setAlert(''),6000);
          if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification('Relay · Hour tracking reminder',{body:`You've been tracking for ${Math.floor(elapsedHours)} hours. Remember to stop tracking when done.`});}catch(e){}}
        }
      });
    };
    const reminderTimer=window.setInterval(checkReminders,60000);
    return()=>window.clearInterval(reminderTimer);
  },[trips,user]);

  const updateTrip=async(trip,changes)=>{
    setSaving(trip.id);setMessage('');
    try{await entities.Trip.update(trip.id,changes);await load();}
    catch(error){await load();setMessage(error.message||'Could not update this trip');}
    finally{setSaving('');}
  };

  const startHours=async(trip)=>{
    if(trip.funding_status!=='confirmed'){setMessage('The broker must confirm funding before departure.');return;}
    if(!trip.pickup_condition_acknowledged){setMessage('Record and acknowledge the vehicle pickup condition before starting.');return;}
    const stamp=new Date().toISOString();
    let startedOnTime=trip.started_on_time;
    if(!trip.started_at&&trip.pickup_date&&trip.pickup_time){
      const scheduled=new Date(`${trip.pickup_date}T${trip.pickup_time}`);
      if(!Number.isNaN(scheduled.getTime()))startedOnTime=Date.now()<=scheduled.getTime()+(15*60*1000);
    }
    const changes={status:'in_progress',timer_started_at:stamp,started_at:trip.started_at||stamp};
    if(typeof startedOnTime==='boolean')changes.started_on_time=startedOnTime;
    setTrips(prev=>prev.map(t=>t.id===trip.id?{...t,...changes}:t));
    await updateTrip(trip,changes);
  };

  const accumulated=(trip)=>Math.round(minutesFor(trip,Date.now())*100)/100;

  const stopLocationWatch=()=>{
    if(watchRef.current!==null){navigator.geolocation?.clearWatch(watchRef.current);watchRef.current=null;}
    if(pollRef.current!==null){window.clearInterval(pollRef.current);pollRef.current=null;}
  };

  const pauseHours=async(trip)=>{
    stopLocationWatch();
    const changes={status:'paused',tracked_minutes:accumulated(trip),timer_started_at:null,location_active:false};
    setTrips(prev=>prev.map(t=>t.id===trip.id?{...t,...changes}:t));
    await updateTrip(trip,changes);
  };

  const finishTrip=async(trip,proofChanges={})=>{
    stopLocationWatch();
    const completedAt=new Date().toISOString();
    const changes={status:'completed',tracked_minutes:accumulated(trip),timer_started_at:null,completed_at:completedAt,location_active:false,...proofChanges};
    setTrips(prev=>prev.map(t=>t.id===trip.id?{...t,...changes}:t));
    setSaving(trip.id);
    try{
      await entities.Trip.update(trip.id,changes);
      await entities.Deal.update(trip.deal_id,{status:'completed',completed_at:completedAt});
      setMessage('Trip completed. The delivery record, hours, and expenses are ready for broker review.');await load();
    }catch(error){await load();setMessage(error.message||'Could not complete this trip');}
    finally{setSaving('');}
  };

  const openDeliveryProof=(trip)=>{
    setProofTrip(trip);
    setProof({pickup_odometer:trip.pickup_odometer??'',delivery_odometer:trip.delivery_odometer??'',pickup_photo:null,delivery_photo:null,delivery_condition_notes:trip.delivery_condition_notes||'',delivery_condition_acknowledged:Boolean(trip.delivery_condition_acknowledged)});
  };

  const submitDeliveryProof=async(e)=>{
    e.preventDefault();
    const pickupMiles=Number(proof.pickup_odometer);
    const deliveryMiles=Number(proof.delivery_odometer);
    if(deliveryMiles<pickupMiles){setMessage('Ending odometer must be equal to or greater than the starting odometer.');return;}
    if(!proof.pickup_photo&&!proofTrip.pickup_photo){setMessage('Add a pickup photo before completing the trip.');return;}
    if(!proof.delivery_photo&&!proofTrip.delivery_photo){setMessage('Add a delivery photo before completing the trip.');return;}
    if(!proof.delivery_condition_acknowledged){setMessage('Acknowledge the delivery condition before completing the trip.');return;}
    setSaving(proofTrip.id);setMessage('');
    try{
      const upload=async(file,existing)=>{
        if(!file?.size)return existing||'';
        return await uploadPrivateFile('trip-photos',`${proofTrip.id}/${Date.now()}-${file.name}`,file);
      };
      const [pickupPhoto,deliveryPhoto]=await Promise.all([
        upload(proof.pickup_photo,proofTrip.pickup_photo),
        upload(proof.delivery_photo,proofTrip.delivery_photo)
      ]);
      const stamp=new Date().toISOString();
      const currentTrip=proofTrip;
      setProofTrip(null);
      setProof({pickup_odometer:'',delivery_odometer:'',pickup_photo:null,delivery_photo:null,delivery_condition_notes:'',delivery_condition_acknowledged:false});
      await finishTrip(currentTrip,{pickup_odometer:pickupMiles,delivery_odometer:deliveryMiles,pickup_photo:pickupPhoto,delivery_photo:deliveryPhoto,pickup_confirmed_at:currentTrip.pickup_confirmed_at||stamp,delivery_confirmed_at:stamp,delivery_condition_acknowledged:true,delivery_condition_notes:proof.delivery_condition_notes});
    }catch(error){setMessage(error.message||'Could not save the delivery record');setSaving('');}
  };

  const submitPickupCondition=async(e)=>{
    e.preventDefault();
    if(!pickup.pickup_condition_acknowledged){setMessage('Confirm the vehicle condition acknowledgment.');return;}
    setSaving(pickupTrip.id);setMessage('');
    try{
      let pickupPhoto=pickupTrip.pickup_photo||'';
      if(pickup.pickup_photo?.size){pickupPhoto=await uploadPrivateFile('trip-photos',`${pickupTrip.id}/${Date.now()}-${pickup.pickup_photo.name}`,pickup.pickup_photo);}
      if(!pickupPhoto){setMessage('Add a pickup-condition photo.');setSaving('');return;}
      await entities.Trip.update(pickupTrip.id,{pickup_odometer:Number(pickup.pickup_odometer),pickup_photo:pickupPhoto,pickup_condition_notes:pickup.pickup_condition_notes,pickup_condition_acknowledged:true,pickup_confirmed_at:new Date().toISOString()});
      setPickupTrip(null);setPickup({pickup_odometer:'',pickup_photo:null,pickup_condition_notes:'',pickup_condition_acknowledged:false});setMessage('Pickup condition saved. The driver may start once funding is confirmed.');await load();
    }catch(error){setMessage(error.message||'Could not save pickup condition');}
    finally{setSaving('');}
  };

  const confirmFunding=async(trip)=>{
    const amount=Number(trip.accepted_rate||0)*Number(trip.estimated_hours||2);
    setSaving(trip.id);setMessage('');
    try{await reserveTripFunding(trip,amount);setMessage(`${money(amount)} reserved for this trip. The driver is cleared to depart after pickup acknowledgment.`);await load();}
    catch(error){setMessage(error.message||'Could not confirm funding');}
    finally{setSaving('');}
  };

  const approveDelivery=async(trip)=>{
    setSaving(trip.id);setMessage('');
    try{await approveTripDelivery(trip);setMessage('Delivery approved. Payment can now be released.');await load();}
    catch(error){setMessage(error.message||'Could not approve delivery');}
    finally{setSaving('');}
  };

  const openDispute=async(e)=>{
    e.preventDefault();setSaving(disputeTrip.id);
    try{await disputeTripDelivery(disputeTrip,disputeReason);setDisputeTrip(null);setDisputeReason('');setMessage('Dispute opened. Payment is paused and the delivery record remains available for review.');await load();}
    catch(error){setMessage(error.message||'Could not open dispute');}
    finally{setSaving('');}
  };

  const submitIncident=async(e)=>{
    e.preventDefault();setSaving(incidentTrip.id);
    try{
      let photo='';
      if(incident.photo?.size){photo=await uploadPrivateFile('trip-photos',`${incidentTrip.id}/${Date.now()}-${incident.photo.name}`,incident.photo);}
      const driverSide=incidentTrip.driver_id===user.id;
      await entities.TripIncident.create({trip_id:incidentTrip.id,broker_id:incidentTrip.broker_id,driver_id:incidentTrip.driver_id,reporter_id:user.id,reporter_role:driverSide?'driver':'broker',category:incident.category,description:incident.description,photo,status:'open'});
      setIncidentTrip(null);setIncident({category:'vehicle_condition',description:'',photo:null});setMessage('Incident report saved and shared with the assigned parties and administrator.');await load();
    }catch(error){setMessage(error.message||'Could not submit incident');}
    finally{setSaving('');}
  };

  const brokerCancelTrip=async(trip)=>{
    const cancelledAt=new Date().toISOString();
    const changes={status:'cancelled',cancelled_by:'broker',cancelled_at:cancelledAt,cancellation_fee_status:'not_applicable',timer_started_at:null,location_active:false};
    setTrips(prev=>prev.map(t=>t.id===trip.id?{...t,...changes}:t));
    setSaving(trip.id);setMessage('');
    try{
      const accepted=bids.find(x=>x.deal_id===trip.deal_id&&x.driver_id===trip.driver_id&&x.status==='accepted');
      if(accepted)await entities.Bid.update(accepted.id,{status:'rejected'});
      await refundTripFunding(trip);
      await entities.Trip.update(trip.id,changes);
      await entities.Deal.update(trip.deal_id,{status:'cancelled',cancelled_by:'broker',cancelled_at:cancelledAt});
      setMessage('Trip cancelled.');await load();
    }catch(error){await load();setMessage(error.message||'Could not cancel trip');}
    finally{setSaving('');}
  };

  const saveTip=async(trip,amount)=>{
    const value=Math.max(0,Number(amount)||0);
    setSaving(trip.id);setMessage('');
    try{await entities.Trip.update(trip.id,{tip_amount:value});setMessage('Tip updated — total recalculated.');await load();}
    catch(error){setMessage(error.message||'Could not update tip');}
    finally{setSaving('');}
  };

  const sendPayment=async(trip)=>{
    setSaving(trip.id);setMessage('');
    try{
      const labor=Number(trip.accepted_rate||0)*(accumulated(trip)/60);
      const exp=expenses.filter(x=>x.trip_id===trip.id&&x.status!=='rejected').reduce((s,x)=>s+Number(x.amount||0),0);
      const total=labor+exp+Number(trip.tip_amount||0);
      await processTripPayment(trip,total);
      setMessage('Payment sent to the driver wallet.');await load();
    }catch(error){setMessage(error.message||'Could not send payment');}
    finally{setSaving('');}
  };

  const confirmReceipt=async(trip)=>{
    setSaving(trip.id);setMessage('');
    try{await entities.Trip.update(trip.id,{payment_status:'received'});setMessage('Payment confirmed — chat is now closed.');await load();}
    catch(error){setMessage(error.message||'Could not confirm payment');}
    finally{setSaving('');}
  };

  const setExpenseStatus=async(item,status)=>{
    setExpenses(prev=>prev.map(x=>x.id===item.id?{...x,status}:x));
    try{await entities.TripExpense.update(item.id,{status});await load();}
    catch(error){await load();setMessage(error.message||'Could not update expense');}
  };

  const sendMessage=async(e)=>{
    e.preventDefault();
    if(!draft.trim())return;
    setSaving('chat');setMessage('');
    try{
      await entities.Message.create({
        trip_id:chatTrip.id,broker_id:chatTrip.broker_id,driver_id:chatTrip.driver_id,
        sender_id:user.id,sender_name:user.full_name||user.email,
        sender_role:chatTrip.driver_id===user.id?'driver':'broker',
        content:draft.trim()
      });
      setDraft('');await load();
    }catch(error){setMessage(error.message||'Could not send message');}
    finally{setSaving('');}
  };

  const sendLocation=async(tripId,position,force=false)=>{
    const stamp=Date.now();
    if(!force&&stamp-lastSentRef.current<8000)return;
    lastSentRef.current=stamp;
    try{
      const activeTrip=tripsRef.current.find(t=>t.id===tripId);
      const recordedAt=new Date().toISOString();
      if(activeTrip)await entities.TripLocation.create({trip_id:tripId,broker_id:activeTrip.broker_id,driver_id:activeTrip.driver_id,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_meters:Number(position.coords.accuracy||0),recorded_at:recordedAt});
      await entities.Trip.update(tripId,{
        current_latitude:position.coords.latitude,
        current_longitude:position.coords.longitude,
        last_location_at:recordedAt,
        location_consent:true,
        location_active:true
      });
    }catch(e){}
  };

  const enableLocation=async(trip)=>{
    if(!consents[trip.id]){setMessage('Check the location-consent box before sharing your location.');return;}
    if(!navigator.geolocation){setMessage('Location services are not supported on this device.');return;}
    setSaving(trip.id);setMessage('');
    try{
      const first=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
      await sendLocation(trip.id,first,true);
      stopLocationWatch();
      watchTripIdRef.current=trip.id;
      watchRef.current=navigator.geolocation.watchPosition(
        position=>sendLocation(watchTripIdRef.current,position).catch(()=>{}),
        error=>setMessage(error.message||'Location sharing stopped'),
        {enableHighAccuracy:true,maximumAge:0,timeout:30000}
      );
      pollRef.current=window.setInterval(()=>{
        navigator.geolocation.getCurrentPosition(
          position=>sendLocation(watchTripIdRef.current,position).catch(()=>{}),
          ()=>{},
          {enableHighAccuracy:true,timeout:15000,maximumAge:0}
        );
      },10000);
      setMessage('Live location sharing is on. Your position updates continuously while this page stays open.');await load();
    }catch(error){setMessage(error.message||'Location permission was not granted');}
    finally{setSaving('');}
  };

  const disableLocation=async(trip)=>{
    stopLocationWatch();
    await updateTrip(trip,{location_active:false});
  };

  const submitExpense=async(e)=>{
    e.preventDefault();setSaving(expenseTrip.id);
    try{
      let receipt_document='';
      if(expense.receipt?.size){
        receipt_document=await uploadPrivateFile('expense-receipts',`${expenseTrip.id}/${Date.now()}-${expense.receipt.name}`,expense.receipt);
      }
      await entities.TripExpense.create({
        trip_id:expenseTrip.id,deal_id:expenseTrip.deal_id,driver_id:expenseTrip.driver_id,broker_id:expenseTrip.broker_id,
        category:expense.category,amount:Number(expense.amount),notes:expense.notes,expense_date:expense.expense_date,receipt_document
      });
      setExpenseTrip(null);setExpense({category:'Gas',amount:'',notes:'',expense_date:today(),receipt:null});setMessage('Expense submitted to the broker.');await load();
    }catch(error){setMessage(error.message||'Could not add expense');}
    finally{setSaving('');}
  };

  const openDocument=async(uri)=>{
    if(!uri)return;
    try{
      const url=uri.startsWith('http')?uri:await createSignedUrl(uri);
      window.open(url,'_blank','noopener,noreferrer');
    }catch(error){setMessage(error.message||'Could not open receipt');}
  };

  const submitReview=async(e)=>{
    e.preventDefault();setSaving(reviewTrip.id);
    try{
      await submitTripReview(reviewTrip,Number(review.rating),review.comment);
      setReviewTrip(null);setReview({rating:5,comment:''});setMessage('Review submitted.');await load();
    }catch(error){setMessage(error.message||'Could not submit review');}
    finally{setSaving('');}
  };

  if(loading)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading trips…</span></div></div>;
  const chatMessages=chatTrip?messages.filter(m=>m.trip_id===chatTrip.id).slice().sort((a,b)=>new Date(a.created_date)-new Date(b.created_date)):[];
  return <div className="db-shell">
    <header className="db-topbar"><div className="db-brand"><div className="db-brandmark">R</div><span>Relay</span></div><button className="db-button secondary db-admin-back" onClick={()=>navigate(-1)}>← Back</button></header>
    <main className="db-page">
      <PullToRefresh onRefresh={load}>
      <div className="db-heading-row"><div><div className="db-eyebrow">Assigned work</div><h1>My trips</h1><p>Track hours, expenses, trip progress, location, and payment status.</p></div><button className="db-button secondary" onClick={()=>navigate('/profile')}>My profile</button></div>
      {message&&<div className="db-notice">{message}</div>}
      {notifPrompt&&<div className="db-alert pending"><div className="db-alert-icon">!</div><div style={{flex:1}}><strong>Turn on notifications?</strong><p>Get alerted the moment a new message arrives, and get a reminder if you forget to stop hour tracking.</p></div><div className="db-inline-actions"><button className="db-button secondary" onClick={()=>setNotifPrompt(false)}>Not now</button><button className="db-button" onClick={enableNotifications}>Enable</button></div></div>}
      <div className="db-trip-notice"><strong>Location privacy:</strong> sharing starts only after the driver checks the consent box and taps Share live location. It stops when paused, completed, or manually stopped. Keep the app open in the foreground for reliable updates.</div>
      <div className="db-trip-list" ref={containerRef}>
        {trips.length?trips.map(trip=>{
          const driverSide=trip.driver_id===user.id;
          const tripExpenses=expenses.filter(x=>x.trip_id===trip.id);
          const expenseTotal=tripExpenses.filter(x=>x.status!=='rejected').reduce((sum,x)=>sum+Number(x.amount||0),0);
          const reviewed=myReviews.some(x=>x.trip_id===trip.id);
          const trackedHours=minutesFor(trip,nowRef.current)/60;
          const laborTotal=Number(trip.accepted_rate||0)*trackedHours;
          const tipValue=Number(trip.tip_amount||0);
          const grandTotal=laborTotal+expenseTotal+tipValue;
          const tripLocations=locations.filter(x=>x.trip_id===trip.id).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));
          const tripIncidents=incidents.filter(x=>x.trip_id===trip.id);
          return <article className="db-panel db-trip-card" key={trip.id}>
            <div className="db-trip-head"><div><span className={`db-admin-status ${trip.status==='completed'?'approved':'pending'}`}>{(trip.status||'scheduled').replace('_',' ')}</span><h2>{trip.vehicle_info||'Assigned vehicle'}</h2><p>{trip.pickup_location} → {trip.delivery_location}</p></div><div className="db-trip-clock"><strong data-trip-clock={trip.id}>{timeText(minutesFor(trip,nowRef.current))}</strong><span>tracked time</span></div></div>
            <div className="db-trip-metrics"><div><span>Accepted rate</span><strong>{money(trip.accepted_rate)}/hr</strong></div><div><span>Funding</span><strong>{trip.funding_status==='confirmed'?money(trip.funded_amount):trip.funding_status==='released'?'Released':trip.funding_status==='refunded'?'Refunded':'Pending'}</strong></div><div><span>Expenses</span><strong>{money(expenseTotal)}</strong></div><div><span>Tip</span><strong>{money(tipValue)}</strong></div><div><span>Total {trip.status==='completed'?'due':'estimate'}</span><strong style={{color:'var(--db-green)'}}>{money(grandTotal)}</strong></div><div><span>{driverSide?'Broker':'Driver'}</span><strong>{driverSide?trip.broker_name:trip.driver_name}</strong></div></div>
            <div className={`db-alert ${trip.funding_status==='confirmed'||trip.funding_status==='released'?'':'pending'}`}><div className="db-alert-icon">{trip.funding_status==='confirmed'||trip.funding_status==='released'?'✓':'!'}</div><div><strong>{trip.funding_status==='confirmed'?'Funding confirmed':trip.funding_status==='released'?'Funding released':'Funding required before departure'}</strong><p>{trip.funding_status==='confirmed'? `${money(trip.funded_amount)} is reserved in the Relay wallet for this trip.`:trip.funding_status==='released'?'The reserved amount has been applied to payment.':'The driver cannot start until the broker reserves the estimated labor amount.'}</p></div></div>
            {driverSide?<div className="db-trip-controls">
              {trip.status==='scheduled'&&!trip.pickup_condition_acknowledged&&<button className="db-button secondary" onClick={()=>{setPickupTrip(trip);setPickup({pickup_odometer:trip.pickup_odometer??'',pickup_photo:null,pickup_condition_notes:trip.pickup_condition_notes||'',pickup_condition_acknowledged:false})}}>Record pickup condition</button>}
              {['scheduled','paused'].includes(trip.status)&&<button className="db-button" disabled={saving===trip.id||trip.funding_status!=='confirmed'||!trip.pickup_condition_acknowledged} onClick={()=>startHours(trip)}>Start tracking hours</button>}
              {trip.status==='in_progress'&&<button className="db-button secondary" disabled={saving===trip.id} onClick={()=>pauseHours(trip)}>Pause</button>}
              {!['completed','cancelled'].includes(trip.status)&&<button className="db-button" disabled={saving===trip.id} onClick={()=>openDeliveryProof(trip)}>Complete trip</button>}
              {!['completed','cancelled'].includes(trip.status)&&<button className="db-button secondary" onClick={()=>setExpenseTrip(trip)}>+ Expense</button>}
            </div>:<div className="db-trip-controls">
              {trip.status==='scheduled'&&trip.funding_status!=='confirmed'&&<button className="db-button" disabled={saving===trip.id} onClick={()=>confirmFunding(trip)}>Confirm funding · {money(Number(trip.accepted_rate||0)*Number(trip.estimated_hours||2))}</button>}
              {trip.status==='in_progress'&&<button className="db-button secondary" disabled={saving===trip.id} onClick={()=>pauseHours(trip)}>Pause</button>}
              {!['completed','cancelled'].includes(trip.status)&&<button className="db-button danger" disabled={saving===trip.id} onClick={()=>brokerCancelTrip(trip)}>Cancel trip</button>}
            </div>}
            <div className="db-trip-controls"><button className="db-button secondary" onClick={()=>setChatTrip(trip)}>Messages ({messages.filter(m=>m.trip_id===trip.id).length})</button><button className="db-button secondary" onClick={()=>setIncidentTrip(trip)}>Report incident</button>{trip.payment_status==='received'&&<span className="db-job-meta">Chat closed</span>}</div>
            <div className="db-location-box">
              <strong>Trip location</strong>
              {trip.current_latitude&&trip.current_longitude?<div><p>{trip.location_active?'Live sharing on':'Last shared location'} · {trip.last_location_at?new Date(trip.last_location_at).toLocaleString():'time unavailable'} · {tripLocations.length} saved point{tripLocations.length===1?'':'s'}</p><a className="db-link-btn" href={`https://www.google.com/maps?q=${trip.current_latitude},${trip.current_longitude}`} target="_blank" rel="noreferrer">Open current map</a>{tripLocations.length>0&&<button className="db-link-btn" style={{marginLeft:10}} onClick={()=>setRouteTrip(trip)}>View route history</button>}</div>:<p>No location has been shared for this trip.</p>}
            </div>
            <div className="db-payout-summary">
              <div className="db-mini-title" style={{marginTop:0}}>Delivery record</div>
              <div className="db-status-row">Pickup confirmation<span>{trip.pickup_confirmed_at?new Date(trip.pickup_confirmed_at).toLocaleString():'Awaiting driver'}</span></div>
              <div className="db-status-row">Delivery confirmation<span>{trip.delivery_confirmed_at?new Date(trip.delivery_confirmed_at).toLocaleString():'Awaiting completion'}</span></div>
              <div className="db-status-row">Pickup condition<span>{trip.pickup_condition_acknowledged?'Acknowledged':'Pending'}</span></div>
              <div className="db-status-row">Delivery condition<span>{trip.delivery_condition_acknowledged?'Acknowledged':'Pending'}</span></div>
              <div className="db-status-row">Broker review<span>{(trip.delivery_review_status||'pending').replace('_',' ')}</span></div>
              <div className="db-status-row">Odometer<span>{trip.pickup_odometer!=null&&trip.delivery_odometer!=null?`${Number(trip.pickup_odometer).toLocaleString()} → ${Number(trip.delivery_odometer).toLocaleString()} mi`:'Not recorded'}</span></div>
              {(trip.pickup_photo||trip.delivery_photo)&&<div className="db-payout-actions">{trip.pickup_photo&&<button className="db-button secondary" onClick={()=>openDocument(trip.pickup_photo)}>Pickup photo</button>}{trip.delivery_photo&&<button className="db-button secondary" onClick={()=>openDocument(trip.delivery_photo)}>Delivery photo</button>}</div>}
            </div>
            <div className="db-expense-list"><div className="db-mini-title">Incident reports</div>{tripIncidents.length?tripIncidents.map(item=><div className="db-expense-row" key={item.id}><div><strong>{item.category.replace('_',' ')}</strong><small>{item.description}</small></div><span className={`db-admin-status ${item.status==='resolved'?'approved':'pending'}`}>{item.status}</span>{item.photo&&<button className="db-link-btn" onClick={()=>openDocument(item.photo)}>Photo</button>}</div>):<p className="db-job-meta">No incidents reported.</p>}</div>
            <div className="db-expense-list"><div className="db-mini-title">Expenses</div>{tripExpenses.length?tripExpenses.map(item=><div className="db-expense-row" key={item.id}><div><strong>{item.category} · {money(item.amount)}</strong><small>{item.notes||item.expense_date||'Submitted expense'}</small></div><span className={`db-admin-status ${item.status==='approved'?'approved':item.status==='rejected'?'rejected':'pending'}`}>{item.status}</span>{item.receipt_document&&<button className="db-link-btn" onClick={()=>openDocument(item.receipt_document)}>Receipt</button>}{!driverSide&&item.status==='submitted'&&<div className="db-inline-actions"><button className="db-small-btn" onClick={()=>setExpenseStatus(item,'approved')}>Approve</button><button className="db-small-btn" style={{color:'var(--db-danger)',background:'#fff0f1'}} onClick={()=>setExpenseStatus(item,'rejected')}>Reject</button></div>}</div>):<p className="db-job-meta">No expenses submitted.</p>}</div>
            {trip.status==='completed'&&<div className="db-payout-summary">
              <div className="db-mini-title" style={{marginTop:0}}>Payout summary</div>
              <div className="db-status-row">Labor ({money(trip.accepted_rate)}/hr × {timeText(minutesFor(trip,nowRef.current))})<span>{money(laborTotal)}</span></div>
              <div className="db-status-row">Approved expenses<span>{money(expenseTotal)}</span></div>
              <div className="db-status-row">Tip<span>{money(tipValue)}</span></div>
              <div className="db-status-row db-payout-total">{driverSide?'Total earnings':'Total to pay'}<span>{money(grandTotal)}</span></div>
              {!driverSide&&trip.delivery_review_status==='pending'&&<div className="db-payout-actions"><button className="db-button" onClick={()=>approveDelivery(trip)}>Approve delivery</button><button className="db-button danger" onClick={()=>setDisputeTrip(trip)}>Open dispute</button></div>}
              {trip.delivery_review_status==='disputed'&&<div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>Payment paused for review</strong><p>{trip.dispute_reason||'The broker opened a delivery dispute.'} Continue through trip messaging while the administrator reviews the record.</p></div></div>}
              {!driverSide&&<div className="db-tip-row"><label>Add tip ($)</label><input type="number" min="0" step="1" inputMode="decimal" value={tipInput[trip.id]??trip.tip_amount??''} onChange={e=>setTipInput({...tipInput,[trip.id]:e.target.value})} placeholder="0"/><button className="db-button secondary" disabled={saving===trip.id} onClick={()=>saveTip(trip,tipInput[trip.id]??0)}>Save tip</button></div>}
              {!driverSide&&<div className="db-payout-actions">{trip.payment_status==='received'?<span className="db-job-meta">Payment confirmed by driver</span>:<><button className="db-button" disabled={saving===trip.id||trip.payment_status==='sent'||!['approved','resolved'].includes(trip.delivery_review_status)} onClick={()=>sendPayment(trip)}>{trip.payment_status==='sent'?'Payment sent':'Send payment'}</button>{trip.payment_status==='sent'?<span className="db-job-meta">Awaiting driver confirmation</span>:<span className="db-job-meta">Secure in-app payment to {trip.driver_name||'the driver'}</span>}</>}</div>}
              {driverSide&&<div className="db-status-row">Payment status<span>{trip.payment_status==='received'?'Confirmed received':trip.payment_status==='sent'?'Sent by broker':'Awaiting broker payment'}</span></div>}
              {driverSide&&trip.payment_status==='sent'&&<div className="db-payout-actions"><button className="db-button" disabled={saving===trip.id} onClick={()=>confirmReceipt(trip)}>Confirm payment received</button></div>}
            </div>}
            {trip.status==='completed'&&!reviewed&&<button className="db-link-btn db-review-button" onClick={()=>setReviewTrip(trip)}>Leave a review</button>}
          </article>;
        }):<div className="db-panel db-empty"><strong>No assigned trips yet</strong>A private trip workspace appears automatically when a broker accepts a driver’s bid.</div>}
      </div>
    </PullToRefresh></main>
    {alert&&<div className="db-toast" role="status">{alert}</div>}
    {pickupTrip&&<Modal title="Record pickup condition" onClose={()=>setPickupTrip(null)}><form className="db-form" onSubmit={submitPickupCondition}><div className="db-trip-notice"><strong>Before departure:</strong> record the starting odometer, photograph the vehicle at pickup, and note any visible pre-existing condition.</div><div className="db-form-grid">
      <Field label="Starting odometer"><input type="number" min="0" step="1" value={pickup.pickup_odometer} onChange={e=>setPickup({...pickup,pickup_odometer:e.target.value})} required/></Field>
      <Field label="Pickup-condition photo"><input type="file" accept="image/*" capture="environment" onChange={e=>setPickup({...pickup,pickup_photo:e.target.files?.[0]||null})} required={!pickupTrip.pickup_photo}/></Field>
      <Field label="Condition notes" full><textarea value={pickup.pickup_condition_notes} onChange={e=>setPickup({...pickup,pickup_condition_notes:e.target.value})} placeholder="Note scratches, warning lights, damage, cleanliness, fuel level, or write No visible issues."/></Field>
      <Field label="Acknowledgment" full><label className="db-consent"><input type="checkbox" checked={pickup.pickup_condition_acknowledged} onChange={e=>setPickup({...pickup,pickup_condition_acknowledged:e.target.checked})}/>I confirm this record accurately reflects the vehicle condition at pickup.</label></Field>
    </div><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setPickupTrip(null)}>Cancel</button><button className="db-button" disabled={saving===pickupTrip.id}>Save pickup record</button></div></form></Modal>}
    {incidentTrip&&<Modal title="Report a trip incident" onClose={()=>setIncidentTrip(null)}><form className="db-form" onSubmit={submitIncident}><div className="db-form-grid">
      <Field label="Category"><MobileSelect value={incident.category} onChange={v=>setIncident({...incident,category:v})}>{[['vehicle_condition','Vehicle condition'],['delay','Delay'],['documentation','Documentation'],['expense','Expense'],['payment','Payment'],['other','Other']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</MobileSelect></Field>
      <Field label="Photo (optional)"><input type="file" accept="image/*" capture="environment" onChange={e=>setIncident({...incident,photo:e.target.files?.[0]||null})}/></Field>
      <Field label="What happened?" full><textarea value={incident.description} onChange={e=>setIncident({...incident,description:e.target.value})} required placeholder="Describe the issue factually, including when and where it occurred."/></Field>
    </div><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setIncidentTrip(null)}>Cancel</button><button className="db-button" disabled={saving===incidentTrip.id}>Submit incident</button></div></form></Modal>}
    {disputeTrip&&<Modal title="Open delivery dispute" onClose={()=>setDisputeTrip(null)}><form className="db-form" onSubmit={openDispute}><div className="db-alert pending"><div className="db-alert-icon">!</div><div><strong>Payment will be paused</strong><p>The driver, broker, and administrator will retain access to the trip record and messages while the issue is reviewed.</p></div></div><Field label="Reason for dispute" full><textarea value={disputeReason} onChange={e=>setDisputeReason(e.target.value)} required placeholder="Explain what needs to be reviewed and reference any photos, expenses, or messages."/></Field><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setDisputeTrip(null)}>Cancel</button><button className="db-button danger" disabled={saving===disputeTrip.id}>Open dispute</button></div></form></Modal>}
    {routeTrip&&<Modal title="GPS route history" onClose={()=>setRouteTrip(null)}><div className="db-form"><div className="db-trip-notice"><strong>Trip history:</strong> location points are recorded only while the driver has actively consented to sharing.</div><div className="db-expense-list">{locations.filter(x=>x.trip_id===routeTrip.id).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at)).map((point,index)=><div className="db-expense-row" key={point.id}><div><strong>Point {index+1}</strong><small>{new Date(point.recorded_at).toLocaleString()} · Accuracy {Number(point.accuracy_meters||0).toFixed(0)} m</small></div><a className="db-link-btn" href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`} target="_blank" rel="noreferrer">Map</a></div>)}</div></div></Modal>}
    {proofTrip&&<Modal title="Complete delivery record" onClose={()=>setProofTrip(null)}><form className="db-form" onSubmit={submitDeliveryProof}><div className="db-trip-notice"><strong>Private delivery evidence:</strong> these photos and odometer readings are saved with the trip and are available to the assigned driver, broker, and platform admin.</div><div className="db-form-grid">
      <Field label="Starting odometer"><input type="number" min="0" step="1" inputMode="numeric" value={proof.pickup_odometer} onChange={e=>setProof({...proof,pickup_odometer:e.target.value})} required/></Field>
      <Field label="Pickup photo"><input type="file" accept="image/*" capture="environment" onChange={e=>setProof({...proof,pickup_photo:e.target.files?.[0]||null})} required={!proofTrip.pickup_photo}/></Field>
      <Field label="Ending odometer"><input type="number" min="0" step="1" inputMode="numeric" value={proof.delivery_odometer} onChange={e=>setProof({...proof,delivery_odometer:e.target.value})} required/></Field>
      <Field label="Delivery photo"><input type="file" accept="image/*" capture="environment" onChange={e=>setProof({...proof,delivery_photo:e.target.files?.[0]||null})} required={!proofTrip.delivery_photo}/></Field>
      <Field label="Delivery-condition notes" full><textarea value={proof.delivery_condition_notes} onChange={e=>setProof({...proof,delivery_condition_notes:e.target.value})} placeholder="Note any change in condition, or write No change from pickup."/></Field>
      <Field label="Acknowledgment" full><label className="db-consent"><input type="checkbox" checked={proof.delivery_condition_acknowledged} onChange={e=>setProof({...proof,delivery_condition_acknowledged:e.target.checked})}/>I confirm this record accurately reflects the vehicle condition at delivery.</label></Field>
    </div><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setProofTrip(null)}>Keep trip open</button><button className="db-button" disabled={saving===proofTrip.id}>Save record & complete</button></div></form></Modal>}
    {expenseTrip&&<Modal title="Add trip expense" onClose={()=>setExpenseTrip(null)}><form className="db-form" onSubmit={submitExpense}><div className="db-form-grid">
      <Field label="Category"><MobileSelect value={expense.category} onChange={v=>setExpense({...expense,category:v})}>{['Gas','Tolls','Parking','Food','Other'].map(x=><option key={x}>{x}</option>)}</MobileSelect></Field>
      <Field label="Amount"><input type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})} required/></Field>
      <Field label="Date"><input type="date" value={expense.expense_date} onChange={e=>setExpense({...expense,expense_date:e.target.value})}/></Field>
      <Field label="Receipt (optional)"><input type="file" accept="image/*,.pdf" onChange={e=>setExpense({...expense,receipt:e.target.files?.[0]||null})}/></Field>
      <Field label="Notes" full><textarea value={expense.notes} onChange={e=>setExpense({...expense,notes:e.target.value})}/></Field>
    </div><div className="db-form-actions"><button type="button" className="db-button secondary" onClick={()=>setExpenseTrip(null)}>Cancel</button><button className="db-button" disabled={saving===expenseTrip.id}>Submit expense</button></div></form></Modal>}
    {reviewTrip&&<Modal title="Leave a review" onClose={()=>setReviewTrip(null)}><form className="db-form" onSubmit={submitReview}><div className="db-form-grid"><Field label="Rating" full><MobileSelect value={review.rating} onChange={v=>setReview({...review,rating:v})}>{[5,4,3,2,1].map(x=><option value={x} key={x}>{x} star{x===1?'':'s'}</option>)}</MobileSelect></Field><Field label="Review" full><textarea value={review.comment} onChange={e=>setReview({...review,comment:e.target.value})} placeholder="Describe the communication and delivery experience"/></Field></div><div className="db-form-actions"><button className="db-button" disabled={saving===reviewTrip.id}>Submit review</button></div></form></Modal>}
    {chatTrip&&<Modal title={`Trip chat · ${chatTrip.vehicle_info||'vehicle'}`} onClose={()=>setChatTrip(null)}><div className="db-chat"><div className="db-chat-messages" ref={chatScrollRef}>{chatMessages.length?chatMessages.map(m=><div className={`db-chat-msg ${m.sender_id===user.id?'mine':''}`} key={m.id}><div className="db-chat-bubble"><strong>{m.sender_role}{m.sender_name?` · ${m.sender_name}`:''}</strong><p>{m.content}</p><small>{new Date(m.created_date).toLocaleString()}</small></div></div>):<div className="db-empty"><strong>No messages yet</strong>Start the conversation with the {chatTrip.driver_id===user.id?'broker':'driver'}.</div>}</div>{chatTrip.payment_status==='received'?<div className="db-notice" style={{margin:0}}>This chat is closed — payment has been confirmed.</div>:<form className="db-chat-input" onSubmit={sendMessage}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a message…" required/><button className="db-button" disabled={saving==='chat'}>Send</button></form>}</div></Modal>}
  </div>;
}
function Field({label,full=false,children}){return <div className={`db-field ${full?'full':''}`}><label>{label}</label>{children}</div>}
function Modal({title,onClose,children}){return <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><motion.div className="db-modal-card" initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} transition={{duration:0.2,ease:'easeOut'}}><div className="db-modal-head"><h2>{title}</h2><button className="db-close" onClick={onClose}>×</button></div>{children}</motion.div></div>}