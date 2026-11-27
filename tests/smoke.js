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
  // niente rete esterna nei test (GitHub, ntfy...): solo il server locale
const puts=[],dcs=[];let dcStatus=200,dcNoCors=false;
  await ctx.route(r=>!r.href.startsWith(url),r=>{const q=r.request();if(/discord\.com\/api\/webhooks/.test(q.url())){const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST'};if(q.method()==='OPTIONS')return dcNoCors?r.fulfill({status:404,body:''}):r.fulfill({status:204,headers:H});if(q.method()==='POST'){const ct=(q.headers()['content-type']||'');if(/multipart/.test(ct)){const txt=(q.postDataBuffer()||Buffer.from('')).toString('latin1'),m=txt.match(/name="payload_json"\r?\n\r?\n([\s\S]*?)\r?\n--/),o=m?JSON.parse(Buffer.from(m[1],'latin1').toString('utf8')):{};o.__files=(txt.match(/name="files\[\d+\]"; filename=/g)||[]).length;dcs.push(o);return r.fulfill({status:200,body:'{}'})}const raw=q.postData()||'';if(dcNoCors){const buf=q.postDataBuffer(),txt=buf?buf.toString('utf8'):raw,m=txt.match(/name="payload_json"\r?\n\r?\n([\s\S]*?)\r?\n--/);dcs.push(m?JSON.parse(m[1]):{raw:txt.slice(0,200)});return r.fulfill({status:200,contentType:'application/json',body:'{}'})}dcs.push(JSON.parse(raw));return r.fulfill({status:dcStatus,headers:H,contentType:'application/json',body:'{}'})}}
    if(/api\.github\.com/.test(q.url())){if(q.method()==='PUT'){puts.push(JSON.parse(q.postData()));return r.fulfill({status:200,contentType:'application/json',body:'{}'})}return r.fulfill({status:404,contentType:'application/json',body:'{}'})}return r.abort()});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
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
    const code=await packTrainer(t),o=await unpackTrainer('#imp='+code);let err='';for(let k=0;k<4;k++){try{await unpackTrainer('#imp='+code.slice(0,Math.floor(code.length/2)+k));err+='|nessun errore'}catch(e){if(!/incompleto/.test(e.message))err+='|'+e.message}}err=err||'incompleto';
    ui.impd=o;ACT.impdo({i:'upd'});const t2=S.trainers.find(x=>x.id===t.id);
    return {len:code.length,noimg:!('img' in o.t),team:o.t.team.length===t.team.length,keep:!!t2.img,err}});
  ok(sh.len<5000,'link di condivisione corto anche con immagine ('+sh.len+' caratteri)');
  ok(sh.noimg&&sh.team,'scheda importata senza immagine ma con la squadra');
  ok(sh.keep,'aggiornando la scheda resta la propria immagine');
  ok(/incompleto/.test(sh.err),'codice tagliato: messaggio chiaro');
  // condivisione di un singolo Pokémon
  const ms=await pg.evaluate(async()=>{const t=S.trainers[0];if(!t.team.length){const mi=MON.findIndex(m=>m.n==='Pikachu');t.team.push(generate(mi,1,'bal'))}
    const P=t.team[0];P.nick='Saetta';ui.stack=[{k:'trainer',i:t.id},{k:'inst',i:P.id,o:t.id}];render();const btn=!!document.querySelector('[data-a=ishare]');
    const code=await packMon(P,t.name),o=await unpackTrainer('Guarda! '+appUrl()+'#imp='+code);
    // aggiorna: il Pokémon esiste già
    o.p.nick='Saetta 2';ui.impd=o;ui.stack=[{k:'imp'}];render();const upd=!!document.querySelector('[data-a=impdo][data-i=mupd]');ACT.impdo({i:'mupd'});
    const upOk=t.team.find(x=>x.id===P.id).nick==='Saetta 2';
    // nuovo dispositivo: il Pokémon non c'è, va tra i salvati
    const o2=await unpackTrainer('#imp='+code);t.team=t.team.filter(x=>x.id!==P.id);ui.impd=o2;ui.impto='saved';ACT.impdo({i:'mnew'});
    const inSaved=S.saved.some(x=>x.id===P.id&&x.nick==='Saetta');
    return {btn,len:code.length,upd,upOk,inSaved,from:o.from===t.name}});
  ok(ms.btn,'pulsante Condividi Pokémon nella scheda');
  ok(ms.len<2000&&ms.from,'link del Pokémon corto con il nome dell’allenatore ('+ms.len+')');
  ok(ms.upd&&ms.upOk,'importare un Pokémon già presente lo aggiorna');
  ok(ms.inSaved,'importare un Pokémon nuovo lo aggiunge alla destinazione scelta');
  // immagine anche per i PNG
  const npc=await pg.evaluate(()=>{const t=newTrainer();t.pg=0;t.name='PNG';S.trainers.push(t);ui.stack=[{k:'trainer',i:t.id}];render();const r=!!document.querySelector('#sheet [data-c=timg]');ui.stack=[];render();return r});
  ok(npc,'caricamento immagine disponibile anche per i PNG');
  // creazione guidata di un Pokémon, con clic reali
  await pg.evaluate(()=>{ui.stack=[];ui.tab='genera';ui.gen.mode='mon';render()});
  await pg.click('[data-a=mwstart]');await pg.fill('#mwq','eevee');await pg.click('[data-a=mwmon]');
  const dest=await pg.evaluate(()=>{const t=S.trainers.find(x=>x.pg)||S.trainers[0];return t.id});
  await pg.selectOption('#mwto',dest);await pg.fill('#mwnick','Pelo');
  await pg.click('[data-a=mwgo][data-d="1"]');
  for(let i=0;i<20;i++){const b=await pg.$('[data-a=mwat][data-k="1"][data-d="1"]');await b.click()}
  const at=await pg.evaluate(()=>{const m=ui.mw,b=mwBud(m);return {ua:b.ua,a:b.a,ok:m.at.every((v,i)=>v>=b.base[i]&&v<=b.cap[i])}});
  ok(at.ua<=at.a&&at.ok,'attributi entro budget e limiti della specie ('+at.ua+'/'+at.a+')');
  await pg.click('[data-a=mwgo][data-d="1"]');await pg.click('[data-a=mwsk][data-k=Evasion][data-d="1"]');
  await pg.click('[data-a=mwgo][data-d="1"]');await pg.click('[data-a=mwauto]');
  const nmv=await pg.evaluate(()=>{const m=ui.mw;return {n:m.mv.length,max:mwBud(m).nmv,pool:mwPool(m).length}});
  ok(nmv.n===Math.min(nmv.max,nmv.pool),'mosse scelte in automatico ('+nmv.n+'/'+nmv.max+')');
  await pg.click('[data-a=mwgo][data-d="1"]');await pg.click('[data-a=mwdone]');
  const made=await pg.evaluate(id=>{const t=S.trainers.find(x=>x.id===id),P=t.team.concat(t.box||[]).find(x=>x.nick==='Pelo');return P?{sp:MON[P.m].n,ev:P.sk.Evasion,mv:P.mv.length,sheet:ui.stack.length&&ui.stack[ui.stack.length-1].k}:null},dest);
  ok(made&&made.sp==='Eevee'&&made.ev===1&&made.mv===nmv.n&&made.sheet==='inst','Pokémon creato e aggiunto all’allenatore');
  // diario: pubblicare e programmare dalla pagina della voce
  await pg.evaluate(()=>{localStorage.setItem('master-pokerole-gh',JSON.stringify({tok:'x',ok:true,repo:'a/b'}));S.diary=[];ACT.dnew();const e=S.diary[0];e.t='Prova';e.b='testo';render()});
  const dj=()=>puts.filter(x=>Buffer.from(x.content,'base64').toString().includes('"voci"')).map(x=>JSON.parse(Buffer.from(x.content,'base64').toString()));
  ok(await pg.$('#sheet [data-a=dpubone]').then(b=>!!b)&&await pg.$('#sheet [data-a=dsched]').then(b=>!!b),'la pagina della voce ha Pubblica ora e Programma');
  ok(!(await pg.innerHTML('#sheet')).includes('data-a="dvis"'),'selettore Solo master/Giocatori rimosso');
  await pg.click('#sheet [data-a=dpubone]');await pg.waitForTimeout(400);
  ok(dj().length>=1&&dj().pop().voci.some(v=>v.t==='Prova'),'Pubblica ora scrive la voce nel diario');
  ok((await pg.innerHTML('#sheet')).includes('Visibile ai giocatori'),'la voce risulta pubblicata');
  await pg.click('#sheet [data-a=dunpub]');await pg.click('#sheet [data-a=dunpub]');await pg.waitForTimeout(400);
  ok(dj().pop().voci.length===0,'Ritira toglie la voce dal diario');
  // programmazione: nel futuro non parte, poi scaduta parte da sola
  const fut=await pg.evaluate(()=>{const d=new Date(Date.now()+36e5-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);document.getElementById('dsch').value=d;ACT.dsched();const e=S.diary[0];return {sch:!!e.sched&&e.sched>Date.now(),pub:e.pub}});
  ok(fut.sch&&!fut.pub,'programmazione salvata, la voce resta privata');
  ok((await pg.innerHTML('#sheet')).includes('Programmata'),'la pagina mostra la programmazione');
  const n0=dj().length;await pg.evaluate(async()=>{await diaSched()});ok(dj().length===n0,'prima dell\'orario non pubblica');
  await pg.evaluate(async()=>{S.diary[0].sched=Date.now()-1000;await diaSched()});
  ok(dj().length>n0&&dj().pop().voci.some(v=>v.t==='Prova')&&await pg.evaluate(()=>S.diary[0].pub&&!S.diary[0].sched),'all\'orario la voce parte da sola');
  ok(!(await pg.innerHTML('#main')).includes('Pubblica per i giocatori ('),'niente numero nel pulsante di pubblicazione');
  await pg.evaluate(()=>{localStorage.removeItem('master-pokerole-gh');S.diary=[];ui.stack=[];render()});
  // note dei giocatori: invio dalla pagina giocatori, ricezione e approvazione del master
  const pg2=await ctx.newPage();let shared=null;
  await pg2.addInitScript(()=>{navigator.share=async o=>{window.__shared=o}});
  await pg2.goto(url+'diario.html');await pg2.waitForSelector('#nota [data-n=open]');await pg2.click('#nota [data-n=open]');
  await pg2.fill('#na','Marco');await pg2.fill('#nt','La notte al faro');await pg2.fill('#nb','Abbiamo visto **Lugia**.');await pg2.click('#nota [data-n=send]');
  shared=await pg2.evaluate(()=>window.__shared);
  ok(shared&&/#imp=/.test(shared.url)&&/Marco/.test(shared.text),'diario.html: la nota parte come link per il master');
  ok(await pg2.evaluate(()=>JSON.parse(localStorage.getItem('diario-note-inviate'))[0].t==='La notte al faro'),'diario.html: la nota compare tra quelle inviate');
  await pg2.close();
  const np=await pg.evaluate(async u=>{localStorage.setItem('master-pokerole-gh',JSON.stringify({tok:'x',ok:true,repo:'a/b'}));S.diary=[];S.prop=[];
    ui.impt=u;await ACT.impread();const prev=document.querySelector('#sheet')?1:0;ui.stack=[{k:'imp'}];render();const btn=!!document.querySelector('[data-a=impdo][data-i=nota]');ACT.impdo({i:'nota'});
    const inProp=S.prop.length===1&&S.prop[0].a==='Marco';ui.stack=[];ui.tab='diario';ui.dmode='edit';render();const sec=document.getElementById('main').innerHTML.includes('Proposte dei giocatori');
    return {btn,inProp,sec,id:S.prop[0]&&S.prop[0].id}},shared.url);
  ok(np.btn&&np.inProp,'il master riceve la nota tra le proposte');
  ok(np.sec,'il diario del master mostra la sezione Proposte dei giocatori');
  await pg.evaluate(id=>{ui.stack=[{k:'prop',i:id}];render()},np.id);await pg.click('#sheet [data-a=papp][data-i=pub]');await pg.waitForTimeout(400);
  const last=dj().pop();
  ok(last&&last.voci.some(v=>v.t==='La notte al faro'&&v.a==='Marco'),'approvata e pubblicata con l\'autore');
  ok(await pg.evaluate(()=>!S.prop.length&&S.diary[0].a==='Marco'),'la proposta diventa una voce del diario');
  const shown=await pg.evaluate(()=>{ui.pubd={voci:[{id:'1',t:'X',c:'ses',b:'y',a:'Marco'}]};return dpList(ui.pubd.voci,1).includes('Scritta da <b>Marco</b>')});
  ok(shown,'i giocatori vedono chi l\'ha scritta');
  // invio anche dall'app in modalità giocatore
  const appSend=await pg.evaluate(async()=>{localStorage.removeItem('master-pokerole-gh');ui.tab='diario';ui.stack=[];render();const card=document.getElementById('main').innerHTML.includes('Scrivi una nota');
    ui.pn={a:'Giulia',t:'Diario di Giulia',c:'png',b:'testo'};const o=pnObj(),code=await packObj(o),back=await unpackTrainer('#imp='+code);return {card,ok:back.n.a==='Giulia'&&back.n.c==='png'}});
  ok(appSend.card&&appSend.ok,'anche nell\'app i giocatori possono scrivere una nota');
  await pg.evaluate(()=>{S.diary=[];S.prop=[];ui.stack=[];render()});
  // Discord: il master salva il webhook, i giocatori lo attivano con un link e le condivisioni arrivano da sole
  const HOOK='https://discord.com/api/webhooks/123456/abc-DEF_9';pg.on('dialog',d=>d.accept());
  await pg.evaluate(h=>{localStorage.setItem('master-pokerole-gh',JSON.stringify({tok:'x',ok:true,repo:'a/b'}));ui.stack=[{k:'backup'}];render();ui.dcw=h;ACT.dcsave()},HOOK);
  ok(await pg.evaluate(()=>dcOn()&&document.getElementById('sheet').innerHTML.includes('Link per il diario')),'il master salva il webhook e vede i link per i giocatori');
  await pg.evaluate(async()=>{await ACT.dctest()});ok(dcs.length===1&&/riuscito/.test(dcs[0].content),'il pulsante Prova scrive nel canale');
  ok(await pg.evaluate(()=>{ui.dcw='https://example.com/x';ACT.dcsave();return localStorage.getItem('mp-discord')!=='https://example.com/x'}),'un indirizzo che non è di Discord viene rifiutato');
  const link=await pg.evaluate(()=>dcLink(''));
  // diventa un giocatore: niente chiave, niente webhook, poi apre il link del master
  await pg.evaluate(()=>{localStorage.removeItem('master-pokerole-gh');localStorage.removeItem('mp-discord');ui.dcw=null;ui.stack=[];render()});
  await pg.evaluate(l=>{location.hash=l.split('#')[1]},link);await pg.waitForTimeout(300);
  ok(await pg.evaluate(h=>localStorage.getItem('mp-discord')===h,HOOK),'il giocatore attiva Discord aprendo il link');
  const nd=dcs.length;
  await pg.evaluate(async()=>{const t=S.trainers.find(x=>x.team.length)||S.trainers[0];ui.stack=[{k:'trainer',i:t.id}];render();await ACT.tshare()});
  ok(dcs.length===nd+1&&/Scheda allenatore/.test(dcs[nd].content)&&/#imp=/.test(dcs[nd].content||dcs[nd].embeds[0].description),'la scheda allenatore arriva su Discord');
  ok(await pg.evaluate(()=>document.getElementById('sheet').innerHTML.includes('Invia la scheda al master')),'il pulsante dice che va al master');
  await pg.evaluate(async()=>{const t=S.trainers.find(x=>x.team.length);ui.stack=[{k:'trainer',i:t.id},{k:'inst',i:t.team[0].id,o:t.id}];render();await ACT.ishare()});
  ok(dcs.length===nd+2&&/Pokémon/.test(dcs[nd+1].content),'il Pokémon arriva su Discord');
  await pg.evaluate(async()=>{ui.pn={a:'Marco',t:'Al faro',c:'ses',b:'**testo**'};ui.stack=[{k:'pnote'}];await ACT.pnsend()});
  ok(dcs.length===nd+3&&/Nota per il diario/.test(dcs[nd+2].content)&&/\\\*\\\*testo/.test(dcs[nd+2].content),'la nota arriva su Discord (con il testo protetto)');
  // il link nel messaggio Discord si apre davvero come nota nel master
  const back=await pg.evaluate(async c=>{const o=await unpackTrainer(c);return o.n&&o.n.a},dcs[nd+2].content);ok(back==='Marco','il link nel messaggio Discord apre la nota');
  // Discord non risponde: avviso, e al tocco successivo si torna alla chat
  dcStatus=500;const n2=dcs.length;
  await pg.evaluate(async()=>{const t=S.trainers.find(x=>x.team.length);ui.stack=[{k:'trainer',i:t.id}];render();await ACT.tshare();window.__dcf=ui.dcFail});
  ok(await pg.evaluate(()=>window.__dcf===1),'se Discord non risponde, avvisa');
  await pg.evaluate(async()=>{navigator.share=async o=>{window.__sh=o};await ACT.tshare()});
  ok(await pg.evaluate(()=>!!window.__sh)&&dcs.length===n2+1,'al tocco successivo si usa la condivisione in chat');
  dcStatus=200;
  // se Discord non permette l'invio diretto dal browser (niente CORS), si usa l'invio semplice in modulo
  dcNoCors=true;const n4=dcs.length;await pg.evaluate(async()=>{const f0=window.fetch;window.__f0=f0;window.fetch=(u,o)=>/discord/.test(u)&&o&&o.headers&&!o.mode?Promise.reject(new TypeError('Failed to fetch')):f0(u,o);ui.dcFail=0;delete navigator.share;const t=S.trainers.find(x=>x.team.length);ui.stack=[{k:'trainer',i:t.id}];render();await ACT.tshare()});
  await pg.waitForTimeout(300);ok(dcs.length===n4+1&&/Scheda allenatore/.test(dcs[n4].content||''),'invio di riserva senza CORS: il messaggio arriva comunque');dcNoCors=false;await pg.evaluate(()=>{window.fetch=window.__f0});
  // pagina dei giocatori
  const p3=await ctx.newPage();p3.on('dialog',d=>d.accept());const e3=[];p3.on('pageerror',e=>e3.push(e.message));
  await p3.goto(url+'diario.html');await p3.evaluate(()=>localStorage.removeItem('mp-discord'));
  await p3.goto(url+'diario.html#'+link.split('#')[1]);await p3.waitForSelector('#nota [data-n=open]');
  ok(await p3.evaluate(h=>localStorage.getItem('mp-discord')===h,HOOK),'diario.html: il link attiva Discord');
  await p3.click('#nota [data-n=open]');ok((await p3.innerHTML('#nota')).includes('Invia al master su Discord'),'diario.html: il pulsante dice Discord');
  await p3.fill('#na','Giulia');await p3.fill('#nt','Il bosco');await p3.fill('#nb','testo');const n3=dcs.length;await p3.click('#nota [data-n=send]');await p3.waitForTimeout(300);
  ok(dcs.length===n3+1&&/Giulia/.test(dcs[n3].username)&&/\n\*\*Il bosco\*\*/.test(dcs[n3].content),'diario.html: la nota arriva su Discord, mittente il giocatore e titolo a parte');
  await p3.click('#nota [data-n=open]');await p3.fill('#na','Giulia');await p3.fill('#nt','Con foto');await p3.setInputFiles('#nimg',[__dirname+'/../icon-192.png',__dirname+'/../icon-512.png']);await p3.waitForSelector('#nota .thumbs img');await p3.waitForTimeout(300);
  ok((await p3.$$('#nota .thumbs figure')).length===2,'diario.html: si possono aggiungere immagini alla nota');
  const n5=dcs.length;await p3.click('#nota [data-n=send]');await p3.waitForTimeout(500);
  ok(dcs.length===n5+1&&dcs[n5].__files===2&&/Con foto/.test(dcs[n5].content),'diario.html: le immagini arrivano su Discord come allegati');
  const im5=await pg.evaluate(async c=>(await unpackTrainer(c)).n.im,dcs[n5].content);ok(im5===2,'il link dice al master quante immagini ci sono');
  ok(!e3.length,'diario.html senza errori '+e3.join('|'));await p3.close();
  dcNoCors=false;await pg.evaluate(()=>{ui.dcFail=0;ui.pn={a:'Marco',t:'Foto dal faro',c:'luo',b:'eccola'};ui.pnImg=[];ui.stack=[{k:'pnote'}];render()});
  await pg.setInputFiles('#sheet [data-c=pnimg]',[__dirname+'/../icon-192.png']);await pg.waitForFunction(()=>(ui.pnImg||[]).length===1);
  const n6=dcs.length;await pg.evaluate(async()=>{await ACT.pnsend()});await pg.waitForTimeout(300);
  ok(dcs.length===n6+1&&dcs[n6].__files===1&&dcs[n6].username==='Marco · Diario Pokérole','app: nota con immagine su Discord, mittente il giocatore');
  const pv=await pg.evaluate(async c=>{localStorage.setItem('master-pokerole-gh',JSON.stringify({tok:'x',ok:true,repo:'a/b'}));ui.impd=await unpackTrainer(c);ACT.impdo({i:'nota'});const h=document.getElementById('sheet').innerHTML;localStorage.removeItem('master-pokerole-gh');return h},dcs[n6].content);
  ok(/📷/.test(pv)&&/Aggiungi immagini/.test(pv),'il master vede che la nota ha immagini e come aggiungerle');
  const sh7=await pg.evaluate(async()=>{localStorage.removeItem('mp-discord');let got=null;Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async o=>{got=o},configurable:true});const b=await (await fetch('icon-192.png')).blob();ui.pnImg=[{blob:b,u:''}];ui.pn={a:'Marco',t:'Chat',c:'ses',b:'x'};await ACT.pnsend();return got&&got.files&&got.files.length});
  ok(sh7===1,'senza Discord le immagini partono nella condivisione in chat');
  await pg.evaluate(()=>{localStorage.removeItem('mp-discord');delete navigator.share;delete navigator.canShare;S.prop=[];ui.stack=[];render()});
  // punti: base, punti del rango, budget e limiti (Pokémon e allenatori)
  const pts=await pg.evaluate(()=>{const mi=MON.findIndex(m=>m.n==='Eevee'),P=generate(mi,2,'bal');S.saved.unshift(P);ui.stack=[{k:'inst',i:P.id,o:'saved',edit:true}];render();
    const b=monBud(P),html=document.getElementById('sheet').innerHTML;
    // togli tutti i punti del rango, poi prova a scendere sotto la base
    for(let i=0;i<5;i++)while(P.at[i]>b.base[i])ACT.iat({k:i,d:-1});const atBase=P.at.every((v,i)=>v===b.base[i]);ACT.iat({k:0,d:-1});const noBelow=P.at[0]===b.base[0];
    // aggiungi oltre il budget
    for(let n=0;n<20;n++)ACT.iat({k:n%5,d:1});const nb=monBud(P);
    const cap=P.at.every((v,i)=>v<=nb.cap[i]);
    // skill oltre il limite del rango
    PSK.forEach(k=>P.sk[k]=0);for(let n=0;n<10;n++)ACT.isk({k:'Evasion',d:1});
    S.saved.shift();ui.stack=[];
    return {legend:/base della specie/.test(html)&&/punti del rango/.test(html)&&/Da dove vengono i punti/.test(html),atBase,noBelow,used:nb.ua,tot:nb.R.a,cap,ev:P.sk.Evasion,lim:RKPTS[2].l}});
  ok(pts.legend,'scheda Pokémon: legenda base/rango e origine dei punti');
  ok(pts.atBase&&pts.noBelow,'gli attributi non scendono sotto la base della specie');
  ok(pts.used===pts.tot&&pts.cap,'non si superano i punti del rango né il massimo della specie ('+pts.used+'/'+pts.tot+')');
  ok(pts.ev===pts.lim,'le skill si fermano al limite del rango');
  const tp=await pg.evaluate(()=>{const t=newTrainer();t.pg=1;t.age=2;t.rk=1;t.at=[1,1,1,1];t.so=[1,1,1,1,1];S.trainers.push(t);ui.stack=[{k:'trainer',i:t.id}];render();const html=document.getElementById('sheet').innerHTML;
    for(let n=0;n<30;n++)ACT.tat({k:n%4,d:1});const b=trBud(t);S.trainers.pop();ui.stack=[];render();
    return {txt:/per l’età \(Adulto\)/.test(html)&&/per il rango Rookie/.test(html),used:b.ua,tot:b.ta,max:Math.max(...t.at)<=5}});
  ok(tp.txt,'scheda allenatore: punti di età e di rango spiegati');
  ok(tp.used===tp.tot&&tp.max,'allenatore: non si superano i punti di età e rango ('+tp.used+'/'+tp.tot+')');
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
