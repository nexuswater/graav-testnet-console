'use client';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { X1 } from '@/lib/graav-x1/core/config';
import type { TypedData } from '@/lib/graav-x1/core/types';
import { api,ensureChain,requireWallet,short,type WalletProps } from './wallet';
import { address,need } from './web-validation';

type Status={x:{xUserId:string;handle:string|null};binding:{id:string;wallet:string;boundAt:number}|null};
type Rewards={balanceWei:string;entries:{id:string;kind:string;amount_wei:string;distributor_wallet:string;explorerUrl:string}[]};
export function YouPanel(props:WalletProps & {onXLogin():void}) {
  const [status,setStatus]=useState<Status|null>(null),[rewards,setRewards]=useState<Rewards|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function refresh(){
    try {const s=await api<Status>('/api/bind/status');setStatus(s);setRewards(await api<Rewards>('/api/rewards'));}
    catch(e){if((e as Error).message==='X_LOGIN_REQUIRED'){setStatus(null);setRewards(null);}else setError((e as Error).message);}
  }
  useEffect(()=>{void refresh();},[]);
  async function signBind(revoke=false){
    setError('');setBusy(true);
    try {
      need(status && props.connectedWallet,'Sign in with X and connect your wallet.');
      const wallet=props.connectedWallet,provider=await requireWallet(props.getProvider,wallet);await ensureChain(provider);
      const c=await api<{nonce:string;typedData:TypedData}>(revoke?'/api/bind/revoke/challenge':'/api/bind/challenge',{wallet});
      need(c.typedData.message.xUserId===status.x.xUserId && address(String(c.typedData.message.wallet))===address(wallet),'Identity changed. Reload and review.');
      need(c.typedData.domain.chainId===X1.chainId && address(c.typedData.domain.verifyingContract)===address(X1.factory),'Unexpected signature domain.');
      need(c.typedData.primaryType===(revoke?'GRAAVRevoke':'GRAAVBind'),'Unexpected signature request.');
      await requireWallet(props.getProvider,wallet);
      const signature=await provider.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(c.typedData)]});
      await requireWallet(props.getProvider,wallet);
      await api('/api/bind/confirm',{wallet,nonce:c.nonce,signature}); await refresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const canSign=Boolean(status && props.connectedWallet && !busy);
  const isCurrent=Boolean(status?.binding && props.connectedWallet && address(status.binding.wallet)===address(props.connectedWallet));
  return <main className="graav-x1">
    <p className="eyebrow">GRAAV / YOU</p><h1>Your rewards identity</h1>
    <div className="x1-card">
      <div className="x1-row"><span>X</span><strong>{status ? `@${status.x.handle||status.x.xUserId}`:'Not signed in'}</strong><span>{status?.binding?'Bound':status?'Logged in':''}</span></div>
      <div className="x1-row"><span>Wallet</span><strong>{props.connectedWallet?short(props.connectedWallet):'Not connected'}</strong><span>{props.connectedWallet?'Connected':''}</span></div>
      <div className="x1-row"><span>Bind</span><strong>{status?.binding?short(status.binding.wallet):'Not bound'}</strong></div>
      <p>Needed for creator and share rewards. Never signs trades.</p>
      <p className="muted">Linking your identity does not move XRP.</p>
      {!status && <button onClick={props.onXLogin}>Sign in with X</button>}
      {!props.connectedWallet && <button onClick={()=>void props.onConnect().catch(e=>setError((e as Error).message))}>Connect wallet</button>}
      <button disabled={!canSign} onClick={()=>void signBind()}>{busy?'Check wallet…':status?.binding?'Sign to rebind':'Sign to link'}</button>
      {isCurrent && <button className="secondary" disabled={busy} onClick={()=>void signBind(true)}>Revoke bind</button>}
    </div>
    <p role="alert">{error}</p>
    {rewards && <section className="x1-card"><h2>Share rewards</h2><strong>{formatEther(BigInt(rewards.balanceWei))} XRP</strong>
      <p className="muted">Testnet off-chain credit. No XRP payout has been sent.</p>
      {!rewards.entries.length && <p>Credits appear after an eligible shared BUY is verified.</p>}
      <ul>{rewards.entries.map(e=><li key={e.id}>{e.kind==='REVERSAL'?'Reversal':'Credit'} · {formatEther(BigInt(e.amount_wei))} XRP · {short(e.distributor_wallet)} · <a href={e.explorerUrl} target="_blank" rel="noreferrer">Buy transaction</a></li>)}</ul>
    </section>}
  </main>;
}
