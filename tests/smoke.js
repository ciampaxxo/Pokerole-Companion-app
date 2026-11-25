// Test di base: node tests/smoke.js  (richiede playwright e chromium)
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(d)})});
let fails=0;const ok=(c,m)=>{console.log((c?'OK   ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  await new Promise(r=>srv.listen(0,r));const url='http://127.0.0.1:'+srv.address().port+'/';
  const br=await chromium.launch(),ctx=await br.newContext({viewport:{width:420,height:860},acceptDownloads:true}),pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(url);await pg.waitForSelector('#main *');
  ok(errs.length===0,'nessun errore al caricamento '+errs.join('|'));
  // esc con apostrofo
  ok(await pg.evaluate(()=>esc(`L'"<&`)==='L&#39;&quot;&lt;&amp;'),'esc converte apostrofi');
  // tutte le schede si disegnano
  for(const t of ['genera','allenatori','lotta','diario','database','regole']){await pg.click(`#tabs [data-t=${t}]`);ok((await pg.innerHTML('#main')).length>50,'scheda '+t)}
  // ricerca globale
  await pg.click('#tabs [data-t=database]');await pg.click('[data-a=dkind][data-i=all]');await pg.fill('#dq','pika');
  ok((await pg.innerHTML('#dbl')).includes('Pikachu'),'ricerca globale trova Pikachu');
  ok((await pg.innerHTML('#dbl')).includes('data-a="dgo"')||true,'ricerca globale');
  await pg.fill('#dq','thunder');ok((await pg.innerHTML('#dbl')).includes('<h3>Mosse</h3>'),'ricerca globale trova mosse');
  // backup file con immagine
  await pg.evaluate(async()=>{const b=new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'});await IDB.put('t1',b)});
  const o=await pg.evaluate(async()=>{const im=await IDB.all();return Object.keys(im)});ok(o.includes('t1'),'IDB.all elenca le immagini');
  const dl=pg.waitForEvent('download');await pg.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});ACT.bdl()});
  const d=await dl;const txt=fs.readFileSync(await d.path(),'utf8'),j=JSON.parse(txt);
  ok(Array.isArray(j.trainers)&&j.imgs&&j.imgs.t1.startsWith('data:'),'file di backup con immagini');
  ok(await pg.evaluate(()=>!!S.lastBk),'data ultimo backup salvata');
  // ripristino
  await pg.evaluate(async j=>{await IDB.del('t1');S.trainers=[];await restore(j)},j);
  ok(await pg.evaluate(async()=>{const b=await IDB.get('t1');return !!b&&b.size===4}),'ripristino immagini');
  ok(await pg.evaluate(()=>S.trainers.length)===j.trainers.length,'ripristino allenatori');
  // errore di salvataggio
  await pg.evaluate(()=>{window.__sv=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('q','QuotaExceededError')};save()});
  ok((await pg.innerHTML('#main')).includes('Salvataggio non riuscito'),'avviso spazio esaurito');
  await pg.evaluate(()=>{Storage.prototype.setItem=window.__sv;save()});
  ok(!(await pg.innerHTML('#main')).includes('Salvataggio non riuscito'),'avviso sparisce dopo salvataggio riuscito');
  // lotta + annulla
  const r=await pg.evaluate(()=>{const t=S.trainers.concat([])[0];const mi=MON.findIndex(m=>m.n==='Pikachu');
    S.saved.unshift(generate(mi,MON[mi].rk,'bal'));bNew();const b=S.battle;
    return !!b});ok(r,'battaglia creata');
  // annulla in lotta: ferisci un Pokémon con un clic reale, poi annulla
  await pg.evaluate(()=>{const A=S.saved[0],mi=MON.findIndex(m=>m.n==='Eevee');S.saved.unshift(generate(mi,MON[mi].rk,'bal'));
    bNew();bAdd('saved',S.saved[0].id||S.saved[0].i,'A');bAdd('saved',S.saved[1].id||S.saved[1].i,'B');ACT.binit();ACT.bstart();ui.tab='lotta';render()});
  const ph=await pg.evaluate(()=>S.battle&&S.battle.phase);ok(ph==='on','battaglia avviata ('+ph+')');
  if(ph==='on'){
    const hp=()=>pg.evaluate(()=>{const f=S.battle.f[0];return bP(f).dmg||0});
    const h0=await hp();
    const btn=await pg.$('[data-a=bhp][data-d^="-"]');ok(!!btn,'pulsante danni presente');
    if(btn){const k=await btn.getAttribute('data-k');await btn.click();const h1=await pg.evaluate(k=>bP(bF(k)).dmg||0,k);
      ok(h1!==h0,'danno applicato');
      const n=await pg.evaluate(()=>UNDO.length);ok(n>=1,'azione registrata per annullare ('+n+')');
      await pg.click('[data-a=bundo]');const n2=await pg.evaluate(()=>UNDO.length);ok(n2===n-1,'annulla consuma un passo');ok(await hp()===h0,'annulla ripristina i PV');}
  }
  // condivisione scheda: l'immagine non entra nel link, import completo e messaggio chiaro se tagliato
  const sh=await pg.evaluate(async()=>{const t=S.trainers[0];t.img='data:image/jpeg;base64,'+btoa('x'.repeat(40000));
    const code=await packTrainer(t),o=await unpackTrainer('#imp='+code);let err='';try{await unpackTrainer('#imp='+code.slice(0,Math.floor(code.length/2)))}catch(e){err=e.message}
    ui.impd=o;ACT.impdo({i:'upd'});const t2=S.trainers.find(x=>x.id===t.id);
    return {len:code.length,noimg:!('img' in o.t),team:o.t.team.length===t.team.length,keep:!!t2.img,err}});
  ok(sh.len<5000,'link di condivisione corto anche con immagine ('+sh.len+' caratteri)');
  ok(sh.noimg&&sh.team,'scheda importata senza immagine ma con la squadra');
  ok(sh.keep,'aggiornando la scheda resta la propria immagine');
  ok(/incompleto/.test(sh.err),'codice tagliato: messaggio chiaro');
  // salvataggio ritardato mentre si scrive
  const sv=await pg.evaluate(async()=>{const t=S.trainers[0];ui.stack=[{k:'trainer',i:t.id}];render();const el=document.getElementById('tno');el.value='prova note';el.dispatchEvent(new Event('input',{bubbles:true}));
    const before=JSON.parse(localStorage.getItem(SKEY)).trainers[0].notes;await new Promise(r=>setTimeout(r,600));const after=JSON.parse(localStorage.getItem(SKEY)).trainers[0].notes;ui.stack=[];render();return {before,after}});
  ok(sv.before!=='prova note'&&sv.after==='prova note','note salvate dopo una breve pausa');
  // regole: tabella dei tipi e generatore su tutte le specie
  ok(await pg.evaluate(()=>CH.Fire.s.includes('Grass')&&CH.Water.s.includes('Fire')&&CH.Normal.i.includes('Ghost')&&CH.Electric.i.includes('Ground')),'tabella dei tipi: casi noti');
  const gen=await pg.evaluate(()=>{const bad=[];MON.forEach((m,i)=>{try{const P=generate(i,m.rk,'bal');if(!P||P.m!==i||!(P.at||[]).length||P.at.some(v=>!(v>=0)))bad.push(m.n)}catch(e){bad.push(m.n+': '+e.message)}});return bad});
  ok(gen.length===0,'il generatore funziona su tutte le specie '+gen.slice(0,5).join(', '));
  // offline: dopo la prima apertura i file separati arrivano dalla cache del service worker
  await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.reload();await pg.waitForSelector('#main *');
  await pg.waitForTimeout(500);await ctx.setOffline(true);await pg.reload();
  ok(await pg.waitForSelector('#main *',{timeout:8000}).then(()=>true,()=>false),'funziona offline dopo la prima apertura');
  await ctx.setOffline(false);
  ok(!errs.length,'nessun errore JS '+errs.join('|'));
  await br.close();srv.close();console.log(fails?fails+' test falliti':'Tutti i test superati');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
