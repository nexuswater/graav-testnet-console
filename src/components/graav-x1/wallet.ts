import { X1 } from '@/lib/graav-x1/core/config';
import { address, need } from './web-validation';

export type EvmProvider = { request(args:{method:string;params?:unknown[]}):Promise<unknown> };
export type WalletProps = { connectedWallet: string|null; getProvider():EvmProvider|null; onConnect():Promise<void> };
export async function requireWallet(getProvider:()=>EvmProvider|null,expected:string) {
  const provider=getProvider(); need(provider,'Connect your wallet first.');
  const accounts=await provider.request({method:'eth_accounts'}) as string[];
  need(accounts?.[0] && address(accounts[0])===address(expected),'Wallet changed. Review this action again.');
  return provider;
}
export async function ensureChain(provider:EvmProvider) {
  const chainId=`0x${X1.chainId.toString(16)}`;
  if(BigInt(await provider.request({method:'eth_chainId'}) as string)===BigInt(X1.chainId)) return;
  try { await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]}); }
  catch(e) {
    if((e as {code?:number}).code!==4902) throw e;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:'XRPL EVM Testnet',nativeCurrency:{name:'XRP',symbol:'XRP',decimals:18},rpcUrls:[X1.rpc],blockExplorerUrls:[X1.explorer]}]});
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
  }
  need(BigInt(await provider.request({method:'eth_chainId'}) as string)===BigInt(X1.chainId),'Switch to XRPL EVM Testnet.');
}
export async function api<T>(path:string,body?:unknown):Promise<T> {
  const r=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
    headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await r.json(); if(!r.ok) throw new Error(result.error || `Request failed (${r.status})`); return result as T;
}
export function short(wallet:string){return `${wallet.slice(0,6)}…${wallet.slice(-4)}`;}
