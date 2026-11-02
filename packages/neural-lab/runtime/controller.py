import sys,json,subprocess,traceback,math,os,threading,signal
import numpy as np
import torch
# Student module is loaded only by a subprocess whose stdout/stderr are captured.
# The trusted controller owns checks and emits the final record.
torch.set_num_threads(1)
key=sys.argv[1]; run_id=sys.argv[2]; seed=int(sys.argv[3]); rng=np.random.default_rng(seed); torch.manual_seed(seed)
seq=0

def emit(kind,name,**fields):
 global seq
 seq+=1; print(json.dumps(dict(runId=run_id,seq=seq,type=kind,name=name,**fields),allow_nan=False),flush=True)
def call(args,configure=False):
 p=subprocess.Popen([sys.executable,'/runtime/student.py','configure' if configure else 'solve'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,user=65534,group=65534,extra_groups=[])
 out=bytearray();err=bytearray();overflow=threading.Event()
 def drain(stream,target):
  while True:
   chunk=stream.read(4096)
   if not chunk:break
   if len(target)+len(chunk)>65536:
    overflow.set()
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    break
   target.extend(chunk)
 threads=[threading.Thread(target=drain,args=(p.stdout,out)),threading.Thread(target=drain,args=(p.stderr,err))]
 for t in threads:t.start()
 try:
  p.stdin.write(json.dumps(args).encode());p.stdin.close();p.wait(timeout=15)
 except (subprocess.TimeoutExpired,BrokenPipeError):
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait()
 finally:
  for t in threads:t.join(timeout=1)
 if err:print(err.decode(errors='replace')[-4000:],file=sys.stderr)
 if overflow.is_set():raise RuntimeError('student output limit exceeded')
 if p.returncode: raise RuntimeError(err.decode(errors='replace')[-4000:] or 'student exited without a result')
 stdout=out.decode()
 lines=stdout.splitlines()
 if len(lines)!=1: raise RuntimeError('student protocol requires exactly one result')
 return json.loads(lines[0])
def close(actual,expected):
 a=np.asarray(actual); b=np.asarray(expected)
 if a.shape!=b.shape: raise AssertionError(f'shape {a.shape} != {b.shape}')
 if not np.isfinite(a).all() or not np.allclose(a,b,atol=1e-6,rtol=1e-5): raise AssertionError(f'numerical mismatch: {str(a)[:300]} != {str(b)[:300]}')
def soft(x):
 e=np.exp(x-x.max(-1,keepdims=True)); return e/e.sum(-1,keepdims=True)
def attention(q,k,v,causal=False):
 s=q@k.swapaxes(-1,-2)/math.sqrt(q.shape[-1])
 if causal: s=np.where(np.tril(np.ones(s.shape[-2:],dtype=bool)),s,-np.inf)
 return soft(s)@v

def code_cases():
 n=int(key[-2:]); cases=[]
 for trial in range(3):
  x=rng.normal(size=(2,3,4)); w=rng.normal(size=(4,2)); b=rng.normal(size=2)
  if n==1: args=[x,w,b]; expected=x@w+b
  elif n==2: args=[2+trial,3-trial,1]; a,c,d=args; u=a*c+d; expected=[2*u*c,2*u*a,2*u]
  elif n==3: args=[x]; expected=3*x*x
  elif n==4: w2=rng.normal(size=(2,3)); b2=rng.normal(size=3); args=[x,w,b,w2,b2]; expected=np.maximum(0,x@w+b)@w2+b2
  elif n==5: x=np.array([[1000,1001,1002],[-1000,-1000,-999]],float)+trial*200; args=[x]; expected=soft(x)
  elif n==6:
   t=list(range(12+trial)); cut=7; win=3; args=[t,cut,win]; expected=[[[s[j:j+win],s[j+1:j+win+1]] for j in range(len(s)-win)] for s in [t[:cut],t[cut:]]]
  elif n==7: ids=np.array([[0,2,1],[2,1,0]]); table=rng.normal(size=(3,4)); pos=rng.normal(size=(3,4)); args=[ids,table,pos]; expected=table[ids]+pos
  elif n in (8,9): q=x; k=rng.normal(size=x.shape); v=rng.normal(size=x.shape); args=[q,k,v]; expected=attention(q,k,v,n==9)
  elif n==10: args=[x,2]; expected=x.reshape(2,3,2,2).transpose(0,2,1,3).reshape(2,2,6)
  elif n==11: w2=rng.normal(size=(2,4)); b2=rng.normal(size=4); args=[x,w,b,w2,b2]; z=(x-x.mean(-1,keepdims=True))/np.sqrt(x.var(-1,keepdims=True)+1e-5); expected=x+np.maximum(0,z@w+b)@w2+b2
  elif n==13: args=[x];expected=6*x*x
  elif n==14: x=np.array([[1000.,1001.,-1000.],[-1000.,-1001.,1000.]])+trial;labels=[2,0];args=[x,labels];m=x.max(-1);expected=m+np.log(np.exp(x-m[:,None]).sum(-1))-x[np.arange(2),labels]
  elif n==15:
   weights=[rng.normal(size=(4,4)) for _ in range(4)];args=[x,*weights,2];heads=[]
   for h in range(2):
    q,k,v=[(x@w)[...,h*2:(h+1)*2] for w in weights[:3]];heads.append(attention(q,k,v))
   expected=np.concatenate(heads,axis=-1)@weights[-1]
  elif n==16:
   args=[x];z=torch.tensor(x,dtype=torch.float64,requires_grad=True);n1=torch.nn.functional.layer_norm(z,(4,),eps=1e-5);a=torch.nn.functional.scaled_dot_product_attention(n1,n1,n1,dropout_p=0);u=z+a;y=u+torch.relu(torch.nn.functional.layer_norm(u,(4,),eps=1e-5));g=torch.autograd.grad(y.square().sum(),z)[0];expected=np.stack([y.detach().numpy(),g.numpy()])
  else: t=list(range(6+trial)); args=[t]; expected=[t[:-1],t[1:]]
  args=[a.tolist() if isinstance(a,np.ndarray) else a for a in args]
  try:
   result=call(args)
   if n==6:
    if result!=expected: raise AssertionError('split/window mismatch')
   else: close(result,expected)
   emit('check',f'case-{trial+1}',passed=True,detail='independent reference, atol=1e-6 rtol=1e-5')
  except Exception as e: emit('check',f'case-{trial+1}',passed=False,detail=str(e)[:2000])
 if n in (8,9):
  q=np.zeros((1,2,2));v=np.array([[[2.,0.],[0.,4.]]]); expected=np.array([[[2,0],[1,2]]]) if n==9 else np.array([[[1,2],[1,2]]])
  try: close(call([q.tolist(),q.tolist(),v.tolist()]),expected); emit('check','hand-calculated',passed=True)
  except Exception as e: emit('check','hand-calculated',passed=False,detail=str(e))
 if n==9:
  q=rng.normal(size=(2,4,3));k=rng.normal(size=q.shape);v=rng.normal(size=q.shape)
  try:
   a=call([q.tolist(),k.tolist(),v.tolist()]); k[:,-1]+=20;v[:,-1]-=30;b=call([q.tolist(),k.tolist(),v.tolist()]);close(np.asarray(a)[:,:-1],np.asarray(b)[:,:-1]);emit('check','future-invariance',passed=True)
  except Exception as e:emit('check','future-invariance',passed=False,detail=str(e))

def experiment():
 cfg=call([],True)
 cfg.update(json.loads(sys.argv[4]) if len(sys.argv)>4 else {})
 if 'learningRate' in cfg:cfg['lr']=cfg['learningRate']
 if not isinstance(cfg,dict):raise ValueError('configure() must return a dictionary')
 steps=cfg.get('steps',60);lr=cfg.get('lr',.03)
 if type(steps)!=int or not 1<=steps<=200 or not isinstance(lr,(int,float)) or not math.isfinite(lr) or not .0001<=lr<=1:raise ValueError('steps 1..200; lr .0001..1')
 if key=='grad':
  x=torch.tensor([-.7,.2,1.4],dtype=torch.float64,requires_grad=True);(x**3).sum().backward()
  for j,eps in enumerate([.1,.01,.001,.0001,.00001]):
   fd=((x.detach().numpy()+eps)**3-(x.detach().numpy()-eps)**3)/(2*eps)
   emit('metric','gradient_error',step=j,value=float(np.max(np.abs(fd-x.grad.numpy()))))
  emit('check','framework-gradcheck',passed=bool(torch.autograd.gradcheck(lambda z:z**3,(x,),eps=1e-6,atol=1e-5)));emit('tensor','autograd',data=[x.grad.tolist()]);emit('check','finite-difference',passed=bool(np.allclose(fd,x.grad.numpy(),atol=1e-6)))
 elif key=='softmax':
  z=np.array([[1000.,1001,1002],[-1000,-1000,-999]])
  with np.errstate(over='ignore',invalid='ignore'):naive=np.exp(z)/np.exp(z).sum(-1,keepdims=True)
  stable=soft(z);emit('metric','naive_nonfinite',step=0,value=float((~np.isfinite(naive)).sum()));emit('tensor','stable_probabilities',data=stable.tolist());emit('check','normalization',passed=bool(np.allclose(stable.sum(-1),1)))
 elif key in ('attention','causal'):
  q=rng.normal(size=(1,4,8)); k=rng.normal(size=q.shape);v=rng.normal(size=q.shape);scores=q@k.swapaxes(-1,-2)
  emit('tensor','unscaled_weights',data=soft(scores)[0].tolist());emit('tensor','scaled_weights',data=soft(scores/math.sqrt(8))[0].tolist())
  before=attention(q,k,v,key=='causal');k[:,-1]+=10;v[:,-1]-=20;after=attention(q,k,v,key=='causal')
  emit('tensor','output_change',data=np.abs(before-after)[0].tolist());emit('metric','protected_change',step=0,value=float(np.max(np.abs(before[:,:-1]-after[:,:-1]))));emit('check','future-invariance' if key=='causal' else 'finite-output',passed=bool(np.allclose(before[:,:-1],after[:,:-1])) if key=='causal' else bool(np.isfinite(after).all()))
 elif key=='mlp':
  x=torch.linspace(-2,2,80).reshape(-1,1);y=x.square();train=torch.arange(80)%4!=0
  for rate in [lr,lr*.1]:
   torch.manual_seed(seed);m=torch.nn.Sequential(torch.nn.Linear(1,16),torch.nn.Tanh(),torch.nn.Linear(16,1));optim=torch.optim.SGD(m.parameters(),lr=rate);initial=torch.cat([p.detach().flatten() for p in m.parameters()]).clone()
   for step in range(steps):
    optim.zero_grad();loss=(m(x[train])-y[train]).square().mean();loss.backward();grad=sum(float(p.grad.square().sum()) for p in m.parameters());optim.step()
    if step%max(1,steps//30)==0 or step==steps-1:
     emit('metric',f'train_lr={rate}',step=step,value=float(loss.detach()));emit('metric',f'valid_lr={rate}',step=step,value=float((m(x[~train])-y[~train]).square().mean().detach()))
   delta=float((torch.cat([p.detach().flatten() for p in m.parameters()])-initial).norm());emit('metric',f'parameter_delta_lr={rate}',step=steps,value=delta);emit('check',f'updates_lr={rate}',passed=math.isfinite(grad) and grad>0 and delta>0)
 elif key=='lm':
  # Original synthetic grammar. Split independent passages before constructing windows.
  train='sun warms stone. moon lights lake. '*30;valid='moon lights stone. sun warms lake. '*8
  chars=sorted(set(train+valid));lookup={c:i for i,c in enumerate(chars)};ctx=12
  def data(s):
   t=torch.tensor([lookup[c] for c in s]);return torch.stack([t[i:i+ctx] for i in range(len(t)-ctx)]),torch.stack([t[i+1:i+ctx+1] for i in range(len(t)-ctx)])
  tx,ty=data(train);vx,vy=data(valid)
  class LM(torch.nn.Module):
   def __init__(self):
    super().__init__();self.emb=torch.nn.Embedding(len(chars),16);self.pos=torch.nn.Embedding(ctx,16);self.ln1=torch.nn.LayerNorm(16);self.attn=torch.nn.MultiheadAttention(16,2,batch_first=True,dropout=0);self.ln2=torch.nn.LayerNorm(16);self.ff=torch.nn.Sequential(torch.nn.Linear(16,32),torch.nn.ReLU(),torch.nn.Linear(32,16));self.out=torch.nn.Linear(16,len(chars))
   def forward(self,x):
    z=self.emb(x)+self.pos(torch.arange(x.shape[1]));n=self.ln1(z);blocked=torch.triu(torch.ones(x.shape[1],x.shape[1],dtype=torch.bool),1);z=z+self.attn(n,n,n,attn_mask=blocked,need_weights=False)[0];z=z+self.ff(self.ln2(z));return self.out(z)
  m=LM();optim=torch.optim.AdamW(m.parameters(),lr=lr);initial=torch.cat([p.detach().flatten() for p in m.parameters()]).clone()
  for step in range(steps):
   ix=torch.randint(len(tx),(16,));optim.zero_grad();loss=torch.nn.functional.cross_entropy(m(tx[ix]).reshape(-1,len(chars)),ty[ix].reshape(-1));loss.backward();grad=sum(float(p.grad.square().sum()) for p in m.parameters());optim.step()
   if step%max(1,steps//30)==0 or step==steps-1:
    with torch.no_grad():vl=torch.nn.functional.cross_entropy(m(vx[:32]).reshape(-1,len(chars)),vy[:32].reshape(-1))
    emit('metric','train_loss',step=step,value=float(loss.detach()));emit('metric','validation_loss',step=step,value=float(vl))
  delta=float((torch.cat([p.detach().flatten() for p in m.parameters()])-initial).norm());emit('metric','gradient_norm_squared',step=steps,value=grad);emit('metric','parameter_delta',step=steps,value=delta)
  tokens=[lookup['s']]
  with torch.no_grad():
   for _ in range(80):
    probs=m(torch.tensor([tokens[-ctx:]]))[0,-1].softmax(-1);tokens.append(int(torch.multinomial(probs,1)))
  emit('check','training-integrity',passed=grad>0 and math.isfinite(grad) and delta>0,detail='sample: '+''.join(chars[t] for t in tokens));emit('check','target-shift',passed=bool(torch.equal(tx[:,1:],ty[:,:-1])))
 else:raise ValueError('unknown experiment')
try:
 if key.startswith('code'):code_cases()
 else:experiment()
 print(json.dumps({'controller_complete':True}),flush=True)
except Exception:
 traceback.print_exc();sys.exit(1)
