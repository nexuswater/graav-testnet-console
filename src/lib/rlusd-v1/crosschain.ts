/** State reducer only. The trusted server builds events from verified adapters/receipts. */
export type RouteState='DRAFT'|'QUOTED'|'SOURCE_PENDING'|'BRIDGING'|'FUNDED_AWAITING_BUY'|'BUY_PENDING'|'COMPLETE'|'REFUND_PENDING'|'REFUNDED'|'REVIEW_REQUIRED';
export type RouteEvent='QUOTE_READY'|'SOURCE_SUBMITTED'|'SOURCE_CONFIRMED'|'DESTINATION_FUNDED'|'BUY_SUBMITTED'|'BUY_VERIFIED'|'REFUND_STARTED'|'REFUND_VERIFIED'|'MISMATCH';
const edges:Partial<Record<RouteState,Partial<Record<RouteEvent,RouteState>>>>={
  DRAFT:{QUOTE_READY:'QUOTED'},QUOTED:{SOURCE_SUBMITTED:'SOURCE_PENDING'},
  SOURCE_PENDING:{SOURCE_CONFIRMED:'BRIDGING',REFUND_STARTED:'REFUND_PENDING'},
  BRIDGING:{DESTINATION_FUNDED:'FUNDED_AWAITING_BUY',BUY_VERIFIED:'COMPLETE',REFUND_STARTED:'REFUND_PENDING'},
  FUNDED_AWAITING_BUY:{BUY_SUBMITTED:'BUY_PENDING',REFUND_STARTED:'REFUND_PENDING'},
  BUY_PENDING:{BUY_VERIFIED:'COMPLETE',REFUND_STARTED:'REFUND_PENDING'},
  REFUND_PENDING:{REFUND_VERIFIED:'REFUNDED'},
};
export function transition(state:RouteState,event:RouteEvent):RouteState{
  if(event==='MISMATCH'&&state!=='REFUNDED')return 'REVIEW_REQUIRED';
  const next=edges[state]?.[event];if(!next)throw new Error(`INVALID_ROUTE_TRANSITION:${state}:${event}`);return next;
}
export function mayCreateReferralCredit(state:RouteState){return state==='COMPLETE';}

export type DestinationBuyProof={chainId:number;market:string;quoteToken:string;beneficiary:string;orderId:string;quoteSpent:bigint;tokensOut:bigint;canonical:boolean;successful:boolean;verifiedHookCaller:boolean};
export function verifyDestinationBuy(p:DestinationBuyProof,expected:Omit<DestinationBuyProof,'canonical'|'successful'|'verifiedHookCaller'|'quoteSpent'|'tokensOut'>&{maxQuoteSpent:bigint;minTokensOut:bigint}){
  if(!p.canonical||!p.successful||!p.verifiedHookCaller)throw new Error('UNVERIFIED_DESTINATION');
  if(p.chainId!==expected.chainId||p.orderId!==expected.orderId||p.market.toLowerCase()!==expected.market.toLowerCase()||p.quoteToken.toLowerCase()!==expected.quoteToken.toLowerCase()||p.beneficiary.toLowerCase()!==expected.beneficiary.toLowerCase())throw new Error('DESTINATION_MISMATCH');
  if(p.quoteSpent<=0n||p.quoteSpent>expected.maxQuoteSpent||p.tokensOut<expected.minTokensOut||p.tokensOut<=0n)throw new Error('DESTINATION_AMOUNTS');
  return true;
}
