'use client';
import {YouPanel} from './YouPanel';
import {useConsoleBridge} from './console-bridge';
export function ConsoleYou(){return <YouPanel {...useConsoleBridge()}/>;}
