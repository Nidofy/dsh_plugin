"""Deterministic art exports; Pillow + NumPy. Run from any directory.
The two painted sources were made with built-in image_gen. No runtime code is edited.
"""
from pathlib import Path
import argparse, hashlib, io, json, math, zipfile
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageCms, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT.parents[1]
OUT = PKG / 'assets/boot'
SRC = ROOT / 'source'
PRE = ROOT / 'previews'
W,H = 1080,1440
SIZE=(W,H)
ICC=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
S=1080/1086
def save(im,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    im.save(path, optimize=True, icc_profile=ICC)
def pngbytes(im):
    f=io.BytesIO(); im.save(f,format='PNG',optimize=True,icc_profile=ICC); return f.getvalue()
def jsonout(path,obj):
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def rgba(path): return Image.open(path).convert('RGBA').resize(SIZE,Image.Resampling.LANCZOS)
def blank(): return Image.new('RGBA',SIZE)
def poly(points,blur=0):
    im=Image.new('L',SIZE); ImageDraw.Draw(im).polygon([(round(x*S),round(y*S)) for x,y in points],fill=255)
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im
def mul(a,b): return Image.fromarray(((np.asarray(a,dtype=np.uint16)*np.asarray(b,dtype=np.uint16)+127)//255).astype('uint8'))
def inv(a): return Image.fromarray(255-np.asarray(a))
def apply(im,mask):
    r=im.copy(); r.putalpha(mul(r.getchannel('A'),mask)); a=np.array(r); a[a[:,:,3]==0,:3]=0; return Image.fromarray(a)
def band(y0,y1,feather=16):
    y=np.arange(H)[:,None]; a=np.minimum(np.clip((y-y0)/feather,0,1),np.clip((y1-y)/feather,0,1))
    return Image.fromarray(np.broadcast_to(np.uint8(a*255),(H,W)).copy())
def bez(p0,p1,p2,p3):
    return [tuple((1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k] for k in [0,1]) for t in np.linspace(0,1,81)]
# Traced against actual 1086x1448 master, not assumed prompt coordinates.
PORTAL=bez((306,526),(321,410),(417,335),(543,333))+bez((543,333),(667,335),(766,409),(783,526))+[(780,867),(307,867)]
FRAME=[(205,902),(195,825),(207,740),(200,649),(192,563),(202,483),(213,431),(232,382),(255,339),(294,291),(338,258),(374,227),(417,214),(430,187),(467,201),(496,185),(521,199),(555,183),(591,194),(620,185),(652,207),(682,203),(703,230),(733,233),(756,259),(793,284),(818,323),(844,360),(859,403),(880,432),(886,482),(885,527),(876,579),(880,642),(878,710),(870,782),(874,850),(846,911),(795,921),(290,922)]
FGL=[(0,1135),(17,1142),(26,1157),(14,1170),(17,1194),(36,1181),(45,1190),(42,1206),(73,1195),(83,1204),(70,1227),(94,1224),(99,1243),(143,1230),(157,1245),(145,1273),(172,1270),(179,1301),(203,1309),(209,1335),(234,1349),(237,1377),(280,1393),(301,1420),(317,1448),(0,1448)]
FGR=[(1086,1150),(1067,1157),(1049,1177),(1025,1186),(1036,1213),(1009,1205),(989,1225),(965,1235),(950,1260),(923,1255),(915,1287),(887,1291),(883,1324),(854,1325),(848,1355),(819,1383),(803,1405),(768,1424),(753,1448),(1086,1448)]
CORE=['bg-far','bg-mid','path','gate-frame','gate-left','gate-right','fg-left','fg-right']
FX=['portal-mask','glow','ambient']
KINDS=['far','mid','near','frame','left','right','near','near']
PARALLAX=[.12,.35,.5,0,0,0,1.15,1.15]
HINGES={'gate-left':[306*S,615*S],'gate-right':[783*S,615*S]}
def make_layers():
    master=rgba(SRC/'master-closed-original.png'); clean=rgba(SRC/'environment-clean-original.png')
    hole=poly(PORTAL); outside=inv(hole)
    frame=poly(FRAME,1.8); fl=poly(FGL,1.3); fr=poly(FGR,1.3)
    # A full clean plate is hidden beneath the semantic masks and supplies edge bleed.
    layers={'bg-far':apply(clean,outside)}
    middle=mul(band(175,960,30),inv(frame.filter(ImageFilter.MinFilter(3))))
    layers['bg-mid']=apply(master,mul(middle,outside))
    path=band(885,1500,32)
    ground=Image.composite(clean,master,Image.fromarray(np.maximum(np.asarray(fl),np.asarray(fr))))
    layers['path']=apply(ground,mul(path,outside))
    layers['gate-frame']=apply(master,mul(frame,outside))
    # Leaves underlap the stone edge by one output pixel, preventing antialias cracks.
    leafhole=hole.filter(ImageFilter.MaxFilter(3))
    split=round(543*S)
    lm=Image.new('L',SIZE); ImageDraw.Draw(lm).rectangle((0,0,split-1,H),fill=255)
    layers['gate-left']=apply(master,mul(leafhole,lm))
    layers['gate-right']=apply(master,mul(leafhole,inv(lm)))
    layers['fg-left']=apply(master,fl); layers['fg-right']=apply(master,fr)
    mask=Image.new('RGBA',SIZE,(255,255,255,0));mask.putalpha(hole);layers['portal-mask']=mask
    yy,xx=np.mgrid[:H,:W]
    g=np.exp(-((xx-540)/220)**2-((yy-610)/320)**2)*52
    glow=Image.new('RGBA',SIZE,(255,226,161,0));glow.putalpha(mul(Image.fromarray(g.astype('uint8')),hole)); layers['glow']=glow
    ambient=blank(); d=ImageDraw.Draw(ambient)
    for x,y,r in [(142,440,2),(932,470,2),(217,590,1),(884,687,2),(398,275,1),(717,280,2),(124,930,2),(925,958,1)]: d.ellipse((x-r,y-r,x+r,y+r),fill=(255,235,182,92))
    layers['ambient']=apply(ambient.filter(ImageFilter.GaussianBlur(1.4)),outside)
    for k,v in layers.items(): save(v,OUT/f'entrance-{k}.png')
    masks={'portal':PORTAL,'frame':FRAME,'foregroundLeft':FGL,'foregroundRight':FGR}
    jsonout(SRC/'traced-geometry.json',{'sourceCanvas':[1086,1448],'exportCanvas':SIZE,'points':masks,'hinges':HINGES,'note':'Coordinates manually traced from finished source; masks are editable production selections.'})
    svg='<svg xmlns="http://www.w3.org/2000/svg" width="1086" height="1448" viewBox="0 0 1086 1448">'
    svg+='<image href="master-closed-original.png" width="1086" height="1448"/>'
    for name,pts in masks.items():svg+=f'<polygon id="{name}" points="'+ ' '.join(f'{x:.2f},{y:.2f}' for x,y in pts)+'" fill="none" stroke="#ff40a0" stroke-width="2"/>'
    (SRC/'editable-selections.svg').write_text(svg+'</svg>',encoding='utf-8')
    return layers
def compose(layers,amount=0,under=None,parallax=0):
    env=blank()
    for k,f in zip(CORE,PARALLAX):
        if k in HINGES:continue
        im=layers[k]
        if parallax and f: im=im.transform(SIZE,Image.Transform.AFFINE,(1,0,-parallax*f,0,1,0),resample=Image.Resampling.BICUBIC)
        env.alpha_composite(im)
    env=apply(env,inv(layers['portal-mask'].getchannel('A')))
    result=blank() if under is None else under.copy()
    result.alpha_composite(env)
    for k in HINGES:
        im=layers[k] if not amount else warpdoor(layers[k],k,amount)
        result.alpha_composite(im)
    # Jamb is above leaf edge, matching physical inward-opening construction.
    result.alpha_composite(layers['gate-frame'])
    return result
def warpdoor(im,kind,amount):
    box=im.getbbox()
    if box is None:return im.copy()
    x0,y0,x1,y1=box
    theta=math.radians(82*amount*(1 if kind=='gate-left' else -1)); hinge=HINGES[kind][0]
    def project(x,y):
        dx=x-hinge;z=-dx*math.sin(theta);q=2100/(2100-z)
        return (540+(hinge+dx*math.cos(theta)-540)*q,720+(y-720)*q)
    source=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]; target=[project(x,y) for x,y in source]
    a=[];b=[]
    for (u,v),(x,y) in zip(source,target):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]); b.extend([u,v])
    coeff=np.linalg.solve(np.array(a),np.array(b))
    return im.transform(SIZE,Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
def checker(size=SIZE):
    yy,xx=np.indices((size[1],size[0])); a=((xx//24+yy//24)%2)*35+185
    return Image.fromarray(np.dstack([a,a,a,np.full_like(a,255)]).astype('uint8'))
def camera(im,width,height,zoom=1,focus=(540,720)):
    s=height/H*zoom; ox=width/2-focus[0]*s; oy=height/2-focus[1]*s
    return im.transform((width,height),Image.Transform.AFFINE,(1/s,0,-ox/s,0,1/s,-oy/s),Image.Resampling.BICUBIC)
def window(layers,width,height,amount=0,zoom=1,focus=(540,720),under='scene',dark=False,ui=True):
    clean=rgba(SRC/'environment-clean-original.png')
    # Height-constrained stage; wide sides use a blurred environment plate, never stretched gates.
    cover=max(width/W,height/H); plate=clean.resize((round(W*cover),round(H*cover)),Image.Resampling.LANCZOS)
    x=(plate.width-width)//2;y=(plate.height-height)//2
    plate=plate.crop((x,y,x+width,y+height)).filter(ImageFilter.GaussianBlur(16))
    hole=camera(layers['portal-mask'],width,height,zoom,focus).getchannel('A')
    plate=apply(plate,inv(hole))
    # Feather only display edges into the side atmosphere; production layers stay untrimmed.
    edge=np.minimum(np.clip(np.arange(W)/64,0,1),np.clip((W-1-np.arange(W))/64,0,1))
    edgeMask=Image.fromarray(np.broadcast_to(np.uint8(edge*255),(H,W)).copy())
    stage=camera(apply(compose(layers,amount),edgeMask),width,height,zoom,focus)
    exterior=plate;exterior.alpha_composite(stage)
    bg=checker((width,height)) if under=='checker' else camera(rgba(PKG/'assets/scenes/courtyard/background.png'),width,height)
    # Background sample is a still from existing assets, NOT a live world/functionality test.
    bg.alpha_composite(exterior)
    if ui:
        d=ImageDraw.Draw(bg);pw=32 if width<580 else 36;ph=40 if width<580 else 44;gap=8 if width<580 else 10
        sy=round(height*.88)-ph-40; sx=(width-(pw*7+gap*6))//2
        color=(35,43,38,195) if dark else (250,244,228,195)
        strip=Image.new('RGBA',(width,100));ImageDraw.Draw(strip).rounded_rectangle((6,0,width-6,95),18,fill=color);bg.alpha_composite(strip,(0,sy-12))
        ids=['bluewhale','claude','gemini','gpt','grok','kimi','qwen']
        for i,name in enumerate(ids):
            p=Image.open(PKG/f'assets/portraits/{name}.png').convert('RGBA');p.thumbnail((pw,ph),Image.Resampling.LANCZOS);bg.alpha_composite(p,(sx+i*(pw+gap)+(pw-p.width)//2,sy))
        d=ImageDraw.Draw(bg); txt='Preview only - sample loading state';f=font(12);d.text((width/2,sy+ph+12),txt,font=f,anchor='mt',fill='#efe8d6' if dark else '#554c3c')
    return bg
def font(size):
    for p in ['C:/Windows/Fonts/segoeui.ttf','C:/Windows/Fonts/arial.ttf']:
        if Path(p).exists():return ImageFont.truetype(p,size)
    return ImageFont.load_default()
def previews(layers):
    PRE.mkdir(parents=True,exist_ok=True)
    for w,h in [(340,720),(580,720),(1080,760)]:
        save(window(layers,w,h),PRE/f'window-{w}x{h}-light.png')
        save(window(layers,w,h,dark=True),PRE/f'window-{w}x{h}-dark.png')
    for a,label in [(0,'closed'),(.4,'open-40'),(1,'open-100')]:
        save(compose(layers,a),PRE/f'door-{label}-transparent.png')
        save(window(layers,580,720,a,under='checker'),PRE/f'door-{label}-checker.png')
        save(window(layers,580,720,a,ui=False),PRE/f'door-{label}-courtyard-sample.png')
    steps=[('01-far',1,(540,720),0),('02-approach',1.12,(540,675),0),('03-near',1.45,(540,650),.4),('04-before-cross',6.2,(540,685),1)]
    for label,z,f,a in steps:save(window(layers,580,720,a,z,f,ui=False),PRE/f'camera-{label}.png')
    aligned=compose(layers);d=ImageDraw.Draw(aligned)
    d.line([(x*S,y*S) for x,y in PORTAL]+[(PORTAL[0][0]*S,PORTAL[0][1]*S)],fill='#00e5ff',width=3)
    for k,(x,y) in HINGES.items():d.line((x,320,x,880),fill='#ff4080',width=3);d.ellipse((x-8,y-8,x+8,y+8),fill='#ff4080')
    d.rectangle((380,550,705,825),outline='#00ff70',width=3)
    save(aligned,PRE/'hinges-and-safe-aperture.png')
    save(layers['portal-mask'],PRE/'portal-alpha.png')
    save(compose(layers),PRE/'layer-composite.png')
    save(compose(layers,1,checker(),parallax=5),PRE/'parallax-max-open-check.png')
    cards=[('340 x 720', 'window-340x720-light.png'),('580 x 720','window-580x720-light.png'),('1080 x 760','window-1080x760-light.png'),('Closed','door-closed-courtyard-sample.png'),('40% / 32.8 degrees','door-open-40-courtyard-sample.png'),('100% / 82 degrees','door-open-100-checker.png'),('Far','camera-01-far.png'),('Approach','camera-02-approach.png'),('Near','camera-03-near.png'),('Before crossing','camera-04-before-cross.png'),('Hinges + safe rect','hinges-and-safe-aperture.png'),('Dark host + 7 portraits','window-580x720-dark.png')]
    sheet=Image.new('RGB',(1440,1580),'#ede9df');d=ImageDraw.Draw(sheet);d.text((28,20),'AI VILLAGE / DREAM GARDEN ENTRANCE',font=font(30),fill='#334636');d.text((28,62),'ART_REVIEW | original painted layers | static asset QA, not runtime verification',font=font(18),fill='#656452')
    for i,(title,file) in enumerate(cards):
        x=(i%4)*360;y=100+(i//4)*490
        im=Image.open(PRE/file).convert('RGBA');im.thumbnail((344,444),Image.Resampling.LANCZOS)
        sheet.paste(im,(x+(360-im.width)//2,y),im)
        d.text((x+12,y+452),title,font=font(17),fill='#334636')
    save(sheet,PRE/'contact-sheet.png')
    sheet=Image.new('RGB',(1440,1580),'#ede9df');d=ImageDraw.Draw(sheet);d.text((25,20),'LAYER ATLAS / 1080 x 1440 / RGBA',font=font(28),fill='#334636')
    for i,k in enumerate(CORE+FX):
        x=(i%4)*360;y=80+(i//4)*490
        tile=checker();tile.alpha_composite(layers[k]);tile.thumbnail((330,440),Image.Resampling.LANCZOS)
        sheet.paste(tile.convert('RGB'),(x+15,y));d.text((x+15,y+448),k,font=font(17),fill='#334636')
    save(sheet,PRE/'layer-atlas.png')
def metadata(layers):
    items=[]
    for i,k in enumerate(CORE+FX):
        im=layers[k];box=im.getbbox();file=f'entrance-{k}.png'
        items.append({'id':k,'file':file,'z':{'gate-frame':60,'fg-left':70,'fg-right':80}.get(k,i*10),'kind':KINDS[i] if i<8 else 'mask' if k=='portal-mask' else 'effect','parallax':PARALLAX[i] if i<8 else 0,'canvasRect':[0,0,W,H],'contentBoundsPx':list(box),'opacity':1,'optional':i>=8,'alphaConstraint':'Zero inside portal; apply a shared final portal knockout after parallax' if k not in ['gate-left','gate-right','glow','portal-mask'] else 'Leaf overlaps stone by 1 px' if k in HINGES else 'Alpha is coverage; RGB is white for mask','sha256':hashlib.sha256((OUT/file).read_bytes()).hexdigest(),'bytes':(OUT/file).stat().st_size})
    manifest={'schemaVersion':1,'id':'dream-garden-entrance-v1','status':'ART_REVIEW','canvas':{'logical':[360,480],'pixels':SIZE,'pixelRatio':3,'colorSpace':'sRGB','alpha':'straight/unassociated RGBA'},'source':{'master':'../../art/entrance-v1/source/master-closed-original.png','cleanPlate':'../../art/entrance-v1/source/environment-clean-original.png','method':'built-in image_gen; clean plate edited from same master; deterministic masks and pixel extraction','originalPixels':[1086,1448]},'layers':items,'doors':{'closedBoundsPx':{k:list(layers[k].getbbox()) for k in HINGES},'hingesPx':HINGES,'hingesLogical':{k:[v/3 for v in p] for k,p in HINGES.items()},'transformOriginFullCanvas':{k:[p[0]/W,p[1]/H] for k,p in HINGES.items()},'yawDegrees':{'left':[0,82],'right':[0,-82]},'convention':'CSS rotateY with perspective origin at canvas center; positive left yaw goes inward (negative Z)','perspectivePxAt3x':2100,'progressToAngle':'linear: angle=82*progress; temporal easing is host-owned','centerSeamPx':round(543*S),'fullOpenPolicy':'82 degrees leaves edge slivers; safe rectangle is fully clear. Hide leaves only after camera exits exterior.'},'portal':{'mask':'entrance-portal-mask.png','channel':'alpha; 255 reveals live world; RGB white; do not invert','polygonPx':[[round(x*S,3),round(y*S,3)] for x,y in PORTAL],'boundsPx':list(layers['portal-mask'].getbbox()),'safeRectPx':[380,550,325,275],'sharedKnockoutRequired':True},'camera':{'layout':'stage height=viewport height, width=height*0.75; center stage; never stretch; wide side atmosphere uses clean plate','baseScale':'viewportHeight/1440','focusPx':[540,720],'keyframes':[{'name':n,'scale':z,'focusPx':f} for n,z,f in [('far',1,[540,720]),('approach',1.12,[540,675]),('near',1.45,[540,650])]],'crossScale':'1.06*max(viewportWidth/(325*baseScale),viewportHeight/(275*baseScale))','crossFocusPx':[542.5,687.5],'parallaxMaxDriverPx':5,'maxDisplacementLogical':1.92,'edgePolicy':'keep clean bleed behind moving layers; reapply stationary portal knockout; during cross fade side atmosphere too','uiReservedLogicalY':[365,480],'validatedWindows':[[340,720],[580,720],[1080,760]]},'reveal':{'liveWorld':'Underlying running game surface, unchanged and never rendered into art exports','effectsDefaultEnabled':False,'staticPreviewDisclosure':'Courtyard sample previews show an existing background image, not a live scene or actual readiness.'},'review':{'technical':'See validation.json','humanSignoff':'Pending; do not change to APPROVED automatically','knownLimits':['2.5D front surfaces, no modeled door thickness or back faces','Foreground selections retain painterly edge softness; parallax deliberately limited','Current host needs curved portal knockout, inward yaw signs, height-based layout and resource path mapping']}}
    jsonout(OUT/'entrance-art-manifest.json',manifest)
    # 2x cropped compatibility edition fits existing eight-layer/4MiB/8M-pixel limits.
    compat=OUT/'compat/entrance';compat.mkdir(parents=True,exist_ok=True);entries=[];cl=[]
    for i,k in enumerate(CORE):
        im=layers[k].resize((720,960),Image.Resampling.LANCZOS);box=im.getbbox();im=im.crop(box)
        file=f'entrance-{k}.png';save(im,compat/file);x,y,r,b=box
        layer={'key':'entrance/'+file,'kind':KINDS[i],'rect':{'x':x/720,'y':y/960,'width':(r-x)/720,'height':(b-y)/960}}
        if k in HINGES:layer['pivot']=[(HINGES[k][0]*2/3-x)/(r-x),(HINGES[k][1]*2/3-y)/(b-y)]
        cl.append(layer);entries.append({'key':'entrance/'+file,'file':'entrance/'+file,'sha256':hashlib.sha256((compat/file).read_bytes()).hexdigest(),'bytes':(compat/file).stat().st_size,'width':im.width,'height':im.height})
    box=layers['portal-mask'].getbbox();x,y,r,b=box
    jsonout(compat/'manifest.json',{'status':'ART_REVIEW','source':'Original dream-garden master; pending human approval. Rect aperture is bounding box ONLY: use supplied curved alpha mask for actual reveal.','designSize':{'width':W,'height':H},'aperture':{'x':x/W,'y':y/H,'width':(r-x)/W,'height':(b-y)/H},'safeApertureRect':{'x':380/W,'y':550/H,'width':325/W,'height':275/H},'layers':cl,'files':entries})
    return manifest
def openraster(layers):
    doc=ET.Element('image',{'w':str(W),'h':str(H),'name':'AI Village Entrance V1 — editable layers','version':'0.0.3'});stack=ET.SubElement(doc,'stack')
    with zipfile.ZipFile(SRC/'entrance-layered.ora','w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
        for k in reversed(['bg-far','bg-mid','path','gate-left','gate-right','gate-frame','fg-left','fg-right','glow','ambient','portal-mask']):
            name=f'data/{k}.png';z.writestr(name,pngbytes(layers[k]));ET.SubElement(stack,'layer',{'name':k,'src':name,'x':'0','y':'0','opacity':'1.0','visibility':'hidden' if k in FX else 'visible','composite-op':'svg:src-over'})
        z.writestr('stack.xml',ET.tostring(doc,encoding='utf-8'));z.writestr('mergedimage.png',pngbytes(compose(layers)))
def validate(layers):
    checks=[]
    def ck(name,value,details=None):
        checks.append({'check':name,'passed':bool(value),'details':details})
    hole=np.array(layers['portal-mask'].getchannel('A'))==255
    manifest=json.loads((OUT/'entrance-art-manifest.json').read_text(encoding='utf-8'))
    ck('Exactly eleven required named assets',len(manifest['layers'])==11 and {x['id'] for x in manifest['layers']}==set(CORE+FX))
    for entry in manifest['layers']:
        path=OUT/entry['file']
        ck('Primary integrity '+entry['id'],path.parent==OUT and path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'] and path.stat().st_size==entry['bytes'])
    for k in CORE+FX:
        path=OUT/f'entrance-{k}.png';im=Image.open(path)
        ck(k+' dimensions / RGBA / sRGB',im.size==SIZE and im.mode=='RGBA' and bool(im.info.get('icc_profile')))
        if k not in ['gate-left','gate-right','glow','portal-mask']:ck(k+' portal clear',not np.any(np.array(im.getchannel('A'))[hole]))
    closed=np.array(compose(layers).getchannel('A'));ck('Closed aperture fully covered',np.all(closed[hole]==255))
    opened=compose(layers,1);alpha=np.array(opened.getchannel('A'))
    ck('82 degree safe reveal rectangle fully transparent',not np.any(alpha[550:825,380:705]))
    env=compose({**layers,'gate-left':blank(),'gate-right':blank()},1);ck('No painted door remains when leaves hidden',not np.any(np.array(env.getchannel('A'))[hole]))
    sweep=[]
    for progress in [0,.1,.25,.4,.5,.75,1]:
        left=layers['gate-left'] if progress==0 else warpdoor(layers['gate-left'],'gate-left',progress)
        right=layers['gate-right'] if progress==0 else warpdoor(layers['gate-right'],'gate-right',progress)
        overlap=np.count_nonzero((np.array(left.getchannel('A'))>127)&(np.array(right.getchannel('A'))>127));sweep.append({'progress':progress,'overlapPixels':int(overlap)})
    ck('Door sweep has no left/right collision',all(x['overlapPixels']==0 for x in sweep),sweep)
    for w,h in [(340,720),(580,720),(1080,760)]:
        scale=h/H;frame=layers['gate-frame'].getbbox();threshold=922*S*scale
        ck(f'{w}x{h} structural gate and threshold clear of loading UI',threshold<h*.72 and ((306*S-W/2)*scale+w/2)>0 and ((783*S-W/2)*scale+w/2)<w)
    total=sum((OUT/f'entrance-{k}.png').stat().st_size for k in CORE+FX)
    ck('Primary eleven PNGs <= 12 MiB',total<=12*1024**2,{'bytes':total})
    comp=json.loads((OUT/'compat/entrance/manifest.json').read_text());cb=sum(f['bytes'] for f in comp['files']);cp=sum(f['width']*f['height'] for f in comp['files'])
    ck('Compatibility PNGs <= 4 MiB and <= 8M pixels',cb<=4*1024**2 and cp<=8000000,{'bytes':cb,'pixels':cp,'layers':len(comp['layers'])})
    for f in comp['files']:ck('Compatibility hash '+f['key'],hashlib.sha256((OUT/'compat'/f['file']).read_bytes()).hexdigest()==f['sha256'])
    report={'status':'PASS' if all(c['passed'] for c in checks) else 'FAIL','scope':'Offline asset geometry and alpha; not game runtime, GPU performance, or human art approval','primaryPngBytes':total,'compatPngBytes':cb,'checks':checks}
    jsonout(OUT/'validation.json',report)
    print(json.dumps({'status':report['status'],'checks':len(checks),'failed':[c for c in checks if not c['passed']],'primaryMiB':round(total/1024**2,3),'compatMiB':round(cb/1024**2,3)},ensure_ascii=False))
    if report['status']!='PASS':raise SystemExit(1)
def hashes():
    files=sorted(p for p in list(OUT.rglob('*'))+list(ROOT.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.txt' and '__pycache__' not in p.parts)
    (OUT/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(PKG).as_posix()+'\n' for p in files),encoding='utf-8')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--validate-only',action='store_true');args=parser.parse_args()
    if args.validate_only:layers={k:Image.open(OUT/f'entrance-{k}.png').convert('RGBA') for k in CORE+FX};validate(layers)
    else:
        layers=make_layers();manifest=metadata(layers);previews(layers);openraster(layers)
        template=(ROOT/'tools/preview-template.html').read_text(encoding='utf-8')
        (ROOT/'preview.html').write_text(template.replace('/*MANIFEST*/',json.dumps(manifest,ensure_ascii=False)),encoding='utf-8')
        validate(layers);hashes()
