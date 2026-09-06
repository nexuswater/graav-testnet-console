import { BindService } from './binds';
import { SessionService } from './sessions';
import { need, visitorCookie, X1Error } from './security';
import type { Context, Identity } from './types';

export type HttpDependencies = {
  binds: BindService; sessions: SessionService; origin: string; visitorSecret: string; now(): number;
  readXSession(req: Request): Promise<Identity|null>;
  /** Validate a scoped service credential and resolve its pre-bound operator server-side. Never parse X identity from chat/body. */
  readBotOperator(req: Request): Promise<Identity|null>;
  rateLimit(req: Request, key: string, operation: string): Promise<boolean>;
  reportInternalError(error: unknown): void;
};
const COOKIE = '__Host-graav_x1_visitor';
export function createHttpHandler(d: HttpDependencies) {
  const origin = new URL(d.origin).origin;
  const local = new URL(origin).hostname==='localhost' || new URL(origin).hostname==='127.0.0.1';
  need(origin.startsWith('https:') || local,'HTTPS_ORIGIN_REQUIRED',503);
  const cookieName = local ? 'graav_x1_local_visitor' : COOKIE;
  return async (req: Request): Promise<Response> => {
    let setCookie: string | undefined;
    const response = (body: unknown,status=200) => {
      const headers: Record<string,string> = {'content-type':'application/json','cache-control':'no-store','vary':'Cookie','x-content-type-options':'nosniff'};
      if(setCookie) headers['set-cookie']=setCookie;
      return new Response(JSON.stringify(body),{status,headers});
    };
    try {
      const url = new URL(req.url), path = url.pathname.replace(/\/$/,'');
      const isBot = path==='/api/bot/s';
      need(req.method==='GET' || req.method==='POST','METHOD_NOT_ALLOWED',405);
      if(req.method==='POST' && !isBot) need(req.headers.get('origin')===origin,'ORIGIN_REJECTED',403);
      if(req.method==='POST') need(req.headers.get('content-type')?.split(';')[0].trim()==='application/json','JSON_REQUIRED',415);
      const existing = req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
      const visitor = visitorCookie(d.visitorSecret,d.now(),existing);
      if(visitor.token!==existing) setCookie=`${cookieName}=${visitor.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${local?'':'; Secure'}`;
      const x = isBot ? await d.readBotOperator(req) : await d.readXSession(req);
      if(isBot) need(x,'BOT_AUTH_REQUIRED',401);
      const ctx: Context = {visitorId:visitor.visitorId,x};
      need(await d.rateLimit(req,x ? `x:${x.xUserId}` : `visitor:${ctx.visitorId}`,path),'RATE_LIMITED',429);
      let body: Record<string,unknown> = {};
      if(req.method==='POST') {
        const raw = await req.text(); need(Buffer.byteLength(raw,'utf8')<=8192,'BODY_TOO_LARGE',413);
        try { const parsed = JSON.parse(raw); need(parsed && typeof parsed==='object' && !Array.isArray(parsed),'BAD_JSON'); body=parsed; }
        catch(e) { if(e instanceof X1Error) throw e; throw new X1Error('BAD_JSON'); }
      }
      if(req.method==='GET' && path==='/api/bind/status') return response(await d.binds.status(ctx));
      if(req.method==='POST' && path==='/api/bind/challenge') return response(await d.binds.challenge(ctx,body.wallet));
      if(req.method==='POST' && path==='/api/bind/revoke/challenge') return response(await d.binds.challenge(ctx,body.wallet,'REVOKE'));
      if(req.method==='POST' && path==='/api/bind/confirm') return response(await d.binds.confirm(ctx,{nonce:body.nonce,wallet:body.wallet,signature:body.signature}));
      if(req.method==='POST' && (path==='/api/s' || path==='/api/bot/s')) return response(await d.sessions.mint(ctx,{action:body.action,market:body.market,amountWei:body.amountWei,share:body.share}),201);
      if(req.method==='GET' && path==='/api/rewards') return response(await d.sessions.rewards(ctx));
      const session = /^\/api\/s\/([A-Za-z0-9_-]+)(?:\/(touch|prepare))?$/.exec(path);
      if(session) {
        if(req.method==='GET' && !session[2]) return response(await d.sessions.getSession(session[1]));
        if(req.method==='POST' && session[2]==='touch') return response(await d.sessions.touch(ctx,session[1],{via:body.via,idempotencyKey:body.idempotencyKey}));
        if(req.method==='POST' && session[2]==='prepare') return response(await d.sessions.prepare(ctx,session[1],{wallet:body.wallet,idempotencyKey:body.idempotencyKey}));
      }
      const order = /^\/api\/orders\/([0-9a-f-]+)(?:\/(authorize|submitted|confirm))?$/.exec(path);
      if(order) {
        if(req.method==='GET' && !order[2]) return response(await d.sessions.getOrder(ctx,order[1]));
        if(req.method==='POST' && order[2]==='authorize') return response(await d.sessions.authorize(ctx,order[1],body.signature));
        if(req.method==='POST' && order[2]==='submitted') return response(await d.sessions.submitted(ctx,order[1],body.txHash));
        if(req.method==='POST' && order[2]==='confirm') return response(await d.sessions.confirm(ctx,order[1]));
      }
      return response({error:'NOT_FOUND'},404);
    } catch(e) {
      if(e instanceof X1Error) return response({error:e.code},e.status);
      if((e as {code?:string})?.code==='23505') return response({error:'CONCURRENT_CONFLICT'},409);
      d.reportInternalError(e); // Adapter must redact session secrets, OAuth tokens and signatures.
      return response({error:'SERVICE_UNAVAILABLE'},503);
    }
  };
}
