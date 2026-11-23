'use strict';
const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const {chromium,devices}=require(playwrightPath);
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../frontend/dist');
const items=[
 {taskToken:'t-b3-safe-1',zone:'B3',wbSticker:'TEST-71101',itemName:'Тестовый товар Б3',mx:'ВЛАД3.01.02.03.04.05',box:'BOX-1',floor:'1',row:'2',place:'3',shelf:'4',cell:'5',statusSearch:'Поиск',employeeId:'',photoCount:0,hasPhoto:false,timeFilled:'09:42'},
 {taskToken:'t-b4-safe-2',zone:'B4',wbSticker:'TEST-71102',itemName:'Тестовый товар Б4',mx:'ВЛАД4.02.02.03.04.05',box:'BOX-2',floor:'2',row:'2',place:'3',shelf:'4',cell:'5',statusSearch:'Поиск',employeeId:'',photoCount:0,hasPhoto:false,timeFilled:'09:44'}
];
const mime={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json'};
const server=http.createServer((req,res)=>{
 const raw=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const filepath=path.resolve(root,'.'+raw);
 if(!filepath.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 let data;try{data=fs.readFileSync(filepath)}catch{res.writeHead(404);return res.end('not found')}
 res.writeHead(200,{'Content-Type':mime[path.extname(filepath).slice(1)]||'text/plain','Cache-Control':'no-store'});res.end(data);
});
function envelope(data){return {ok:true,data,error:null,requestId:'readonly-test',meta:{apiVersion:'v1',readOnly:true}}}
async function scenario(browser,port,mode){
 const mobile=mode==='mobile',classic=mode==='classic';
 const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:900},screen:{width:1920,height:1080}});
 const page=await context.newPage();
 page.setDefaultTimeout(25000);
 const errors=[];let posts=0;let gets=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/v71/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__V71_API_BASE_URL__ = 'https://script.google.com/macros/s/safe-test-api/exec';"}));
 await page.route('https://script.google.com/macros/s/safe-test-api/exec**',r=>{
  if(r.request().method()==='POST'){posts++;return r.fulfill({status:403,body:'no writes'})}
  gets++;
  const u=new URL(r.request().url());
  const action=u.searchParams.get('action');const data=action==='getCatalog'?{tasks:items,hasMore:false,filteredCount:2,totalActive:2,generatedAt:'2026-11-23T07:00:00Z'}:null;
  return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(envelope(data))});
 });
 const pageUrl='http://127.0.0.1:'+port+'/v71/'+(classic?'classic.html':'index.html');
 await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:35000});
 if(!classic){await page.locator('#employeeLogin').fill('TEST-READONLY');await page.locator('#loginForm button[type="submit"]').click();}
 await page.locator(classic?'#zonePills [data-zone="B3"]':mobile?'#mobileZoneTabs [data-zone="B3"]':'#zoneTabs [data-zone="B3"]').waitFor({timeout:35000});
 const zone=page.locator(classic?'#zonePills [data-zone="B3"]':mobile?'#mobileZoneTabs [data-zone="B3"]':'#zoneTabs [data-zone="B3"]');
 await zone.click();
 const cards=page.locator(mobile?'#mobileTaskList button': '#taskList button');
 await cards.first().waitFor({timeout:35000});
 const status=await page.evaluate(()=>window.githubV71BridgeStatus());
 assert.equal(status.catalogCount,2,'Catalog not mapped');
 assert.equal(status.readOnly,true);
 await cards.first().click();
 if(classic)await page.locator('#employeeInput').fill('TEST-READONLY');
 await page.locator(classic?'#missingBtn':mobile?'#mobileNotFoundBtn':'#notFoundBtn').click();
 await page.waitForTimeout(700);
 assert.equal(posts,0,'GitHub preview tried to mutate a real backend');
 assert.deepEqual(errors,[],'Browser JS errors');
 const result={mode,success:true,cards:await cards.count(),gets,posts,bridge:status,writeAttemptBlocked:true};
 await context.close();
 return result;
}
async function main(){await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{const result=[];for(const mode of ['classic','desktop','mobile']){const res=await scenario(browser,port,mode);result.push(res);console.log('PASS',mode,JSON.stringify(res).slice(0,400))}
 fs.writeFileSync(path.resolve(__dirname,'v71-mirror-browser-tests.json'),JSON.stringify(result,null,2)+'\n');
 }finally{await browser.close();server.close()}}
main().catch(e=>{console.error('FAILED',e.stack);server.close();process.exitCode=1});

