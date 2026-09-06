import { BindService } from './core/binds';
import { SessionService } from './core/sessions';
import { createHttpHandler, type HttpDependencies } from './core/http';
import type { Database, Gateway } from './core/types';

export type ConsolePorts = Omit<HttpDependencies,'binds'|'sessions'> & { database:Database; gateway:Gateway };
export function assembleX1(ports:ConsolePorts){
  const binds=new BindService(ports.database,ports.now);
  const sessions=new SessionService(ports.database,ports.gateway,ports.now,ports.origin);
  return {binds,sessions,handler:createHttpHandler({...ports,binds,sessions})};
}
