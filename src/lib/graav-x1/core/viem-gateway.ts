import { decodeEventLog, parseAbiItem, type PublicClient } from 'viem';
import { X1 } from './config';
import { address, need } from './security';
import type { Address, Gateway, Hex, Quote } from './types';

/** Supply from the existing V2 ABI, never from the old selector-only overlay. */
export interface BuyCodec {
  quoteBuy(client: PublicClient, wallet: Address, now: number): Promise<Pick<Quote,'to'|'data'|'minOut'|'expiresAt'|'creator'>>;
  /** Decode calldata and assert BUY direction, token, recipient, input, minOut and deadline enforcement. */
  assertBuyCall(quote: Quote, wallet: Address): void;
  creatorAt(client:PublicClient, blockNumber:bigint):Promise<Address|null>;
}
const transferAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
function missingTx(e: unknown) { const name = (e as {name?:string})?.name; return name==='TransactionNotFoundError' || name==='TransactionReceiptNotFoundError'; }
export function viemGateway(client: PublicClient, codec: BuyCodec): Gateway {
  async function checkChain() { need(await client.getChainId()===X1.chainId,'RPC_WRONG_CHAIN',503); }
  return {
    async quoteBuy(wallet,now) {
      await checkChain();
      const [preparedBlock,transactionNonce,quote] = await Promise.all([
        client.getBlockNumber({cacheTime:0}),client.getTransactionCount({address:wallet,blockTag:'pending'}),codec.quoteBuy(client,wallet,now),
      ]);
      const result = {...quote,transactionNonce,preparedBlock:Number(preparedBlock)};
      codec.assertBuyCall(result,wallet);
      await client.estimateGas({account:wallet,to:result.to,data:result.data,value:BigInt(X1.amountWei)});
      return result;
    },
    async observe(hash) {
      await checkChain();
      try {
        const [tx,r] = await Promise.all([client.getTransaction({hash}),client.getTransactionReceipt({hash})]);
        if (!tx.blockHash || tx.blockNumber===null) return null;
        const [block,head] = await Promise.all([client.getBlock({blockNumber:r.blockNumber}),client.getBlockNumber({cacheTime:0})]);
        need(tx.to && r.to && block.hash,'BAD_RECEIPT');
        const transfers: {token:Address;from:Address;to:Address;value:string;removed:boolean}[] = [];
        for (const log of r.logs) {
          if (address(log.address)!==address(X1.token)) continue;
          try {
            const event = decodeEventLog({abi:[transferAbi],data:log.data,topics:log.topics,strict:true});
            transfers.push({token:address(log.address),from:event.args.from.toLowerCase() as Address,to:event.args.to.toLowerCase() as Address,value:event.args.value.toString(),removed:log.removed});
          } catch { /* Non-Transfer event. No output is inferred from it. */ }
        }
        return {chainId:X1.chainId,
          tx:{hash:tx.hash,from:address(tx.from),to:address(tx.to),value:tx.value.toString(),input:tx.input,nonce:tx.nonce,chainId:Number(tx.chainId),blockHash:tx.blockHash,blockNumber:Number(tx.blockNumber)},
          receipt:{transactionHash:r.transactionHash,from:address(r.from),to:address(r.to),status:r.status,blockHash:r.blockHash,blockNumber:Number(r.blockNumber)},
          block:{hash:block.hash,number:Number(block.number),timestamp:Number(block.timestamp)},head:Number(head),transfers};
      } catch(e) { if(missingTx(e)) return null; throw e; }
    },
    async canonicalBlock(number) {
      await checkChain();
      const [block,head] = await Promise.all([client.getBlock({blockNumber:BigInt(number)}),client.getBlockNumber({cacheTime:0})]);
      need(block.hash,'BLOCK_NOT_FOUND',503); return {hash:block.hash as Hex,head:Number(head)};
    },
    async creatorAt(number) { await checkChain(); return codec.creatorAt(client,BigInt(number)); },
  };
}
