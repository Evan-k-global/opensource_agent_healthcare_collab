#!/usr/bin/env python3
"""Start the isolated demo from a clean source checkout. Standard library only."""
import argparse, hashlib, importlib.util, json, os, shutil, socket, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def run(command, **kwargs):
    return subprocess.run(command, cwd=ROOT, check=True, **kwargs)

def preflight(args):
    checks=[]
    def check(name, fn):
        try: detail=fn();checks.append({'check':name,'ok':True,'detail':detail})
        except Exception as error:checks.append({'check':name,'ok':False,'detail':str(error)})
    def version(command):return subprocess.check_output(command,cwd=ROOT,text=True,stderr=subprocess.STDOUT,timeout=20).strip()
    def node():
        v=version(['node','--version']); parts=tuple(map(int,v.lstrip('v').split('.')))
        if parts<(20,19,0):raise RuntimeError('Node 20.19+ required')
        return v
    check('Node',node)
    check('npm',lambda:version(['npm','--version']))
    check('Python',lambda:sys.version.split()[0] if sys.version_info>=(3,10) else (_ for _ in ()).throw(RuntimeError('Use Python 3.10+ (for example python3.12 demo.py)')))
    check('SSH',lambda:version(['ssh','-V']))
    if not args.remote_config or not args.fast:
        check('Docker',lambda:version(['docker','info','--format','{{.ServerVersion}}']))
        check('Compose',lambda:version(['docker','compose','version','--short']))
    def port_free(port):
        with socket.socket() as sock:
            sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
            sock.bind(('127.0.0.1',port))
        return 'available'
    for port in [17410,7420,7421,7422]+([17411] if args.mock else []):check(f'Port {port}',lambda port=port:port_free(port))
    if not args.mock and not args.remote_config:
        def gemma():
            import urllib.request
            with urllib.request.urlopen('http://127.0.0.1:11434/api/tags',timeout=10) as response:data=json.load(response)
            model=next((m for m in data['models'] if m['name']==args.model),None)
            if not model:raise RuntimeError('Install the model first: ollama pull '+args.model)
            return model['name']+' '+model['digest']
        check('Gemma',gemma)
    print(json.dumps({'checks':checks,'ready':all(c['ok'] for c in checks)},indent=2),flush=True)
    return all(c['ok'] for c in checks)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    model=parser.add_mutually_exclusive_group();model.add_argument('--mock',action='store_true',help='Bundled fixture; real SDK and real proofs by default');model.add_argument('--gemma',action='store_true',help='Use locally installed Gemma (default)')
    parser.add_argument('--model',default='gemma4:e2b-it-q4_K_M');parser.add_argument('--fast',action='store_true',help='Explicitly disable cryptographic proofs and skip Zeko')
    parser.add_argument('--check',action='store_true',help='Read-only preflight');parser.add_argument('--once',action='store_true',help='Exit after validation instead of retaining dashboards')
    parser.add_argument('--no-browser',action='store_true');parser.add_argument('--review',action='store_true');parser.add_argument('--routing',action='store_true')
    parser.add_argument('--new-case',action='store_true',help='Archive last public receipt and start a fresh case (also the default)')
    parser.add_argument('--remote-config');parser.add_argument('--ssh-config');parser.add_argument('--require-distinct-hosts',action='store_true')
    args=parser.parse_args();os.chdir(ROOT)
    if not preflight(args):raise SystemExit('Preflight failed. Resolve the reported items; see docs/QUICKSTART.md.')
    if args.check:return
    local=ROOT/'.local';local.mkdir(exist_ok=True,mode=0o700)
    # Exclusive lock prevents two launchers from rotating the same credential files.
    lock=local/'demo.lock'
    try: fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    except FileExistsError:raise SystemExit('Another launcher or stale .local/demo.lock exists. See docs/QUICKSTART.md recovery steps.')
    os.write(fd,str(os.getpid()).encode());os.close(fd)
    try:
        report=local/'public-report.json'
        if report.exists():
            stamp=time.strftime('%Y%m%d-%H%M%S')
            archive=local/'runs'/stamp;archive.mkdir(parents=True)
            shutil.copy2(report,archive/'report.json')
            if (local/'public-evidence').exists():
                proved=json.loads(report.read_text()).get('applicationProofVerified') is True
                shutil.move(str(local/'public-evidence'),str(archive/('proof' if proved else 'prior-proof-unassociated')))
            if (local/'distributed/validation.json').exists():shutil.copy2(local/'distributed/validation.json',archive/'validation.json')
        lock_hash=hashlib.sha256((ROOT/'package-lock.json').read_bytes()).hexdigest()
        marker=local/'installed-lock.sha256'
        if not (ROOT/'node_modules/o1js').exists() or not marker.exists() or marker.read_text()!=lock_hash:
            run(['npm','ci','--ignore-scripts']);marker.write_text(lock_hash)
        venv=ROOT/'.venv';python=venv/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
        if not python.exists():run([sys.executable,'-m','venv',str(venv)])
        if subprocess.run([str(python),'-c','import google.antigravity'],capture_output=True).returncode:run([str(python),'-m','pip','install','-r','antigravity/requirements-lock.txt'])
        if not args.fast:run(['npm','run','zeko:up'])
        if not args.remote_config:
            run([str(python),'deployment/init_hosts.py']);run(['npm','run','hosts:up'])
        command=[str(python),'deployment/validate_local_hosts.py','--dashboard','--model',args.model]
        if args.mock:command+=['--mock']
        if not args.fast:command+=['--zeko']
        if not args.once:command+=['--keep-open']
        if not args.no_browser:command+=['--open-browser']
        if args.remote_config:command+=['--remote-config',str(Path(args.remote_config).resolve())]
        if args.ssh_config:command+=['--ssh-config',str(Path(args.ssh_config).resolve())]
        if args.require_distinct_hosts:command+=['--require-distinct-hosts']
        env={**os.environ,'HUMAN_REVIEW':'1' if args.review else '0','MODEL_ROUTING':'1' if args.routing else '0'}
        try:run(command,env=env)
        except KeyboardInterrupt:print('\nDemo stopped. Private logs and public evidence remain in .local. Docker services remain available.')
    finally:lock.unlink(missing_ok=True)
if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:print('Launcher stopped; existing evidence retained.')
