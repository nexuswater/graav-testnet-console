export const X1 = {
  chainId: 1449000,
  factory: '0x72be5a300956f9dF0F4264a4211251dD17CA276B',
  v2: '0xA3f6a5c32842FF045B5Eb628141210466E39ED83',
  market: '0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a',
  token: '0x03411DfEB2CBaC4EEA48CE9Aa57c8F4B12EB7C0a',
  amountWei: '100000000000000000',
  origin: 'https://graav-testnet-console.vercel.app',
  rpc: 'https://rpc.testnet.xrplevm.org',
  explorer: 'https://explorer.testnet.xrplevm.org',
  bindTtl: 600, orderTtl: 480, touchTtl: 604800, linkTtl: 604800,
  confirmations: 2,
} as const;

export const BIND_DOMAIN = { name: 'GRAAVBind', version: '1', chainId: 1449000, verifyingContract: '0x72be5a300956f9dF0F4264a4211251dD17CA276B' } as const;
export const BIND_TYPES = { GRAAVBind: [
  { name: 'xUserId', type: 'string' }, { name: 'wallet', type: 'address' },
  { name: 'chainId', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
  { name: 'expiresAt', type: 'uint64' },
] } as const;
export const REVOKE_TYPES = { GRAAVRevoke: [
  ...BIND_TYPES.GRAAVBind, { name: 'bindId', type: 'string' },
] } as const;
export const ORDER_DOMAIN = { name: 'GRAAVSession', version: '1', chainId: X1.chainId, verifyingContract: X1.factory } as const;
export const ORDER_TYPES = { GRAAVBuyIntent: [
  { name: 'sessionId', type: 'string' }, { name: 'orderId', type: 'string' },
  { name: 'wallet', type: 'address' }, { name: 'chainId', type: 'uint256' },
  { name: 'market', type: 'address' }, { name: 'token', type: 'address' },
  { name: 'destination', type: 'address' }, { name: 'amountWei', type: 'uint256' },
  { name: 'minOut', type: 'uint256' }, { name: 'calldataHash', type: 'bytes32' },
  { name: 'transactionNonce', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
  { name: 'expiresAt', type: 'uint64' },
] } as const;
export const EIP712_DOMAIN_FIELDS = [
  { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
] as const;
