/** Deterministic integer economic reference. Not deployed Solidity or an RPC quote. */
import {RLUSD_V1 as C} from './config';

export function requireModel(ok:boolean,message:string):asserts ok {if(!ok)throw new Error(message);}
export function ceilDiv(n:bigint,d:bigint){requireModel(n>=0n&&d>0n,'INVALID_DIVISION');return (n+d-1n)/d;}
export function quoteUnit(decimals:number){requireModel(Number.isInteger(decimals)&&decimals>=0&&decimals<=18,'QUOTE_DECIMALS');return 10n**BigInt(decimals);}

export function supplyAllocation(vaultBps:number){
  requireModel(Number.isInteger(vaultBps)&&vaultBps>=0&&vaultBps<=C.maxCreatorVaultBps,'VAULT_CAP');
  const total=C.totalSupplyTokens*10n**18n,lp=C.reservedLpTokens*10n**18n;
  const vault=total*BigInt(vaultBps)/10000n,curve=total-lp-vault;
  return {total,lp,vault,curve,maxFirstBuyTokens:curve*200n/10000n};
}

export type FeeInput={grossQuote:bigint;action:'BUY'|'SELL';referrerEligible:boolean;midwifeDistinct:boolean;lifetimeFeesBefore:bigint;referrerCreditsBefore:bigint};
export function splitFees(i:FeeInput){
  requireModel(i.grossQuote>=0n&&i.lifetimeFeesBefore>=0n&&i.referrerCreditsBefore>=0n,'NEGATIVE_AMOUNT');
  const total=i.grossQuote*100n/10000n;
  const creator=i.grossQuote*35n/10000n;
  const midwife=i.midwifeDistinct?i.grossQuote*5n/10000n:0n;
  const potential=i.action==='BUY'&&i.referrerEligible?i.grossQuote*20n/10000n:0n;
  const cap=(i.lifetimeFeesBefore+total)*3000n/10000n;
  const room=cap>i.referrerCreditsBefore?cap-i.referrerCreditsBefore:0n;
  const referrer=potential<room?potential:room;
  // Explicit provisional fallback: unused referral/midwife slots and rounding -> protocol.
  const protocol=total-creator-midwife-referrer;
  return {total,protocol,creator,referrer,midwife,netQuote:i.grossQuote-total,capRemaining:room-referrer};
}

export type CurveState={x:bigint;y:bigint;realQuote:bigint;curveTokens:bigint;threshold:bigint;graduated:boolean};
export function initializeCurve(decimals:number,vaultBps=0,mcapRlusd=5000n):CurveState{
  const a=supplyAllocation(vaultBps),unit=quoteUnit(decimals),threshold=C.graduationRlusd*unit,mcap=mcapRlusd*unit;
  requireModel(mcapRlusd>=4000n&&mcapRlusd<=6000n,'START_MCAP_RANGE');
  // p0=mcap/total. Calibrate virtual reserves to distribute the curve tranche near threshold.
  // x0 = curve*R*total/(R*total-curve*mcap). Floor prevents inventory over-sale.
  const denominator=threshold*a.total-a.curve*mcap;
  requireModel(denominator>0n,'INFEASIBLE_RESERVES');
  const x=a.curve*threshold*a.total/denominator,y=ceilDiv(mcap*x,a.total);
  return {x,y,realQuote:0n,curveTokens:a.curve,threshold,graduated:false};
}

export function buy(s:CurveState,grossQuote:bigint,minTokensOut=1n){
  requireModel(!s.graduated,'ALREADY_GRADUATED');requireModel(grossQuote>0n&&minTokensOut>0n,'BUY_AMOUNT');
  const fee=grossQuote/100n,net=grossQuote-fee;
  // v1 reference rejects overshoot. Requote a final fill; never silently donate/refund excess.
  requireModel(s.realQuote+net<=s.threshold,'THRESHOLD_OVERSHOOT');
  const nextX=ceilDiv(s.x*s.y,s.y+net),tokensOut=s.x-nextX;
  requireModel(tokensOut>=minTokensOut&&tokensOut<=s.curveTokens,'BUY_MIN_OUT_OR_INVENTORY');
  const state={...s,x:nextX,y:s.y+net,realQuote:s.realQuote+net,curveTokens:s.curveTokens-tokensOut};
  return {state,tokensOut,fee,net};
}

