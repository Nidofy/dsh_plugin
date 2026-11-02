import sys,json,contextlib,importlib.util
args=json.load(sys.stdin)
with contextlib.redirect_stdout(sys.stderr):
 spec=importlib.util.spec_from_file_location('submission','/work/submission.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 result=module.configure() if sys.argv[1]=='configure' else module.solve(*args)
def default(x):
 if hasattr(x,'detach'):return x.detach().cpu().tolist()
 if hasattr(x,'tolist'):return x.tolist()
 raise TypeError(type(x).__name__)
print(json.dumps(result,default=default,allow_nan=False))
