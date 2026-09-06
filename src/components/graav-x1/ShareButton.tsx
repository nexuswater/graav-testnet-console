'use client';
import { useState } from 'react';
import { X1 } from '@/lib/graav-x1/core/config';
import { api } from './wallet';
export function ShareButton({bound}:{bound:boolean}){
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function mint(){setBusy(true);setError('');try{const s=await api<{shareUrl:string}>('/api/s',{action:'BUY',market:X1.market,amountWei:X1.amountWei,share:true});setUrl(s.shareUrl);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section><button disabled={!bound||busy} onClick={()=>void mint()}>Create Share & Earn link</button>{!bound&&<p><a href="/you">Link your X account and wallet to earn.</a></p>}{url&&<p><a href={url}>{url}</a> <button onClick={()=>void navigator.clipboard.writeText(url).catch(()=>setError('Copy the displayed link manually.'))}>Copy link</button></p>}<p role="alert">{error}</p></section>;
}
