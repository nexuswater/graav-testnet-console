'use client';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { X1 } from '@/lib/graav-x1/core/config';
import type { TypedData } from '@/lib/graav-x1/core/types';
import { api,ensureChain,requireWallet,short,userFacingError,type WalletProps } from './wallet';
import { address,need,safeAddress } from './web-validation';
import { XMark } from '@/components/XMark';
import { XrplMark } from '@/components/XrplMark';
import { ATTRIBUTION_V1_RULE } from '@/lib/xPrimary';
import {
  GRAAV_X_HANDLE_AT,
  LAUNCH_EXAMPLE_TICKER,
  launchComposerText,
  portfolioCommandText,
  tradeCommandText,
  xDmUrl,
  xPostIntentUrl,
} from '@/lib/xLaunchComposer';

type Status={x:{xUserId:string;handle:string|null};binding:{id:string;wallet:string;boundAt:number}|null};
type XMe={bound:boolean;id?:string;username?:string};
type Rewards={balanceWei:string;entries:{id:string;kind:string;amount_wei:string;distributor_wallet:string;explorerUrl:string}[]};

/** After setup, daily ops live on X: the same commands the mention bot parses. */
const NEXT_ON_X: { label: string; text: string }[] = [
  { label: 'Launch', text: launchComposerText(LAUNCH_EXAMPLE_TICKER) },
  { label: 'Buy', text: tradeCommandText('buy', 'gSWAP', '0.1') },
  { label: 'Portfolio', text: portfolioCommandText() },
];