export function sell(s:CurveState,tokensIn:bigint,minQuoteOut=1n){
  requireModel(!s.graduated,'ALREADY_GRADUATED');requireModel(tokensIn>0n&&minQuoteOut>0n,'SELL_AMOUNT');
  const nextY=ceilDiv(s.x*s.y,s.x+tokensIn),gross=s.y-nextY;
  // Virtual liquidity is never spendable. A matured creator-vault sale can hit this bound.
  requireModel(gross<=s.realQuote,'INSUFFICIENT_REAL_RESERVE');
  const fee=gross/100n,quoteOut=gross-fee;
  requireModel(quoteOut>=minQuoteOut,'SELL_MIN_OUT');
  return {state:{...s,x:s.x+tokensIn,y:nextY,realQuote:s.realQuote-gross,curveTokens:s.curveTokens+tokensIn},gross,fee,quoteOut};
}

export function grossForExactNet(net:bigint){
  requireModel(net>0n,'NET_AMOUNT');
  let gross=net*100n/99n;
  while(gross-gross/100n<net)gross++;
  while(gross>0n&&(gross-1n)-(gross-1n)/100n>=net)gross--;
  requireModel(gross-gross/100n===net,'UNREPRESENTABLE_NET');return gross;
}

export function graduationPlan(s:CurveState,lpReserved:bigint,maxPriceErrorBps=1n){
  requireModel(!s.graduated&&s.realQuote>=s.threshold,'NOT_READY');
  requireModel(lpReserved>0n,'LP_RESERVE');
  // Preserve last marginal curve price y/x using actual quote, never virtual quote.
  const tokenForLp=s.realQuote*s.x/s.y;
  requireModel(tokenForLp>0n&&tokenForLp<=lpReserved,'LP_INVENTORY_INSUFFICIENT');
  const lhs=s.realQuote*s.x,rhs=s.y*tokenForLp,difference=lhs>=rhs?lhs-rhs:rhs-lhs;
  requireModel(difference*10000n<=rhs*maxPriceErrorBps,'LP_PRICE_ERROR');
  return {quoteForLp:s.realQuote,tokenForLp,burnReserved:lpReserved-tokenForLp,burnCurveDust:s.curveTokens,
    state:{...s,realQuote:0n,curveTokens:0n,graduated:true}};
}

export type ReferralEvidence={
  action:'BUY'|'SELL';viaXUserId:string|null;buyerXUserIds:string[];buyerWallet:string;creatorWallet:string|null;
  binding:{id:string;xUserId:string;wallet:string;chainId:number;active:boolean}|null;
  touchBindingId:string|null;clickedAt:number;executedAt:number;accountCreatedAt:number|null;
  automatedAccount:boolean|null;sourcePostStatus:'EXISTS'|'DELETED'|'UNKNOWN';
};
export function referralReason(e:ReferralEvidence):string{
  if(e.action!=='BUY')return 'NOT_BUY';
  if(!e.viaXUserId||!(/^[1-9][0-9]{0,19}$/).test(e.viaXUserId))return 'NO_NUMERIC_REF';
  if(!e.binding||!e.binding.active||e.binding.id!==e.touchBindingId||e.binding.xUserId!==e.viaXUserId)return 'UNBOUND_OR_CHANGED';
  if(e.binding.chainId!==C.chainId)return 'WRONG_BIND_CHAIN';
  if(e.executedAt<e.clickedAt||e.executedAt-e.clickedAt>=C.attributionWindowSeconds)return 'EXPIRED';
  if(e.buyerXUserIds.includes(e.viaXUserId))return 'SELF_X';
  if(e.buyerWallet.toLowerCase()===e.binding.wallet.toLowerCase())return 'SELF_WALLET';
  if(!e.creatorWallet)return 'CREATOR_UNKNOWN';
  if(e.creatorWallet.toLowerCase()===e.binding.wallet.toLowerCase())return 'CREATOR_WALLET';
  if(e.accountCreatedAt===null||e.accountCreatedAt>e.clickedAt||e.clickedAt-e.accountCreatedAt<C.minReferrerAgeSeconds)return 'ACCOUNT_AGE';
  if(e.automatedAccount!==false)return 'ACCOUNT_CLASSIFICATION';
  if(e.sourcePostStatus!=='EXISTS')return 'POST_UNVERIFIED_OR_DELETED';
  return 'ELIGIBLE';
}

export function createFee(decimals:number,confirmedGrossFirstBuy:bigint){
  requireModel(confirmedGrossFirstBuy>=0n,'NEGATIVE_BUY');const unit=quoteUnit(decimals);
  return confirmedGrossFirstBuy>=20n*unit?0n:2n*unit;
}
