"""Create a company-scoped source bundle for an independently administered host."""
import argparse, hashlib, io, json, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('company',choices=['a','b']);p.add_argument('--output',type=Path);a=p.parse_args()
    output=a.output or ROOT/'.local/handoff'/f'company-{a.company}.tar.gz';output.parent.mkdir(parents=True,exist_ok=True)
    allowed=['src','vendor','config','antigravity','web',f'fixtures/company-{a.company}','docs','skills','package.json','package-lock.json','LICENSE','NOTICE','README.md','REVIEW.md','AGENTS.md']
    files=[]
    for item in allowed:
        path=ROOT/item
        for file in path.rglob('*') if path.is_dir() else [path]:
            if file.is_file() and not file.is_symlink() and not set(file.parts)&{'node_modules','__pycache__','.local','.cache','.venv'} and file.suffix!='.pyc':files.append(file)
    manifest={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
    with tarfile.open(output,'w:gz') as archive:
        for file in files:archive.add(file,arcname='research-collab-demo/'+str(file.relative_to(ROOT)),recursive=False)
        data=(json.dumps({'company':a.company,'files':manifest},indent=2)+'\n').encode();info=tarfile.TarInfo('research-collab-demo/company-bundle.json');info.size=len(data);info.mode=0o644;archive.addfile(info,io.BytesIO(data))
    with tarfile.open(output) as archive:
        assert not any(f'fixtures/company-{"b" if a.company=="a" else "a"}/' in n for n in archive.getnames())
    print(json.dumps({'company':a.company,'files':len(files),'archive':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},indent=2))
if __name__=='__main__':main()
