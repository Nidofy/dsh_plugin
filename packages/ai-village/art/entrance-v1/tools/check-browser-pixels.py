"""Verify pixels behind the actual browser-rendered transparent portal."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
p=root/'previews/browser'
colors={'blue':(13,97,173),'pink':(219,43,111)}
rows=[]
for w,h in [(340,720),(580,720),(1080,760)]:
    for name,color in colors.items():
        im=Image.open(p/f'{w}x{h}-reveal-{name}.png').convert('RGB')
        # 5x5 sample grid in the measured safe aperture; no screenshot label/loading UI overlap.
        points=[]
        for x in [400,460,540,620,680]:
            for y in [570,620,680,740,800]:
                px=round(w/2+(x-540)*h/1440);py=round(y*h/1440)
                actual=im.getpixel((px,py));points.append({'xy':[px,py],'rgb':actual,'passed':actual==color})
        rows.append({'window':[w,h],'background':name,'passed':all(x['passed'] for x in points),'samples':points})
result={'status':'PASS' if all(x['passed'] for x in rows) else 'FAIL','scope':'150 RGB samples from six Chromium screenshots prove underlying color changes pass through the safe reveal aperture','results':rows}
(p/'pixel-validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(result['status'],len(rows)*25,'browser reveal pixels')
if result['status']!='PASS':raise SystemExit(1)
