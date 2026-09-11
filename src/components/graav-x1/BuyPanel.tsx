'use client';
import { useEffect,useRef,useState } from 'react';
import { formatEther } from 'viem';
import { X1 } from '@/lib/graav-x1/core/config';
import type { SessionService } from '@/lib/graav-x1/core/sessions';
import { api,ensureChain,requireWallet,short,type WalletProps } from './wallet';
import { address,need } from './web-validation';

type Prepared=Awaited<ReturnType<SessionService['prepare']>>;
type Recovery={id:string;txHash?:string;submissionStarted?:boolean};
type Phase='loading'|'ready'|'busy'|'pending'|'complete'|'failed'|'review'|'invalid';
export function BuyPanel(props:WalletProps & {sessionId:string;via?:string}) {
  const [phase,setPhase]=useState<Phase>('loading'),[order,setOrder]=useState<Prepared|null>(null);
  const [error,setError]=useState(''),[manualHash,setManualHash]=useState('');
  const recovery=useRef<Recovery|null>(null),touchKey=useRef({link:'',key:''});
  const key=`graav:x1:order:${props.sessionId}:${props.connectedWallet?.toLowerCase()||'unconnected'}`;
  function remember(r:Recovery){localStorage.setItem(key,JSON.stringify(r));recovery.current=r;}
  function apply(o:Prepared){setOrder(o);setPhase(o.status==='COMPLETE'?'complete':o.status==='FAILED'?'failed':o.status==='REVIEW_REQUIRED'?'review':o.status==='SUBMITTED'?'pending':'ready');}
  useEffect(()=>{
    let ignore=false;
    setPhase('loading');setError('');setOrder(null);recovery.current=null;
    (async()=>{
      const raw=localStorage.getItem(key);
      if(raw){
        const saved=JSON.parse(raw) as Recovery; recovery.current=saved;
        let o=await api<Prepared>(`/api/orders/${saved.id}`);
        need(o.sessionId===props.sessionId,'Stored order belongs to a different session.');
        if(saved.txHash && !o.txHash)o=await api<Prepared>(`/api/orders/${saved.id}/submitted`,{txHash:saved.txHash});
        if(ignore)return;
        apply(o);
        if(saved.submissionStarted && !saved.txHash && !o.txHash){setPhase('review');setError('Wallet submission is unresolved. Check wallet activity and recover its transaction hash before continuing.');}
      }else {
        const s=await api<{action:string;market:string;chainId:number}>(`/api/s/${props.sessionId}`);
        need(s.action==='BUY' && address(s.market)===address(X1.market) && s.chainId===X1.chainId,'Unsupported session.');
        const link=`${props.sessionId}:${props.via===undefined?'absent':props.via}`;
        if(touchKey.current.link!==link)touchKey.current={link,key:crypto.randomUUID()};
        // An unknown link never reaches this write. Existing transaction recovery does not depend on link freshness.
        await api(`/api/s/${props.sessionId}/touch`,{via:props.via,idempotencyKey:touchKey.current.key});
        if(!ignore)setPhase('ready');
      }
    })().catch(e=>{if(!ignore){setError((e as Error).message);setPhase(recovery.current?'review':'invalid');}});
    return()=>{ignore=true;};
  },[props.sessionId,props.via,key]);
  useEffect(()=>{
    if(phase!=='pending' || !order)return;
    let stop=false;
    const timer=setTimeout(()=>{
      api<Prepared>(`/api/orders/${order.id}/confirm`,{}).then(o=>{if(!stop){setError('');apply(o);}}).catch(e=>{if(!stop){setError(`${(e as Error).message}. Your existing transaction will be checked again.`);setOrder({...order});}});
    },3500);
    return()=>{stop=true;clearTimeout(timer);};
  },[phase,order]);
  async function buy(){
    setError('');setPhase('busy');
    try {
      need(props.connectedWallet,'Connect your wallet first.');const wallet=props.connectedWallet;
      // This rail pins the transaction nonce and sends through the browser wallet; WalletConnect is not wired here yet.
      need(props.getProvider(),'This buy signs through a browser wallet such as MetaMask. Open this link in your wallet’s browser.');
      const provider=await requireWallet(props.getProvider,wallet);await ensureChain(provider);
      let o=order;
      if(!o || o.expiresAt<=Date.now()/1000){
        need(!recovery.current?.submissionStarted && !recovery.current?.txHash,'Recover the existing transaction first.');
        o=await api<Prepared>(`/api/s/${props.sessionId}/prepare`,{wallet,idempotencyKey:crypto.randomUUID()});
        remember({id:o.id});setOrder(o);
      }
      need(address(o.wallet)===address(wallet),'Wallet changed. Reload with the original wallet.');
      if(o.status==='PREPARED'){
        await requireWallet(props.getProvider,wallet);
        const signature=await provider.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(o.intent)]});
        o=await api<Prepared>(`/api/orders/${o.id}/authorize`,{signature});setOrder(o);
      }
      need(o.status==='AUTHORIZED' && !o.txHash,'This order cannot request another transaction.');
      need(o.expiresAt>Date.now()/1000,'Quote expired. Prepare a new order.');
      await requireWallet(props.getProvider,wallet);await ensureChain(provider);
      need(address(o.transaction.to)===address(X1.v2) && BigInt(o.transaction.value)===BigInt(X1.amountWei),'Unexpected transaction.');
      const pendingNonce=await provider.request({method:'eth_getTransactionCount',params:[wallet,'pending']}) as string;
      need(BigInt(pendingNonce)===BigInt(o.transaction.nonce),'Wallet nonce changed. Wait for this quote to expire and prepare a fresh order.');
      const tx={...o.transaction,chainId:`0x${X1.chainId.toString(16)}`};
      await provider.request({method:'eth_estimateGas',params:[tx]});
      await requireWallet(props.getProvider,wallet);await ensureChain(provider);
      need(o.expiresAt>Date.now()/1000,'Quote expired. Prepare a new order.');
      // Durable marker BEFORE the spend request. A crash or ambiguous RPC error must not enable resend.
      remember({id:o.id,submissionStarted:true});
      let hash:string;
      try {hash=await provider.request({method:'eth_sendTransaction',params:[tx]}) as string;}
      catch(e){if((e as {code?:number}).code===4001)remember({id:o.id});throw e;}
      need(/^0x[0-9a-fA-F]{64}$/.test(hash),'Wallet returned no valid transaction hash. Recover it from wallet activity.');
      remember({id:o.id,submissionStarted:true,txHash:hash});
      const submitted=await api<Prepared>(`/api/orders/${o.id}/submitted`,{txHash:hash});apply(submitted);
    }catch(e){setError((e as Error).message);setPhase(recovery.current?.submissionStarted?'review':'ready');}
  }
  async function recover(){
    try{need(recovery.current,'No order to recover.');const hash=recovery.current.txHash||manualHash.trim();need(/^0x[0-9a-fA-F]{64}$/.test(hash),'Enter the transaction hash from your wallet.');
      remember({...recovery.current,submissionStarted:true,txHash:hash});
      apply(await api<Prepared>(`/api/orders/${recovery.current.id}/submitted`,{txHash:hash}));setError('');
    }catch(e){setError((e as Error).message);}
  }
  return <main className="graav-x1"><p className="eyebrow">SIGNING REQUEST</p><h1>Buy gSWAP</h1>
    <div className="x1-card"><div className="x1-row"><span>You pay</span><strong>0.1 XRP + network gas</strong></div>
      <div className="x1-row"><span>Wallet</span><strong>{props.connectedWallet?short(props.connectedWallet):'Not connected'}</strong></div>
      <p>Two wallet confirmations: approve this BUY intent, then confirm the transaction.</p><p className="muted">Buying does not require an X login or a rewards bind.</p>
      <details><summary>Review destination and quote</summary><p>XRPL EVM 1449000 · DEX {X1.v2}</p><p>gSWAP token {X1.token}</p>{order && <p>Minimum output: {order.minOut} token base units. Quote expires {new Date(order.expiresAt*1000).toISOString()}.</p>}</details>
      {!props.connectedWallet && <button disabled={phase==='invalid'} onClick={()=>void props.onConnect().catch(e=>setError((e as Error).message))}>Connect wallet</button>}
      <button disabled={phase!=='ready'||!props.connectedWallet} onClick={()=>void buy()}>{phase==='busy'?'Check wallet…':phase==='pending'?'Confirming…':'Review & buy 0.1 XRP'}</button>
    </div>
    <p role="status">{phase==='complete'?'BUY complete.':phase==='pending'?'Waiting for the existing transaction.':phase==='failed'?'Transaction reverted. No distributor credit recorded.':''}</p>
    <p role="alert">{error}</p>
    {(order?.txHash||recovery.current?.txHash) && <a href={`${X1.explorer}/tx/${order?.txHash||recovery.current?.txHash}`} target="_blank" rel="noreferrer">View buy transaction</a>}
    {phase==='complete' && order?.feeSplit && <p>{order.creditReason==='ELIGIBLE'?`${formatEther(BigInt(order.feeSplit.distributorWei))} XRP distributor credit recorded (off-chain).`:'No distributor credit applies to this BUY.'}</p>}
    {phase==='review' && recovery.current && !order?.txHash && <div className="x1-card"><label>Recover submitted transaction<input value={manualHash} onChange={e=>setManualHash(e.target.value)} placeholder="0x…" /></label><button onClick={()=>void recover()}>Check existing transaction</button></div>}
    {phase==='invalid' && <p>This link cannot be used to sign. Open a newly minted GRAAV session.</p>}
  </main>;
}
