"""Reproduce two isolated container hosts, each with its own Antigravity harness.

The Mac/host coordinator provides Zeko and, for this local topology only, one
shared loopback model server forwarded into each company over authenticated SSH.
This is not a two-physical-machine or independently hosted-model claim.
"""
import argparse, json, os, shlex, subprocess, sys, time, urllib.request, webbrowser, re
from urllib.parse import urlparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main(args):
    os.chdir(ROOT)
    if args.mock: args.model='transport-fixture'
    base=ROOT/'.local'/'ssh-hosts';logs=ROOT/'.local'/'distributed';logs.mkdir(parents=True,exist_ok=True,mode=0o700)
    ssh_config=Path(args.ssh_config).resolve() if args.ssh_config else base/'config'
    if not ssh_config.exists(): raise RuntimeError('Run deployment/init_hosts.py and docker compose -f deployment/compose.yaml up -d --build first')
    companies=json.loads(Path(args.remote_config).read_text() if args.remote_config else (base/'companies.json').read_text())
    if set(companies)!=set('ab'): raise ValueError('Exactly company a and b must be configured')
    model_port=args.model_port or (17411 if args.mock else 11434)
    for entry in companies.values():
        if not args.remote_config: entry.update(intelligence='mock' if args.mock else 'gemma',model=args.model,modelBaseUrl=f'http://127.0.0.1:{model_port}/v1')
        else:
            if args.mock: raise ValueError('Remote-host mode requires each host’s own Gemma server')
            entry['intelligence']='gemma'
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.@-]*',entry.get('host','')): raise ValueError('Safe SSH host alias required')
        url=urlparse(entry.get('modelBaseUrl',''))
        if url.scheme!='http' or url.hostname not in ('127.0.0.1','localhost'): raise ValueError('Company-local model endpoint required')
        if not entry.get('directory','').startswith('/') or any(c in entry['directory'] for c in '\n\r\0'): raise ValueError('Absolute safe company directory required')
    runtime_config=logs/'companies.json';runtime_config.write_text(json.dumps(companies));os.chmod(runtime_config,0o600)
    ssh=['ssh','-F',str(ssh_config),'-o','ConnectTimeout=10','-o','ExitOnForwardFailure=yes']
    def remote(org,command,**kw):
        return subprocess.run(ssh+[companies[org]['host'],command],check=True,text=True,**kw)
    def python_command(code, org): return shlex.quote(companies[org].get('python','python3'))+' -c '+shlex.quote(code)
    children=[];files=[]
    def launch(name,command,env=None):
        file=open(logs/f'{name}.log','w');files.append(file)
        child=subprocess.Popen(command,env=env,stdout=file,stderr=file);children.append(child);return child
    def alive():
        for child in children:
            if child.poll() is not None and child.returncode != 0: raise RuntimeError(f'Process failed ({child.returncode}); inspect .local/distributed logs')
    try:
        if args.mock:
            launch('model',[sys.executable,'antigravity/model_fixture.py','--port',str(model_port)])
        elif not args.remote_config:
            # Confirm an installed local model, retaining only public identifiers.
            with urllib.request.urlopen(f'http://127.0.0.1:{model_port}/api/tags',timeout=10) as response: tags=json.load(response)['models']
            selected=next((m for m in tags if m['name']==args.model),None)
            if not selected or not args.model.startswith('gemma'): raise RuntimeError('The selected local Gemma model is not installed in Ollama')
        host_ids={};model_metadata={}
        for org in 'ab':
            deadline=time.monotonic()+60
            while True:
                ready=subprocess.run(ssh+[companies[org]['host'],'true'],capture_output=True,text=True)
                if ready.returncode==0:break
                if time.monotonic()>deadline:raise RuntimeError('Company SSH unavailable: '+ready.stderr)
                time.sleep(1)
            code=f"import os,json;os.chdir({companies[org]['directory']!r});print(json.dumps({{'own':os.path.isdir('fixtures/company-{org}'),'peer':os.path.exists('fixtures/company-{'b' if org=='a' else 'a'}')}}))"
            check=remote(org,python_command(code,org),capture_output=True)
            assert json.loads(check.stdout)=={'own':True,'peer':False},'Company fixture separation failed'
            host_ids[org]=remote(org,python_command("import platform,uuid;print(platform.node()+':'+str(uuid.getnode()))",org),capture_output=True).stdout.strip()
            if args.remote_config:
                model_url=companies[org]['modelBaseUrl'].removesuffix('/v1')+'/api/tags'
                metadata=json.loads(remote(org,python_command(f"import urllib.request,json;print(urllib.request.urlopen({model_url!r},timeout=10).read().decode())",org),capture_output=True).stdout)
                chosen=next((m for m in metadata['models'] if m['name']==companies[org]['model']),None)
                if not chosen or not chosen['name'].startswith('gemma'): raise RuntimeError('Remote Gemma not installed')
                model_metadata[org]={'name':chosen['name'],'digest':chosen['digest']}
            forwards=['-N','-R',f'127.0.0.1:{args.port}:127.0.0.1:{args.port}']
            if not args.remote_config:forwards+=['-R',f'127.0.0.1:{model_port}:127.0.0.1:{model_port}']
            if args.dashboard:forwards+=['-L',f'127.0.0.1:{7421 if org=="a" else 7422}:127.0.0.1:{7421 if org=="a" else 7422}']
            launch(f'tunnel-{org}',ssh+forwards+[companies[org]['host']])
        if args.require_distinct_hosts and len(set(host_ids.values()))!=2: raise RuntimeError('Both SSH aliases resolve to the same host identity')
        time.sleep(1);alive()
        env={**os.environ,'PORT':str(args.port),'COMPANY_REMOTE_CONFIG':str(runtime_config),'COMPANY_SSH_CONFIG':str(ssh_config),'AGENT_INTELLIGENCE':'mock' if args.mock else 'gemma'}
        env.pop('WORKER_ISOLATION',None)
        old_tokens=set()
        for org in 'ab':
            for p in (ROOT/'.local'/f'company-{org}').glob('*.access.json'):
                try:old_tokens.add(json.loads(p.read_text())['token'])
                except (KeyError,json.JSONDecodeError):pass
        launch('backend',['node','src/server.mjs']+(['--proofs','--zeko'] if args.zeko else ['--proofs'] if args.proofs else []),env)
        deadline=time.monotonic()+(1200 if os.environ.get('IDENTITY_PROVIDER_CONFIG') else 120)
        while True:
            alive()
            try:
                credentials={org:{role:json.loads((ROOT/'.local'/f'company-{org}'/f'{org}-{role}.access.json').read_text()) for role in ('liaison','researcher','reviewer')} for org in 'ab'}
                if all(c['baseUrl']==f'http://127.0.0.1:{args.port}' and c['token'] not in old_tokens for group in credentials.values() for c in group.values()): break
            except (FileNotFoundError,json.JSONDecodeError): pass
            if time.monotonic()>deadline: raise TimeoutError('Backend initialization')
            time.sleep(.25)
        # Copy only each company's own scoped agent and administrator credentials over SSH.
        harnesses=[]
        for org in 'ab':
            code="""import os,json,pathlib,sys
os.umask(0o077)
org=sys.argv[1];data=json.load(sys.stdin)
root=pathlib.Path(sys.argv[2])/'.local'/('company-'+org);root.mkdir(parents=True,exist_ok=True)
for role,c in data.items():
 assert (role=='admin' and c['scope']==org) or (role in ('liaison','researcher','reviewer') and c['agentId']==org+'-'+role)
 p=root/('admin.access.json' if role=='admin' else org+'-'+role+'.access.json');p.write_text(json.dumps(c));os.chmod(p,0o600)
"""
            credentials[org]['admin']=json.loads((ROOT/'.local'/f'company-{org}'/'admin.access.json').read_text())
            remote(org,python_command(code,org)+' '+shlex.join([org,companies[org]['directory']]),input=json.dumps(credentials[org]))
            if args.dashboard:
                dashboard_command='cd '+shlex.quote(companies[org]['directory'])+' && exec env '+shlex.join([f'ADMIN_ACCESS_FILE=.local/company-{org}/admin.access.json',f'ADMIN_PORT={7421 if org=="a" else 7422}'])+' node src/admin-server.mjs'
                launch(f'dashboard-{org}',ssh+[companies[org]['host'],dashboard_command])
            command='cd '+shlex.quote(companies[org]['directory'])+' && exec env '+shlex.join([f'GEMMA_MODEL={companies[org]["model"]}',f'GEMMA_BASE_URL={companies[org]["modelBaseUrl"]}'])+' '+shlex.quote(companies[org].get('python','/opt/antigravity/bin/python'))+' antigravity/run.py '+shlex.join(['--company',org,'--access-dir',f'.local/company-{org}','--state-dir',f'.local/company-{org}/sdk','--result-file',f'.local/company-{org}/harness-validation.json','--timeout',str(args.timeout)])
            harnesses.append(launch(f'harness-{org}',ssh+[companies[org]['host'],command]))
        if args.dashboard:
            launch('dashboard-operator',['node','src/admin-server.mjs'],{**os.environ,'ADMIN_ACCESS_FILE':str(ROOT/'.local/admin.access.json'),'ADMIN_PORT':'7420'})
            links={scope:f'http://127.0.0.1:{7420 if scope=="operator" else 7421 if scope=="a" else 7422}/#token='+json.loads((ROOT/'.local'/('admin.access.json' if scope=='operator' else f'company-{scope}/admin.access.json')).read_text())['token'] for scope in ['operator','a','b']}
            links_file=ROOT/'.local/dashboard-links.json';links_file.write_text(json.dumps(links,indent=2));os.chmod(links_file,0o600)
            print('Dashboards ready. Private links: .local/dashboard-links.json',flush=True)
            if args.open_browser:
                for link in links.values():webbrowser.open(link)
        deadline=time.monotonic()+args.timeout
        while any(c.poll() is None for c in harnesses):
            alive()
            if time.monotonic()>deadline: raise TimeoutError('Distributed harness run')
            time.sleep(.5)
        alive()
        report=json.loads((ROOT/'.local/public-report.json').read_text())
        assert report['completed'] and report['acceptedStateUpdate']
        if args.zeko: assert report['nodeRejectedAlteredTransaction']
        company_results={}
        for org in 'ab':
            code="""import json,pathlib,sys
org=sys.argv[1];p=pathlib.Path(sys.argv[2])/'.local'/('company-'+org)
h=json.loads((p/'harness-validation.json').read_text());a=json.loads((p/'admin-report.json').read_text())
assert h['company']==org and h['completed'] and not h['centralCrossCompanyDriver'] and len(h['completedSteps'])==5
assert all(agent.startswith(org+'-') for agent in h['agents'])
assert set(a['rooms'])=={org+'-internal','bilateral-planning'} and len(a['modelAdvice'])==5
assert not (p.parent/('company-'+('b' if org=='a' else 'a'))).exists()
assert not any(k in json.dumps(a) for k in ('patientId','featureScore','resultSalt','"records"','"salt"'))
print(json.dumps({'harness':h,'privateRoomBoundaryChecked':True,'adviceModes':sorted(set(v['mode'] for v in a['modelAdvice']))}))
"""
            company_results[org]=json.loads(remote(org,python_command(code,org)+' '+shlex.join([org,companies[org]['directory']]),capture_output=True).stdout)
        result={'sdk':'google-antigravity==0.1.10','actualGemma':not args.mock,'model':args.model,
                'modelDigest':None if args.mock or args.remote_config else selected['digest'],'remoteModelMetadata':model_metadata,
                'topology':'ssh-company-hosts' if args.remote_config else 'two-isolated-Linux-containers-on-one-physical-host',
                'independentCompanyHarnesses':True,'sharedLocalInferenceServer':not bool(args.remote_config),'sshPinnedHostTrust':True,
                'physicalMachines':None if args.remote_config else 1,'distinctReportedHostIds':len(set(host_ids.values()))==2,'companies':company_results,'realApplicationProofs':report['proofMode']=='real-o1js',
                'settlement':report['settlement'],'completed':True}
        (logs/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
        if args.keep_open:
            print('Case complete. Dashboards remain available. Press Ctrl-C to stop this run; evidence is retained.',flush=True)
            while True:time.sleep(1);alive()
    finally:
        for c in reversed(children):
            if c.poll() is None:
                c.terminate()
                try:c.wait(timeout=10)
                except subprocess.TimeoutExpired:c.kill();c.wait()
        for f in files:f.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--mock',action='store_true');p.add_argument('--zeko',action='store_true');p.add_argument('--proofs',action='store_true')
    p.add_argument('--model',default='gemma4:e2b-it-q4_K_M');p.add_argument('--model-port',type=int);p.add_argument('--port',type=int,default=17410);p.add_argument('--timeout',type=int,default=3600)
    p.add_argument('--dashboard',action='store_true');p.add_argument('--keep-open',action='store_true');p.add_argument('--open-browser',action='store_true')
    p.add_argument('--remote-config');p.add_argument('--ssh-config');p.add_argument('--require-distinct-hosts',action='store_true')
    try:main(p.parse_args())
    except KeyboardInterrupt:print('Run stopped; private state and public evidence retained.',flush=True)
