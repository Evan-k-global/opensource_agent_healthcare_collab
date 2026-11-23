"""Create fresh local container-host identities and pinned SSH trust. No cloud hosts."""
import argparse, json, os, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main(args):
    base=ROOT/'.local'/'ssh-hosts';base.mkdir(parents=True,exist_ok=True,mode=0o700)
    def key(path):
        if not path.exists(): subprocess.run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(path)],check=True)
    key(base/'client')
    config=[];known=[];hosts={}
    for org,port in [('a',22221),('b',22222)]:
        d=base/org;d.mkdir(exist_ok=True,mode=0o700);key(d/'ssh_host_ed25519_key')
        (d/'authorized_keys').write_text((base/'client.pub').read_text());os.chmod(d/'authorized_keys',0o600)
        pub=(d/'ssh_host_ed25519_key.pub').read_text().split()
        known.append(f'[127.0.0.1]:{port} {pub[0]} {pub[1]}')
        config.append(f'Host research-company-{org}\n  HostName 127.0.0.1\n  Port {port}\n  User researcher\n  IdentityFile "{base}/client"\n  IdentitiesOnly yes\n  UserKnownHostsFile "{base}/known_hosts"\n  StrictHostKeyChecking yes\n  BatchMode yes\n  ServerAliveInterval 15\n  ServerAliveCountMax 3\n')
        hosts[org]={'host':f'research-company-{org}','directory':'/srv/research-collab-demo','intelligence':args.intelligence,'model':args.model,'modelBaseUrl':f'http://127.0.0.1:{args.model_port}/v1'}
    for name,data in [('config','\n'.join(config)),('known_hosts','\n'.join(known)+'\n'),('companies.json',json.dumps(hosts,indent=2)+'\n')]:
        (base/name).write_text(data);os.chmod(base/name,0o600)
    print('Local container SSH identities initialized; private keys remain in .local/ssh-hosts.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',default='gemma4:e2b-it-q4_K_M');p.add_argument('--intelligence',choices=['off','gemma','mock'],default='gemma');p.add_argument('--model-port',type=int,default=11434);main(p.parse_args())
