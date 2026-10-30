#!/usr/bin/env python3
import glob,os,sys,sysconfig
from pathlib import Path
root=Path(__file__).resolve().parent
env=dict(os.environ)
libs=glob.glob(str(Path(sysconfig.get_paths()['purelib'])/'nvidia/*/lib'))
env['LD_LIBRARY_PATH']=':'.join(libs+([env['LD_LIBRARY_PATH']] if env.get('LD_LIBRARY_PATH') else []))
os.chdir(root)
os.execve(sys.executable,[sys.executable,'-m','uvicorn','server:app','--host','127.0.0.1','--port',os.environ.get('DSH_VOICE_PORT','8766'),'--no-access-log'],env)
