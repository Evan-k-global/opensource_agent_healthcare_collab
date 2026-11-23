"""Public reproducible SDK integration test; optionally use real proofs and Zeko."""
import argparse, json, os, socket, subprocess, sys, time, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def port():
    with socket.socket() as s: s.bind(('127.0.0.1',0)); return s.getsockname()[1]
def run(args):
    os.chdir(ROOT); local=ROOT/'.local'; local.mkdir(exist_ok=True,mode=0o700)
    if os.environ.get('COMPANY_REMOTE_CONFIG') or os.environ.get('WORKER_ISOLATION') == 'docker':
        raise ValueError('Fixture test requires default local company processes; unset remote/Docker worker configuration')
    model_port, api_port = port(), port()
    env={**os.environ,'PORT':str(api_port),'AGENT_INTELLIGENCE':'mock','GEMMA_MODEL':'transport-fixture',
         'GEMMA_BASE_URL':f'http://127.0.0.1:{model_port}/v1',
         'GEMMA_A_BASE_URL':f'http://127.0.0.1:{model_port}/v1','GEMMA_B_BASE_URL':f'http://127.0.0.1:{model_port}/v1'}
    children=[]; files=[]
    try:
        for name,command in [('model',[sys.executable,'antigravity/model_fixture.py','--port',str(model_port)]),
            ('backend',['node','src/server.mjs']+(['--proofs'] if args.proofs or args.zeko else [])+(['--zeko'] if args.zeko else []))]:
            f=open(local/f'harness-{name}.log','w');files.append(f)
            children.append(subprocess.Popen(command,env=env,stdout=f,stderr=f))
        deadline=time.monotonic()+120
        while True:
            if any(c.poll() is not None for c in children): raise RuntimeError('fixture service exited; inspect .local/harness-*.log')
            try:
                paths=[local/f'company-{c}'/f'{c}-{r}.access.json' for c in 'ab' for r in ('liaison','researcher','reviewer')]
                if all(json.loads(p.read_text())['baseUrl']==f'http://127.0.0.1:{api_port}' for p in paths): break
            except (FileNotFoundError,json.JSONDecodeError): pass
            if time.monotonic()>deadline: raise TimeoutError('backend startup')
            time.sleep(.25)
        subprocess.run([sys.executable,'antigravity/run.py'],env=env,check=True,timeout=2400)
        report=json.loads((local/'public-report.json').read_text())
        assert report['completed'] and report['acceptedStateUpdate']
        if args.proofs or args.zeko: assert report['proofMode']=='real-o1js'
        if args.zeko: assert report['nodeRejectedAlteredTransaction']
        with urllib.request.urlopen(f'http://127.0.0.1:{model_port}/stats') as response: stats=json.load(response)
        assert stats['adviceRequests']==10 and stats['toolCalls']>=20
        for company in 'ab':
            admin=json.loads((local/f'company-{company}'/'admin-report.json').read_text())
            assert set(admin['rooms'])=={f'{company}-internal','bilateral-planning'}
            assert len(admin['rooms'][f'{company}-internal'])==4 and len(admin['rooms']['bilateral-planning'])==3
            assert len(admin['modelAdvice'])==5 and all(a['mode']=='mock' for a in admin['modelAdvice'])
            assert admin['identityHandshake']=='verified-simulated-attestations'
            assert not any(key in json.dumps(admin) for key in ('patientId','featureScore','resultSalt','"records"','"salt"'))
        overview=json.loads((local/'admin-overview.json').read_text())
        assert overview['completedSteps']==10 and not overview['failed']
        result={'sdk':'google-antigravity==0.1.10','actualGemma':False,'model':'scripted transport fixture','workflowSteps':10,'agents':6,
                'realApplicationProofs':report['proofMode']=='real-o1js','settlement':report['settlement'],
                'companyAdminBoundariesChecked':True,'identityHandshakeBound':report['identityHandshake']['planBound'],**stats}
        (local/'harness-validation.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
    finally:
        for c in reversed(children):
            c.terminate()
            try:c.wait(timeout=15)
            except subprocess.TimeoutExpired:c.kill();c.wait()
        for f in files:f.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--proofs',action='store_true');p.add_argument('--zeko',action='store_true');run(p.parse_args())
