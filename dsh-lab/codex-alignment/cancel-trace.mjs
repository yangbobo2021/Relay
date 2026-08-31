import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { CodexAppServerClient } from '../../integrations/codex/app-server-client.mjs';
import { CodexSessionRuntime } from '../../integrations/codex/session-runtime.mjs';

// Real model, native protocol, and PID evidence. Never replay historic tool calls.
const [out, command, repetitions='6'] = process.argv.slice(2);
assert.ok(out && command);
const root=resolve(out); await mkdir(root,{recursive:true,mode:0o700});
const client=new CodexAppServerClient({command});
const runtime=new CodexSessionRuntime({client,cwd:root});
const report={reference:'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e',kind:'instrumented plugin runtime, not Desktop UI',cases:[]};
let current=null;
const request=client.request.bind(client);
client.request=async(method,params,...rest)=>{
  const tracked=/^(turn\/(start|interrupt)|thread\/backgroundTerminals\/)/.test(method);
  const event=tracked&&current?{at:Date.now(),method,threadId:params?.threadId,processId:params?.processId}:null;
  if(event)current.events.push(event);
  try{const result=await request(method,params,...rest);if(event){event.completedAt=Date.now();event.result=method==='turn/start'?{turnId:result.turn.id}:result;}return result;}
  catch(error){if(event)event.error=error.message;throw error;}
};
client.on('notification',({method,params={}})=>{
  if(!current)return;
  if(['item/started','item/completed','turn/started','turn/completed','rawResponseItem/completed'].includes(method)){
    const item=params.item;
    current.events.push({at:Date.now(),notification:method,threadId:params.threadId,turnId:params.turnId??params.turn?.id,
      type:item?.type,itemId:item?.id,processId:item?.processId,callId:item?.call_id,tool:item?.name,status:item?.status??params.turn?.status});
  }
});
client.on('serverRequest',r=>client.respondError(r.id,-32601,'Unexpected request in full-access cancellation fixture'));
try{
  await runtime.initialize();
  for(let index=0;index<Number(repetitions);index++){
    const cwd=join(root,`case-${index+1}`);await mkdir(cwd,{recursive:true});
    await writeFile(join(cwd,'long.mjs'),"import {writeFileSync} from 'node:fs';writeFileSync('running.json',JSON.stringify({pid:process.pid,ppid:process.ppid,at:Date.now()}));console.log('STARTED');await new Promise(r=>setTimeout(r,45000));console.log('FINISHED');\n");
    current={index:index+1,delayMs:[0,100,1000][index%3],events:[]};report.cases.push(current);
    let pid;
    try{
      const session=await runtime.createSession({cwd,model:'gpt-5.6-sol',effort:'high',sandbox:'danger-full-access',approvalPolicy:'never'});
      current.threadId=session.id;
      const turn=await runtime.sendMessage(session.id,{text:'运行 node long.mjs，等待结束后报告结果。不要修改文件，不要另起后台任务。'});current.turnId=turn.id;
      await until(async()=>{try{pid=JSON.parse(await readFile(join(cwd,'running.json'),'utf8')).pid;return true;}catch{return false;}},90000);
      current.pid=pid;current.processBefore=ps(pid);current.detectedAt=Date.now();
      await new Promise(r=>setTimeout(r,current.delayMs));
      current.cancelAt=Date.now();current.itemsBefore=runtime.getSession(session.id).turns.find(t=>t.id===turn.id)?.items.map(i=>({type:i.type,id:i.id,processId:i.processId,status:i.status}));
      await runtime.interruptTurn(session.id,turn.id);
      current.cancelReturnedAt=Date.now();
      current.backgroundAfter=await runtime.listBackgroundTerminals(session.id);
      await until(async()=>!alive(pid),5000);
      current.stoppedAt=Date.now();current.pass=true;
    }catch(error){current.pass=false;current.error=error.message;current.processAfter=pid?ps(pid):null;}
    finally{
      // Cleanup only the exact fixture child whose PID file and command we own.
      if(pid&&alive(pid)&&ps(pid).includes('node long.mjs')){process.kill(pid,'SIGTERM');current.fixtureCleanup=true;}
      await writeFile(join(root,'results.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify({index:current.index,delayMs:current.delayMs,pass:current.pass,error:current.error,items:current.itemsBefore?.length,
        lists:current.events.filter(e=>e.method==='thread/backgroundTerminals/list').map(e=>e.result?.data?.map(p=>({id:p.processId,osPid:p.osPid}))),
        termination:current.events.filter(e=>e.method==='thread/backgroundTerminals/terminate').map(e=>e.result)}));
    }
  }
}finally{await runtime.close();}
if(report.cases.some(c=>!c.pass))process.exitCode=1;
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
function ps(pid){return spawnSync('/bin/ps',['-p',String(pid),'-o','pid=,ppid=,pgid=,stat=,command='],{encoding:'utf8'}).stdout.trim();}
async function until(fn,timeout){const deadline=Date.now()+timeout;while(!await fn()){if(Date.now()>deadline)throw new Error(`Timed out after ${timeout}ms`);await new Promise(r=>setTimeout(r,20));}}
