from parse import parse, docorder
import json

def leaf_texts(n):
    return [k.txt() for k in docorder(n) if k.txt() and not any(c.txt() for c in k.kids)]

def media_of(n):
    v = next((k.attrs.get('src','') for k in docorder(n) if k.tag in ('video','source') and k.attrs.get('src')), '')
    i = next((k.attrs.get('src','') for k in docorder(n) if k.tag=='img' and k.attrs.get('src')), '')
    p = next((k.attrs.get('poster','') for k in docorder(n) if k.tag=='video' and k.attrs.get('poster')), '')
    return v, (i or p)

def presets(ns, tags=('article',)):
    out=[]
    for n in ns:
        if n.tag not in tags: continue
        v,i = media_of(n)
        if not (v or i): continue
        ls=[x for x in leaf_texts(n) if 2 < len(x) < 46]
        title = ls[-1] if ls else ''
        if not title or any(c['title']==title for c in out): continue
        out.append({'title':title,'vid':v,'img':i})
    return out

def rows(ns):
    """Config rows: a small label plus a value, side by side."""
    out=[]
    for n in ns:
        cls = n.attrs.get('class','')
        if 'rounded' not in cls: continue
        ls=[x for x in leaf_texts(n) if len(x)<28]
        if len(ls)==2 and ls[0] != ls[1] and not any(r['label']==ls[0] for r in out):
            out.append({'label':ls[0],'value':ls[1]})
    return out

STUDIO = {
 'lipsync-studio': {'tabs':['Lipsync Studio','UGC Factory']},
 'shorts-studio': {}, 'explainer': {}, 'mixed-media': {}, 'faceless-studio': {},
}
data={}
for name in STUDIO:
    r=parse(f'{name}.html'); ns=docorder(r)
    ps=presets(ns)
    if len(ps) < 3: ps=presets(ns, ('article','figure'))
    heading=''
    for n in ns:
        if n.tag in ('h1','h2') and n.txt() and len(n.txt())<80: heading=n.txt(); break
    gen=next((n.txt() for n in ns if n.tag=='button' and n.txt().startswith('Generate') and len(n.txt())<24), 'Generate')
    data[name]={'heading':heading,'rows':rows(ns)[:8],'presets':ps[:24],'generate':gen, **STUDIO[name]}
    print(name.ljust(16),'presets',len(ps),'rows',len(data[name]['rows']),'|',gen,'|',heading[:40])
    print('   rows:', [(r['label'],r['value']) for r in data[name]['rows']][:6])
    print('   pres:', [p['title'] for p in ps[:6]])

for name in ['character','moodboard']:
    r=parse(f'{name}.html'); ns=docorder(r)
    h=next((n.txt() for n in ns if n.tag in ('h1','h2') and n.txt() and len(n.txt())<70), '')
    sub=next((n.txt() for n in ns if n.tag=='p' and 40 < len(n.txt()) < 220), '')
    cta=next((n.txt() for n in ns if n.tag in ('button','a') and n.txt().lower().startswith(('create','build')) and len(n.txt())<30), '')
    hero=[k.attrs.get('src','') for k in ns if k.tag=='img' and k.attrs.get('src')][:6]
    ps=presets(ns, ('article','figure'))
    data[name]={'heading':h,'sub':sub,'cta':cta,'hero':hero,'presets':ps[:16]}
    print(name.ljust(16),'|',h[:36],'| cta',cta,'| hero',len(hero),'| presets',len(ps))
    print('   pres:', [p['title'] for p in ps[:6]])

for name in ['apps_face-swap','apps_relight']:
    r=parse(f'{name}.html'); ns=docorder(r)
    h=next((n.txt() for n in ns if n.tag in ('h1','h2') and n.txt() and len(n.txt())<70), '')
    sub=next((n.txt() for n in ns if n.tag=='p' and 20 < len(n.txt()) < 200), '')
    steps=[n.txt() for n in ns if n.tag in ('h2','h3') and 'STEP' in n.txt().upper()]
    imgs=[k.attrs.get('src','') for k in ns if k.tag=='img' and k.attrs.get('src')][:8]
    data[name]={'heading':h,'sub':sub,'steps':steps[:4],'imgs':imgs}
    print(name.ljust(16),'|',h[:40],'|',sub[:44],'| imgs',len(imgs))

json.dump(data, open('apps.json','w'), indent=1)