export function YouPanel(props:WalletProps & {onXLogin():void}) {
  const [status,setStatus]=useState<Status|null>(null),[rewards,setRewards]=useState<Rewards|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function refresh(){
    setError('');
    try {
      const me=await api<XMe>('/api/auth/x/me');
      if(!me.bound || !me.id || !me.username){ setStatus(null); setRewards(null); return; }
      const s=await api<Status>('/api/bind/status');
      need(s.x.xUserId===me.id,'X_LOGIN_REQUIRED');
      setStatus(s);
      setRewards(await api<Rewards>('/api/rewards'));
    } catch(e) {
      setStatus(null); setRewards(null);
      if((e as Error).message==='X_LOGIN_REQUIRED') setError('X_LOGIN_REQUIRED — Sign in with X to view your rewards identity.');
      else setError(userFacingError(e));
    }
  }
  useEffect(()=>{void refresh();},[]);
  async function signBind(revoke=false){
    setError('');setBusy(true);
    try {
      need(status && props.connectedWallet,'Sign in with X and connect your wallet.');
      const wallet=props.connectedWallet;
      // Connected connector first (WalletConnect or injected); raw injected provider as the fallback.
      const viaConnector=Boolean(props.signTypedData);
      if(viaConnector) await props.switchToChain?.();
      const provider=viaConnector?null:await requireWallet(props.getProvider,wallet);
      if(provider) await ensureChain(provider);
      const c=await api<{nonce:string;typedData:TypedData}>(revoke?'/api/bind/revoke/challenge':'/api/bind/challenge',{wallet});
      need(c.typedData.message.xUserId===status.x.xUserId && address(String(c.typedData.message.wallet))===address(wallet),'Identity changed. Reload and review.');
      need(c.typedData.domain.chainId===X1.chainId && address(c.typedData.domain.verifyingContract)===address(X1.factory),'Unexpected signature domain.');
      need(c.typedData.primaryType===(revoke?'GRAAVRevoke':'GRAAVBind'),'Unexpected signature request.');
      let signature:unknown;
      if(props.signTypedData){
        signature=await props.signTypedData(wallet,c.typedData);
      } else {
        await requireWallet(props.getProvider,wallet);
        signature=await provider!.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(c.typedData)]});
        await requireWallet(props.getProvider,wallet);
      }
      await api('/api/bind/confirm',{wallet,nonce:c.nonce,signature}); await refresh();
    }catch(e){setError(userFacingError(e));}finally{setBusy(false);}
  }
  const canSign=Boolean(status && props.connectedWallet && !busy);
  const isCurrent=Boolean(status?.binding && props.connectedWallet && safeAddress(status.binding.wallet)!==null && safeAddress(status.binding.wallet)===safeAddress(props.connectedWallet));
  const setupDone=Boolean(status?.binding);
  const nextStep=!status?'Sign in with X to start.':!props.connectedWallet?'Connect the wallet you trade with.':status.binding?(isCurrent?'Linked. Rewards earned on X credit this wallet.':'Linked to another wallet. Sign to rebind to this one.'):'Sign once to link this wallet to your X identity.';
  return <main className="graav-x1">
    <p className="eyebrow">ACCOUNT</p><h1>Your rewards identity</h1>
    <div className="x1-card">
      <div className="x1-row"><span style={{display:'inline-flex',alignItems:'center',gap:8}}><XMark size={18} /> X</span><strong>{status ? `@${status.x.handle||status.x.xUserId}`:'Not signed in'}</strong><span>{status?.binding?'Bound':status?'Signed in':''}</span></div>
      <div className="x1-row"><span style={{display:'inline-flex',alignItems:'center',gap:8}}><XrplMark size={22} /> Wallet</span><strong>{props.connectedWallet?short(props.connectedWallet):'Not connected'}</strong><span>{props.connectedWallet?'Connected':''}</span></div>
      <div className="x1-row"><span>Bind</span><strong>{status?.binding?short(status.binding.wallet):'Not bound'}</strong></div>
      <p>{nextStep}</p>
      <p className="muted">Identity only — it never signs a trade and never moves XRP.</p>
      {!status && <button onClick={()=>{try{props.onXLogin();}catch(e){setError((e as Error).message);}}}>Sign in with X</button>}
      {!props.connectedWallet && <button className={status?undefined:'secondary'} onClick={()=>void props.onConnect().catch(e=>setError(userFacingError(e,(e as Error).message||'Could not connect a wallet.')))}>Connect wallet</button>}
      <button disabled={!canSign} onClick={()=>void signBind()}>{busy?'Check wallet…':status?.binding?'Sign to rebind':'Sign to link'}</button>
      {isCurrent && <button className="secondary" disabled={busy} onClick={()=>void signBind(true)}>Revoke bind</button>}
    </div>
    <p role="alert">{error}</p>
    {setupDone && <section className="x1-card"><h2>You&apos;re set — next on X</h2>
      <p className="muted">Post or DM {GRAAV_X_HANDLE_AT}. GRAAV replies with a signing link; your wallet signs. Nothing is posted for you.</p>
      <ul className="x1-next">{NEXT_ON_X.map(item=><li key={item.label}><span><span className="eyebrow">{item.label.toUpperCase()}</span><code>{item.text.replace('\n',' ')}</code></span><span><a className="x1-link-btn" href={xPostIntentUrl(item.text)} target="_blank" rel="noopener noreferrer"><XMark size={12} /> Post</a><a className="x1-link-btn" href={xDmUrl(item.text)} target="_blank" rel="noopener noreferrer"><XMark size={12} /> DM</a></span></li>)}</ul>
    </section>}
    <section className="x1-card"><h2>RT / share attribution V1</h2>
      <p>{ATTRIBUTION_V1_RULE}</p>
      <p className="muted">Rewards are earned on X — posts, reposts, and DMs.</p>
    </section>
    {rewards && <section className="x1-card"><h2>Share rewards</h2><strong>{formatEther(BigInt(rewards.balanceWei))} XRP</strong>
      <p className="muted">Off-chain credit. No XRP payout has been sent yet.</p>
      {!rewards.entries.length && <p>Credits appear after an eligible shared BUY is verified.</p>}
      <ul>{rewards.entries.map(e=><li key={e.id}>{e.kind==='REVERSAL'?'Reversal':'Credit'} · {formatEther(BigInt(e.amount_wei))} XRP · {short(e.distributor_wallet)} · <a href={e.explorerUrl} target="_blank" rel="noreferrer">Buy transaction</a></li>)}</ul>
    </section>}
  </main>;
}
