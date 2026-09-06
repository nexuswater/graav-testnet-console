import { X1 } from './config';
import { address, need } from './security';
import type { Evidence, Hex, Observation, Order, Quote } from './types';

export function validateQuote(quote: Quote, now: number) {
  need(address(quote.to) === address(X1.v2), 'QUOTE_DESTINATION');
  need(/^0x(?:[0-9a-fA-F]{2}){4,}$/.test(quote.data), 'QUOTE_CALLDATA');
  need(/^[1-9][0-9]*$/.test(quote.minOut), 'QUOTE_MIN_OUT');
  need(Number.isSafeInteger(quote.transactionNonce) && quote.transactionNonce >= 0, 'QUOTE_NONCE');
  need(Number.isSafeInteger(quote.preparedBlock) && quote.preparedBlock >= 0, 'QUOTE_BLOCK');
  need(Number.isSafeInteger(quote.expiresAt) && quote.expiresAt > now && quote.expiresAt <= now + X1.orderTtl, 'QUOTE_EXPIRY');
  if (quote.creator) address(quote.creator);
}
export function verifyBuyEvidence(order: Order, expectedHash: Hex, o: Observation, confirmations = X1.confirmations): Evidence {
  const { tx, receipt, block } = o;
  need(o.chainId === X1.chainId && tx.chainId === X1.chainId, 'WRONG_CHAIN');
  need(tx.hash.toLowerCase() === expectedHash && receipt.transactionHash.toLowerCase() === expectedHash, 'HASH_MISMATCH');
  need(address(tx.from) === order.wallet && address(receipt.from) === order.wallet, 'BUYER_MISMATCH');
  need(address(tx.to) === address(order.quote.to) && address(receipt.to) === address(order.quote.to), 'DESTINATION_MISMATCH');
  need(BigInt(tx.value) === BigInt(X1.amountWei), 'VALUE_MISMATCH');
  need(tx.input.toLowerCase() === order.quote.data.toLowerCase(), 'CALLDATA_MISMATCH');
  need(tx.nonce === order.quote.transactionNonce, 'NONCE_MISMATCH');
  need(receipt.status === 'success', 'TX_REVERTED');
  need(tx.blockHash.toLowerCase() === receipt.blockHash.toLowerCase() && receipt.blockHash.toLowerCase() === block.hash.toLowerCase(), 'NON_CANONICAL_BLOCK');
  need(tx.blockNumber === receipt.blockNumber && receipt.blockNumber === block.number, 'BLOCK_MISMATCH');
  need(block.number > order.quote.preparedBlock, 'TX_PREDATES_ORDER');
  need(block.timestamp >= order.created_at && block.timestamp <= order.expires_at, 'TX_OUTSIDE_ORDER_WINDOW');
  need(o.head >= block.number + confirmations - 1, 'WAIT_CONFIRMATIONS', 202);
  let net = 0n;
  for (const t of o.transfers) {
    if (t.removed || address(t.token) !== address(X1.token)) continue;
    const value = BigInt(t.value); need(value >= 0n, 'BAD_TRANSFER');
    if (t.to.toLowerCase() === order.wallet) net += value;
    if (t.from.toLowerCase() === order.wallet) net -= value;
  }
  need(net >= BigInt(order.quote.minOut) && net > 0n, 'GSWAP_OUTPUT_NOT_PROVEN');
  return { txHash: expectedHash, blockHash: block.hash, blockNumber: block.number, blockTimestamp: block.timestamp, tokensOut: net.toString() };
}
