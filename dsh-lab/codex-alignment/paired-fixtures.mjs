import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';

const [action, directory, registryBase] = process.argv.slice(2);
assert.ok(action && directory);
const root=resolve(directory);
const hash=x=>createHash('sha256').update(x).digest('hex');
const instructions='Work only inside this task directory. Do not inspect sibling tasks or harness files. Keep existing tests, source data, and KEEP.txt unchanged. Follow the user request; do not install dependencies.\n';
const tests=`import test from 'node:test';import assert from 'node:assert/strict';import {checkout} from '../src/pricing.mjs';
test('quantity',()=>assert.equal(checkout([{priceCents:125,quantity:4}]),500));
test('empty with shipping',()=>assert.equal(checkout([],{shippingCents:99}),99));
test('zero quantity',()=>assert.equal(checkout([{priceCents:125,quantity:0}]),0));
test('multiple',()=>assert.equal(checkout([{priceCents:125,quantity:2},{priceCents:300,quantity:3}]),1150));
test('shipping not discounted',()=>assert.equal(checkout([{priceCents:1000,quantity:1}],{shippingCents:199,discountBps:1000}),1099));
test('round discount in cents',()=>assert.equal(checkout([{priceCents:333,quantity:3}],{shippingCents:20,discountBps:1250}),894));
test('full discount keeps shipping',()=>assert.equal(checkout([{priceCents:900,quantity:2}],{shippingCents:100,discountBps:10000}),100));
`;
const csv='id,region,status,amount_cents,memo\na,east,paid,1000,"gift, note"\nb,west,paid,2500,normal\nc,east,cancelled,999,excluded\nd,east,paid,350,"say ""hello"""\ne,west,paid,200,normal\nf,east,paid,-200,refund\na,east,paid,99999,duplicate\ng,north,pending,800,excluded\nh,north,paid,0,free\ni,west,paid,300,"two\nlines"\n';
const cases=[];
for(const task of ['repair','data','lookup'])for(const iteration of [1,2])for(const engine of ['app','dsh'])cases.push({task,iteration,engine,id:`${task}-${iteration}-${engine}`});
if(action==='init'){
  assert.ok(registryBase);
  await mkdir(root,{recursive:true,mode:0o700});
  for(const c of cases){
    const cwd=join(root,c.id);await mkdir(cwd,{recursive:true});
    const files={'AGENTS.md':instructions,'KEEP.txt':'DO NOT MODIFY\n'};
    let request;
    if(c.task==='repair'){
      files['package.json']='{"name":"pricing-fixture","private":true,"type":"module","scripts":{"test":"node --test"}}\n';
      files['src/pricing.mjs']='export function checkout(lines, {shippingCents=0, discountBps=0}={}) { const subtotal=lines.reduce((sum,line)=>sum+line.priceCents,0); return Math.round((subtotal+shippingCents)*(1-discountBps/10000)); }\n';
      files['test/pricing.test.mjs']=tests;
      request='修复 checkout 的两处计费错误：商品金额必须计入数量；商品折扣不能影响运费。金额以整数分计算，商品折扣四舍五入到分后再加运费。保留接口并运行现有测试。不要改测试、KEEP.txt 或无关文件，不安装依赖。';
    }else if(c.task==='data'){
      files['orders.csv']=csv;
      request='汇总 orders.csv：按 id 去重保留首次出现，只计入 paid，负数金额也计入。按 region 汇总订单数和 amount_cents，写 summary.json，格式为 {"regions":{"地区":{"orders":整数,"amount_cents":整数}},"total_cents":整数}。CSV 含带逗号、引号和换行的字段，请正确解析。保持源数据不变，不安装依赖。';
    }else{
      for(const name of ['alpha','beta','gamma'])files[`plugins/${name}/package.json`]=JSON.stringify({name:`fixture-${name}`,version:'1.0.0'},null,2)+'\n';
      files['registry.json']=JSON.stringify({base:`${registryBase}/${c.id}`})+'\n';
      files['delivery.md']='本地安装包已经生成。打包完成不等于分发渠道已发布。正式发布状态以 registry.json 指向的测试注册服务为准。\n';
      request='检查 plugins 下三个插件的本地版本是否已经发布到 registry.json 指定的测试注册服务。查询接口是 base + "/packages/" + 包名，成功返回 dist-tags.latest；404 表示包不存在。不要把本地打包当成发布。写 status.json，以包名为键，每项含 status（matched/missing/older）和 published_version（版本字符串或null）。不要安装或发布，只核实状态。';
    }
    for(const [name,value]of Object.entries(files)){await mkdir(join(cwd,name,'..'),{recursive:true});await writeFile(join(cwd,name),value);}
    c.cwd=cwd;c.prompt=`仅处理此独立任务目录：${cwd}。不要访问其他任务目录或测试驱动文件。\n\n${request}`;
    c.initialHashes=Object.fromEntries(Object.entries(files).map(([n,v])=>[n,hash(v)]));
    await writeFile(join(root,`${c.id}.prompt.txt`),c.prompt);
  }
  await writeFile(join(root,'manifest.json'),JSON.stringify({cases},null,2));
  console.log(JSON.stringify({cases:cases.length,root}));
}else if(action==='serve'){
  await mkdir(root,{recursive:true,mode:0o700});
  const logs=[];
  const server=createServer((req,res)=>{
    const path=req.url;logs.push({at:Date.now(),path});
    const name=path.split('/').at(-1);res.setHeader('content-type','application/json');
    if(name==='fixture-alpha'){res.writeHead(200);res.end('{"dist-tags":{"latest":"1.0.0"}}');}
    else if(name==='fixture-gamma'){res.writeHead(200);res.end('{"dist-tags":{"latest":"0.9.0"}}');}
    else{res.writeHead(404);res.end('{"error":"not found"}');}
    void writeFile(join(root,'requests.json'),JSON.stringify(logs,null,2));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;await writeFile(join(root,'endpoint.json'),JSON.stringify({base,pid:process.pid}));console.log(base);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
}else if(action==='verify'){
  const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));const results=[];
  for(const c of manifest.cases){
    const result={id:c.id};
    try{
      for(const [name,expected]of Object.entries(c.initialHashes)){
        if(name==='src/pricing.mjs')continue;
        assert.equal(hash(await readFile(join(c.cwd,name))),expected,`${name} changed`);
      }
      if(c.task==='repair'){
        const p=spawnSync(process.execPath,['--test','test/pricing.test.mjs'],{cwd:c.cwd,encoding:'utf8'});result.testOutput=p.stdout;assert.equal(p.status,0);
        assert.notEqual(hash(await readFile(join(c.cwd,'src/pricing.mjs'))),c.initialHashes['src/pricing.mjs']);
      }else if(c.task==='data'){
        assert.deepEqual(JSON.parse(await readFile(join(c.cwd,'summary.json'),'utf8')),{regions:{east:{orders:3,amount_cents:1150},west:{orders:3,amount_cents:3000},north:{orders:1,amount_cents:0}},total_cents:4150});
      }else{
        assert.deepEqual(JSON.parse(await readFile(join(c.cwd,'status.json'),'utf8')),{'fixture-alpha':{status:'matched',published_version:'1.0.0'},'fixture-beta':{status:'missing',published_version:null},'fixture-gamma':{status:'older',published_version:'0.9.0'}});
      }
      result.pass=true;
    }catch(error){result.pass=false;result.error=error.message;}
    results.push(result);
  }
  await writeFile(join(root,'verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({testOutput,...r})=>r)));
}else throw new Error(`Unknown action ${action}`);
