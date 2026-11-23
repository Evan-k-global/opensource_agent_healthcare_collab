const $ = id => document.getElementById(id);
let token = new URLSearchParams(location.hash.slice(1)).get('token') || sessionStorage.getItem('admin-token') || '';
history.replaceState(null, '', location.pathname);
if(token)sessionStorage.setItem('admin-token',token);
addEventListener('hashchange',()=>{const next=new URLSearchParams(location.hash.slice(1)).get('token');if(next){token=next;sessionStorage.setItem('admin-token',token);history.replaceState(null,'',location.pathname);refresh();}});
const element = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
function check(parent, label, value) { const e = element('div', undefined, 'check'); e.append(element('span',label),element('strong',String(value))); parent.append(e); }
async function request(path, body) {
  const r = await fetch(path, { method: body ? 'POST':'GET', headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, ...(body ? {body:JSON.stringify(body)}:{}) });
  const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Request failed'); return data;
}
$('login').addEventListener('submit', e => { e.preventDefault(); token=$('token').value.trim(); sessionStorage.setItem('admin-token',token); refresh(); });
let busy=false;
async function refresh() {
  if (!token || busy) return; busy=true;
  try {
    const data = await request('/api/view'), s=data.status;
    $('error').hidden=true; $('login').hidden=true; $('dashboard').hidden=false;
    $('connection').textContent='Live · '+new Date().toLocaleTimeString();
    $('scope').textContent=data.scope==='operator'?'COORDINATOR · PROGRESS ONLY':`COMPANY ${data.scope.toUpperCase()} · PRIVATE ADMINISTRATOR`;
    $('metrics').replaceChildren();
    for(const [label,value] of [['Workflow',s.state],['Agents','6 / 2 companies'],['Encrypted envelopes',data.deliveredEnvelopes],['Completed steps',`${s.step} / ${s.totalSteps}`]]) { const m=element('div',undefined,'metric');m.append(element('span',label),element('strong',value));$('metrics').append(m); }
    $('case').textContent=s.caseId; $('mode').textContent=s.proofMode==='real-o1js'?'REAL APPLICATION PROOFS':'PROOF SIMULATION';
    $('timeline').replaceChildren(); $('step-count').textContent=s.busy?'Working…':s.state==='settled'?'Complete':'Ready';
    for(const step of data.steps) { const li=element('li',step.label,step.index<s.step?'done':step.index===s.step?'active':'');li.append(element('small',step.agent));$('timeline').append(li); }
    $('trust').replaceChildren(); check($('trust'),'Identity',data.identity);check($('trust'),'Human checkpoints',s.humanReview?'Enabled':'Off');check($('trust'),'Model routing',s.modelRouting?'Proceed / review':'Off');
    if(data.initializationError||s.failureReason)check($('trust'),'Stopped',data.initializationError||s.failureReason);
    $('reviews').replaceChildren();
    for(const r of data.controls.requests) {
      const card=element('div',undefined,'review');card.append(element('strong',r.name.replaceAll('_',' ')),element('small',`Company ${r.org.toUpperCase()} · ${r.state}`));
      if(data.scope===r.org && ['pending','held'].includes(r.state)) {
        const row=element('div',undefined,'row');
        for(const [decision,label,cls] of [['approve','Approve',''],['hold','Hold','secondary'],['reject','Reject','danger']]) {
          const b=element('button',label,cls);b.onclick=async()=>{b.disabled=true;try{await request('/api/review',{caseId:s.caseId,id:r.id,decision});}catch(e){$('error').textContent=e.message;$('error').hidden=false;}finally{b.disabled=false;refresh();}};row.append(b);
        } card.append(row);
      } $('reviews').append(card);
    }
    $('routes').replaceChildren();for(const r of data.controls.routes.slice(-4))check($('routes'),`${r.org.toUpperCase()} / ${r.stage}`,`${r.decision} · ${r.modelMode}`);
    $('proof').replaceChildren();const p=s.report;
    if(p){check($('proof'),'Application proof',p.applicationProofVerified?'Verified':'Simulated');check($('proof'),'Altered proof rejected',p.nodeRejectedAlteredTransaction===true?'By native Zeko':'Not tested in this mode');check($('proof'),'State accepted',p.acceptedStateUpdate?'Yes':'No');check($('proof'),'Settlement',p.settlement);const code=element('code',p.contractAddress);$('proof').append(code);}else{$('proof').append(element('p',s.busy?'Computation or proof execution is in progress. First compilation can take several minutes.':'The final proof and state receipt will appear here.','muted'));}
    const privateReport=data.privateReport;$('rooms-panel').hidden=!privateReport;$('advice-panel').hidden=!privateReport;
    if(privateReport){$('rooms').replaceChildren();for(const [name,messages]of Object.entries(privateReport.rooms)){const room=element('div',undefined,'room');room.append(element('h3',name));if(!messages.length)room.append(element('p','No messages yet.','muted'));for(const m of messages){const item=element('div',undefined,'message');item.append(element('small',`${m.sender} → ${m.recipient} · ${m.direction}`),element('p',m.summary));room.append(item);}$('rooms').append(room);}$('advice').replaceChildren();for(const a of privateReport.modelAdvice){const item=element('div',undefined,'advice');item.append(element('small',`${a.role} / ${a.action} · ${a.mode} · ${a.decision}`),element('p',a.rationale));$('advice').append(item);}}
  }catch(e){$('connection').textContent='Disconnected';$('error').textContent=e.message;$('error').hidden=false;$('login').hidden=false;}finally{busy=false;}
}
refresh();setInterval(refresh,2000);
