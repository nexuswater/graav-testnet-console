// Browser-safe validation. Do not import src/security.ts (which uses node:crypto) into React clients.
export function need(value:unknown,message:string):asserts value {if(!value) throw new Error(message);}
export function address(value:string){need(/^0x[0-9a-fA-F]{40}$/.test(value),'Invalid wallet address.');return value.toLowerCase();}
