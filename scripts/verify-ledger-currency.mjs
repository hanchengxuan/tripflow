import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const dir=process.env.LEDGER_QA_OUTPUT ?? '.expo/ledger-currency-qa'; await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const sender='c2222222-2222-4222-8222-222222222222', recipient='c1111111-1111-4111-8111-111111111111', trip='c4444444-4444-4444-8444-444444444444';
const expense=(id,currency,total,payer,share)=>({id,trip_id:trip,created_by:payer,title:'Synthetic '+currency,currency,total_minor:total,base_currency:'CNY',base_amount_minor:9200,exchange_rate:0.92,occurred_at:'2026-10-16T00:00:00Z',source:'manual',expense_payers:[{user_id:payer,amount_minor:total,base_amount_minor:9200}],expense_allocation_groups:[{expense_shares:[{user_id:share,amount_minor:total,base_amount_minor:9200}]}],expense_receipts:[]});
for(const [width,height] of [[390,844],[1280,800]]) for(const colorScheme of ['light','dark']) {
 const context=await browser.newContext({viewport:{width,height},colorScheme}); const page=await context.newPage();
 let settlements=[];const writes=[],errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>failed.push(r.url()));
 await page.addInitScript(({sender})=>{
  const exp=Math.floor(Date.now()/1000)+3600;
  const user={id:sender,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const token=[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:sender,role:'authenticated',exp})), 'synthetic-signature'].join('.');
  localStorage.setItem('sb-ledger-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
  localStorage.setItem('tripflow.locale','en');
 },{sender});
 await page.route('https://ledger-fixture.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data=[];
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  if(url.pathname==='/auth/v1/settings')data={external:{google:false},phone_enabled:false};
  else if(url.pathname==='/auth/v1/user')data={id:sender};
  else if(url.pathname.endsWith('/profiles')){
   const profiles=[{id:sender,display_name:'Synthetic sender',onboarding_completed:true},{id:recipient,display_name:'Synthetic recipient',onboarding_completed:true}];
   data=url.searchParams.get('id')?.startsWith('eq.')?profiles[0]:profiles;
  }else if(url.pathname.endsWith('/trips'))data=[{id:trip,created_by:recipient,name:'Synthetic ledger QA',starts_on:'2026-10-01',ends_on:'2026-12-01',home_currency:'AUD',default_time_zone:'Australia/Sydney'}];
  else if(url.pathname.endsWith('/trip_members'))data=[{trip_id:trip,user_id:sender,role:'editor'},{trip_id:trip,user_id:recipient,role:'owner'}];
  else if(url.pathname.endsWith('/expenses'))data=[expense('e1','JPY',1000,recipient,sender),expense('e2','HKD',2000,sender,recipient)];
  else if(url.pathname.endsWith('/settlements'))data=settlements;
  else if(url.pathname.endsWith('/rpc/record_settlement')){
   const body=req.postDataJSON();writes.push(body);
   assert.equal(body.settlement_currency,'JPY');assert.equal(body.settlement_amount_minor,1000);
   assert.equal(Object.hasOwn(body,'settlement_base_currency'),false);
   settlements=[{id:'sent',trip_id:trip,from_user_id:sender,to_user_id:recipient,currency:'JPY',amount_minor:1000,settled_at:'2026-10-16T00:00:00Z',recorded_by:sender}];data='sent';
  }else if(url.pathname.endsWith('/rpc/unrecord_settlement')){settlements=[];data=null;}
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.goto(`${process.env.LEDGER_QA_URL ?? 'http://localhost:4209'}/ledger`);
 await page.getByRole('button',{name:'Mark sent',exact:true}).waitFor({timeout:60000});
 let text=await page.locator('body').innerText();assert.match(text,/JPY/);assert.match(text,/HKD/);assert.match(text,/1,000/);assert.match(text,/20\.00/);
 await page.screenshot({path:`${dir}/${width}-${colorScheme}-before.png`,fullPage:true});
 await writeFile(`${dir}/${width}-${colorScheme}-accessibility.txt`,await page.locator('body').ariaSnapshot());
 await page.getByRole('button',{name:'Mark sent',exact:true}).click();
 await page.getByText('Nothing to send',{exact:true}).waitFor();assert.equal(writes.length,1);
 await page.screenshot({path:`${dir}/${width}-${colorScheme}-sent.png`,fullPage:true});
 await page.getByText('Completed',{exact:true}).click();
 await page.getByRole('button',{name:'Mark unsent',exact:true}).click();
 await page.getByRole('button',{name:'Mark sent',exact:true}).waitFor();
 assert.equal(settlements.length,0);
 settlements=[{id:'prior-converted',trip_id:trip,from_user_id:sender,to_user_id:recipient,currency:'HKD',amount_minor:5000,base_currency:'HKD',base_amount_minor:5000,exchange_rate:1,settled_at:'2026-10-16T00:00:00Z',recorded_by:sender}];
 await page.reload();
 await page.getByText('Earlier payments used converted amounts. Complete the current home-currency rates in Activity before settling again.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Mark sent',exact:true}).count(),0);
 assert.equal(await page.getByText('All settled',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 console.log(JSON.stringify({width,colorScheme,markSent:'passed',undo:'passed',convertedPaymentGuard:'passed',currencyTotals:'JPY 1000 out / HKD 20 in',consoleErrors:errors.length,failedRequests:failed.length}));
 await context.close();
}
await browser.close();
