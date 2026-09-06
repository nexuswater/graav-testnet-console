'use client';
import {BuyPanel} from './BuyPanel';
import {useConsoleBridge} from './console-bridge';
export function ConsoleBuy(props:{sessionId:string;via?:string}){return <BuyPanel {...props} {...useConsoleBridge()}/>;}
