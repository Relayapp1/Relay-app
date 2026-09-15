import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { isDriveBidOwner } from '@/lib/ownerAccess';
import PageNotFound from './lib/PageNotFound';
const ForgotPassword=lazy(()=>import('@/pages/ForgotPassword'));
const ResetPassword=lazy(()=>import('@/pages/ResetPassword'));
const DriveBid=lazy(()=>import('@/pages/DriveBid'));
const AdminDashboard=lazy(()=>import('@/pages/AdminDashboard'));
const BrokerApplication=lazy(()=>import('@/pages/BrokerApplication'));
const AccountProfile=lazy(()=>import('@/pages/AccountProfile'));
const TripCenter=lazy(()=>import('@/pages/TripCenter'));
const OwnerLogin=lazy(()=>import('@/pages/OwnerLogin'));
const VerifyEmail=lazy(()=>import('@/pages/VerifyEmail'));
const ChangePassword=lazy(()=>import('@/pages/ChangePassword'));
const PrivacyPolicy=lazy(()=>import('@/pages/PrivacyPolicy'));
const TermsOfService=lazy(()=>import('@/pages/TermsOfService'));
const DataConsent=lazy(()=>import('@/pages/DataConsent'));

const CONSENT_EXEMPT_PATHS=['/data-consent','/privacy','/terms'];

function OwnerRoute({children}){
  const {user}=useAuth();
  return isDriveBidOwner(user)?children:<Navigate to="/" replace/>;
}

function AuthenticatedApp(){
  const {isLoadingAuth,authError,user}=useAuth();
  const location=useLocation();
  if(isLoadingAuth)return <div className="db-loading"><div><div className="db-spinner"/><span>Loading Relay…</span></div></div>;
  if(authError){
    const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
    return <div className="db-shell"><main className="db-page" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh'}}><div className="db-panel db-admin-denied"><h1>{offline?"You're offline":'Something went wrong'}</h1><p>{offline?'Relay needs an internet connection. Check your connection and try again.':(authError.message||'We couldn’t load Relay. Please try again.')}</p><button className="db-button" onClick={()=>window.location.reload()}>Retry</button></div></main></div>;
  }
  if(user&&!isDriveBidOwner(user)&&!user.data_consent_accepted_at&&!CONSENT_EXEMPT_PATHS.includes(location.pathname)){
    return <Navigate to={`/data-consent?returnTo=${encodeURIComponent(location.pathname)}`} replace/>;
  }
  return <Suspense fallback={<div className="db-loading"><div><div className="db-spinner"/><span>Loading…</span></div></div>}><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0,x:15}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-15}} transition={{duration:0.2,ease:'easeOut'}}><Routes location={location}>
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Register/>}/>
    <Route path="/forgot-password" element={<ForgotPassword/>}/>
    <Route path="/reset-password" element={<ResetPassword/>}/>
    <Route path="/owner-login" element={<OwnerLogin/>}/>
    <Route path="/verify-email" element={<VerifyEmail/>}/>
    <Route path="/privacy" element={<PrivacyPolicy/>}/>
    <Route path="/terms" element={<TermsOfService/>}/>
    <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace/>}/>}>
      <Route path="/" element={<DriveBid/>}/>
      <Route path="/admin" element={<OwnerRoute><AdminDashboard/></OwnerRoute>}/>
      <Route path="/admin/drivers" element={<Navigate to="/admin" replace/>}/>
      <Route path="/broker-application" element={<BrokerApplication/>}/>
      <Route path="/profile" element={<AccountProfile/>}/>
      <Route path="/change-password" element={<ChangePassword/>}/>
      <Route path="/trips" element={<TripCenter/>}/>
      <Route path="/data-consent" element={<DataConsent/>}/>
    </Route>
    <Route path="*" element={<PageNotFound/>}/>
  </Routes></motion.div></AnimatePresence></Suspense>;
}

export default function App(){
  return <AuthProvider><QueryClientProvider client={queryClientInstance}><Router><ScrollToTop/><AuthenticatedApp/></Router><Toaster/></QueryClientProvider></AuthProvider>;
}