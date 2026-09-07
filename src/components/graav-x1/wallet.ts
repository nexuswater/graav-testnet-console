import { X1 } from '@/lib/graav-x1/core/config';
import { address, need } from './web-validation';

export type EvmProvider = { request(args:{method:string;params?:unknown[]}):Promise<unknown> };
export type WalletProps = { connectedWallet: string|null; getProvider():EvmProvider|null; onConnect():Promise<void> };

export class ConsoleApiError extends Error {
  constructor(public readonly code: string, public readonly status = 0) { super(code); this.name = "ConsoleApiError"; }
}

export function userFacingError(error: unknown, fallback = "BIND_ERROR — Please reload and try again."): string {
  if (error instanceof ConsoleApiError) {
    if (error.code === "X_LOGIN_REQUIRED" || error.code === "X_SESSION_REQUIRED") return "X_LOGIN_REQUIRED — Sign in with X to view your rewards identity.";
    if (error.code === "SERVICE_UNAVAILABLE" || error.code === "REQUEST_FAILED") return "BIND_ERROR — Rewards identity is temporarily unavailable. Please try again.";
    if (error.code === "BIND_REQUEST_INVALID" || error.code === "BAD_WALLET" || error.code === "BAD_X_ID") return "BIND_ERROR — The identity request was invalid. Reload and try again.";
    return error.code + " — Please reload and try again.";
  }
  const message = error instanceof Error ? error.message : "";
  if (/expected pattern|invalid url/i.test(message)) return "BIND_ERROR — The identity request was invalid. Reload and try again.";
  return fallback;
}
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
  let r: Response;
  try {
    r = await fetch(path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  } catch { throw new ConsoleApiError("REQUEST_FAILED"); }
  let result: unknown;
  try { result = await r.json(); } catch { throw new ConsoleApiError("REQUEST_FAILED", r.status); }
  const code = typeof result === "object" && result !== null && typeof (result as {error?:unknown}).error === "string" ? (result as {error:string}).error : undefined;
  if (!r.ok) throw new ConsoleApiError(code ?? "REQUEST_FAILED", r.status);
  return result as T;
}
export function short(wallet:string){return `${wallet.slice(0,6)}…${wallet.slice(-4)}`;}
