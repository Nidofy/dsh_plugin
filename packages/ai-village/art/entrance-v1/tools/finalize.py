"""Refresh and independently verify the complete delivery inventory."""
import hashlib, importlib.util
from pathlib import Path
script=Path(__file__).with_name('build.py')
spec=importlib.util.spec_from_file_location('entrance_build',script)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
# Repository .gitattributes requires LF; normalize before hashing so a fresh
# Git checkout retains identical SHA-256 bytes on Windows and other platforms.
for base in [mod.OUT,mod.ROOT]:
    for p in base.rglob('*'):
        if p.is_file() and p.suffix in {'.py','.cjs','.html','.md','.json','.svg','.txt'}:
            p.write_text(p.read_text(encoding='utf-8').rstrip()+'\n',encoding='utf-8',newline='\n')
mod.hashes()
inventory=mod.OUT/'SHA256SUMS.txt'
inventory.write_text(inventory.read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
root=mod.PKG.resolve();n=0
for line in (mod.OUT/'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
    digest,relative=line.split('  ',1);p=(root/relative).resolve()
    assert p.is_relative_to(root) and p.is_file(),relative
    assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,relative
    n+=1
print(f'PASS: {n} SHA-256 inventory entries verified')
