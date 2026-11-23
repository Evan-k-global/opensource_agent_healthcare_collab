import test from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../src/controls.mjs';

test('company reviews enforce scope, case, hold, finality, and both-party settlement', async () => {
  const c=new Controls('case-1');
  try {
    const completed=c.review({name:'before_settlement'});
    assert.equal(c.view('a').requests.length,1);assert.equal(c.view('operator').requests.length,2);
    const a=c.view('a').requests[0], b=c.view('b').requests[0];
    assert.throws(()=>c.decide('b',{caseId:'case-1',id:a.id,decision:'approve'}),/scope/);
    assert.throws(()=>c.decide('operator',{caseId:'case-1',id:a.id,decision:'approve'}),/scope/);
    assert.throws(()=>c.decide('a',{caseId:'wrong',id:a.id,decision:'approve'}),/stale/);
    c.decide('a',{caseId:'case-1',id:a.id,decision:'hold'});assert.equal(c.pending.size,2);
    c.decide('a',{caseId:'case-1',id:a.id,decision:'approve'});assert.equal(c.pending.size,1);
    assert.throws(()=>c.decide('a',{caseId:'case-1',id:a.id,decision:'approve'}),/resolved/);
    c.decide('b',{caseId:'case-1',id:b.id,decision:'approve'});assert.equal(await completed,true);
  } finally {c.close();}
});
test('model routing holds for a scoped human decision and cannot invent authority', async()=>{
  const c=new Controls('case-2');
  try {
    await assert.rejects(()=>c.route({org:'a',stage:'compute-a',role:'researcher',advice:{mode:'gemma',role:'administrator',decision:'proceed'}}),/scope/);
    const routing=c.route({org:'a',stage:'compute-a',role:'researcher',advice:{mode:'gemma',role:'researcher',decision:'hold'}});
    const request=c.view('a').requests[0];assert.equal(request.name,'model_route_hold');
    c.decide('a',{caseId:'case-2',id:request.id,decision:'approve'});assert.equal(await routing,'researcher');
  }finally{c.close();}
});
test('review expiry fails closed',async()=>{const c=new Controls('case-3',{timeoutMs:10});await assert.rejects(()=>c.review({org:'a',name:'before_compute'}),/deadline/);assert.equal(c.pending.size,0);});

test('either company rejection cancels the peer settlement review immediately',async()=>{const c=new Controls('reject-case',{timeoutMs:1000});try{const result=c.review({name:'before_settlement'});const a=c.view('a').requests[0];c.decide('a',{caseId:'reject-case',id:a.id,decision:'reject'});assert.equal(await result,false);assert.equal(c.pending.size,0);assert.equal(c.view('b').requests[0].state,'cancelled');}finally{c.close();}});
