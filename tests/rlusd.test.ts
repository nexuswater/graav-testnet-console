import test from 'node:test';
import assert from 'node:assert/strict';
import {RLUSD_V1 as C} from '../src/lib/rlusd-v1/config.js';
import {supplyAllocation,splitFees,initializeCurve,buy,sell,graduationPlan,grossForExactNet,referralReason,createFee,type ReferralEvidence} from '../src/lib/rlusd-v1/model.js';
import {transition,mayCreateReferralCredit,verifyDestinationBuy} from '../src/lib/rlusd-v1/crosschain.js';
const X1 = {chainId: 1449000};
const baseFee={grossQuote:100_000_000n,action:'BUY' as const,referrerEligible:true,midwifeDistinct:true,lifetimeFeesBefore:0n,referrerCreditsBefore:0n};
test('RLUSD module cannot silently reuse testnet chain or economics',()=>{
  assert.equal(C.chainId,1440000);assert.equal(X1.chainId,1449000);assert.equal(C.bindVerifyingContract,null);assert.equal(C.liveExecutionEnabled,false);
});
test('creator vault fits inside the fixed billion-token supply',()=>{
  const a=supplyAllocation(1500);assert.equal(a.total,a.curve+a.vault+a.lp);assert.equal(a.curve,650_000_000n*10n**18n);assert.equal(a.maxFirstBuyTokens,a.curve/50n);
  assert.throws(()=>supplyAllocation(1501),/VAULT_CAP/);assert.throws(()=>supplyAllocation(-1),/VAULT_CAP/);
});
test('100 RLUSD BUY splits 40/35/20/5 bps exactly',()=>{
  const f=splitFees(baseFee);assert.equal(f.total,1_000_000n);assert.equal(f.protocol,400_000n);assert.equal(f.creator,350_000n);assert.equal(f.referrer,200_000n);assert.equal(f.midwife,50_000n);
  assert.equal(f.netQuote,99_000_000n);
});
test('SELL and unavailable roles conserve fees with the explicit protocol fallback',()=>{
  const s=splitFees({...baseFee,action:'SELL'});assert.equal(s.referrer,0n);assert.equal(s.protocol,600_000n);
  const f=splitFees({...baseFee,referrerEligible:false,midwifeDistinct:false});assert.equal(f.protocol,650_000n);assert.equal(f.creator,350_000n);
});
test('integer dust and lifetime-cap remainder never create extra fees',()=>{
  for(const grossQuote of [1n,99n,100n,999n,123456789n]){
    const f=splitFees({...baseFee,grossQuote});assert.equal(f.total,f.protocol+f.creator+f.referrer+f.midwife);
  }
  const capped=splitFees({...baseFee,lifetimeFeesBefore:1_000_000n,referrerCreditsBefore:599_999n});assert.equal(capped.referrer,1n);
  assert.throws(()=>splitFees({...baseFee,grossQuote:-1n}),/NEGATIVE/);
});
for(const decimals of [6,18])test(`curve round trip preserves invariant and actual reserves at ${decimals} quote decimals`,()=>{
  const s=initializeCurve(decimals),input=100n*10n**BigInt(decimals),b=buy(s,input),r=sell(b.state,b.tokensOut);
  assert.ok(b.state.x*b.state.y>=s.x*s.y);assert.ok(r.state.x*r.state.y>=b.state.x*b.state.y);
  assert.ok(r.quoteOut<input);assert.ok(r.state.realQuote>=0n);assert.equal(r.state.realQuote+b.fee+r.fee+r.quoteOut,input);
});
test('virtual quote cannot fund a sell before real quote exists',()=>assert.throws(()=>sell(initializeCurve(6),10n**18n),/REAL_RESERVE/));
test('curve enforces minOut and rejects threshold overshoot',()=>{
  const s=initializeCurve(6);assert.throws(()=>buy(s,1_000_000n,10n**40n),/MIN_OUT/);assert.throws(()=>buy(s,100_000n*10n**6n),/OVERSHOOT/);
});
for(const vault of [0,1500])for(const mcap of [4000n,5000n,6000n])test(`graduation conserves quote/token inventory and price for vault ${vault}, mcap ${mcap}`,()=>{
  const a=supplyAllocation(vault),s=initializeCurve(6,vault,mcap),b=buy(s,grossForExactNet(s.threshold)),g=graduationPlan(b.state,a.lp);
  assert.equal(g.quoteForLp,s.threshold);assert.equal(g.tokenForLp+g.burnReserved,a.lp);
  assert.equal(b.tokensOut+a.vault+g.tokenForLp+g.burnReserved+g.burnCurveDust,a.total);
  assert.ok(g.state.graduated);assert.equal(g.state.realQuote,0n);assert.throws(()=>buy(g.state,100n),/GRADUATED/);
});
test('graduation cannot occur early or with insufficient reserved LP tokens',()=>{
  const s=initializeCurve(6);assert.throws(()=>graduationPlan(s,10n),/NOT_READY/);
  const b=buy(s,grossForExactNet(s.threshold));assert.throws(()=>graduationPlan(b.state,1n),/LP_INVENTORY/);
});
test('create-fee waiver uses a funded first BUY at the exact boundary',()=>{
  assert.equal(createFee(6,19_999_999n),2_000_000n);assert.equal(createFee(6,20_000_000n),0n);
});
function eligible():ReferralEvidence{return {action:'BUY',viaXUserId:'10001',buyerXUserIds:[],buyerWallet:'0x02',creatorWallet:'0x03',binding:{id:'bind',xUserId:'10001',wallet:'0x01',chainId:1440000,active:true},touchBindingId:'bind',clickedAt:40*86400,executedAt:40*86400+1,accountCreatedAt:0,automatedAccount:false,sourcePostStatus:'EXISTS'};}
test('RLUSD referral requires verified mainnet bind and account/post evidence',()=>{
  assert.equal(referralReason(eligible()),'ELIGIBLE');
  const e=eligible();e.binding!.chainId=1449000;assert.equal(referralReason(e),'WRONG_BIND_CHAIN');
  assert.equal(referralReason({...eligible(),automatedAccount:null}),'ACCOUNT_CLASSIFICATION');
  assert.equal(referralReason({...eligible(),sourcePostStatus:'DELETED'}),'POST_UNVERIFIED_OR_DELETED');
  assert.equal(referralReason({...eligible(),accountCreatedAt:39*86400}),'ACCOUNT_AGE');
});
test('RLUSD referral drops known self, wrong action and seven-day expiry',()=>{
  assert.equal(referralReason({...eligible(),buyerXUserIds:['10001']}),'SELF_X');
  assert.equal(referralReason({...eligible(),buyerWallet:'0x01'}),'SELF_WALLET');
  assert.equal(referralReason({...eligible(),creatorWallet:'0x01'}),'CREATOR_WALLET');
  assert.equal(referralReason({...eligible(),executedAt:47*86400}),'EXPIRED');
  assert.equal(referralReason({...eligible(),action:'SELL'}),'NOT_BUY');
  assert.equal(referralReason({...eligible(),viaXUserId:'00010001'}),'NO_NUMERIC_REF');
});
test('source completion and destination funding are not referral credit',()=>{
  let s=transition('DRAFT','QUOTE_READY');s=transition(s,'SOURCE_SUBMITTED');s=transition(s,'SOURCE_CONFIRMED');
  assert.equal(s,'BRIDGING');assert.equal(mayCreateReferralCredit(s),false);
  s=transition(s,'DESTINATION_FUNDED');assert.equal(mayCreateReferralCredit(s),false);
  s=transition(s,'BUY_SUBMITTED');s=transition(s,'BUY_VERIFIED');assert.equal(mayCreateReferralCredit(s),true);
  assert.throws(()=>transition(s,'BUY_SUBMITTED'),/INVALID/);
});
test('atomic destination hook can finish a route; refunded route cannot be credited',()=>{
  assert.equal(transition('BRIDGING','BUY_VERIFIED'),'COMPLETE');
  const s=transition(transition('BRIDGING','REFUND_STARTED'),'REFUND_VERIFIED');assert.equal(s,'REFUNDED');assert.equal(mayCreateReferralCredit(s),false);
});
test('destination proof uses beneficiary and measured RLUSD spend, not source tx sender/value',()=>{
  const p={chainId:1440000,market:'0xaa',quoteToken:C.quoteAddress,beneficiary:'0xbb',orderId:'order',quoteSpent:25_000_000n,tokensOut:500n,canonical:true,successful:true,verifiedHookCaller:true};
  const expected={chainId:1440000,market:'0xaa',quoteToken:C.quoteAddress,beneficiary:'0xbb',orderId:'order',maxQuoteSpent:25_000_000n,minTokensOut:400n};
  assert.equal(verifyDestinationBuy(p,expected),true);
  assert.throws(()=>verifyDestinationBuy({...p,beneficiary:'0xcc'},expected),/MISMATCH/);
  assert.throws(()=>verifyDestinationBuy({...p,quoteSpent:25_000_001n},expected),/AMOUNTS/);
  assert.throws(()=>verifyDestinationBuy({...p,verifiedHookCaller:false},expected),/UNVERIFIED/);
});
