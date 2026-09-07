// Browser-safe validation. Do not import src/security.ts (which uses node:crypto) into React clients.
export function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export function address(value: unknown): string { need(typeof value === 'string' && EVM_ADDRESS.test(value), 'Invalid wallet address.'); return value.toLowerCase(); }
export function safeAddress(value: unknown): string | null { try { return address(value); } catch { return null; } }
