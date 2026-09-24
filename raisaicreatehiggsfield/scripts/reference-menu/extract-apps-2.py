from parse import parse, docorder
import json

def leaf_texts(n):
    return [k.txt() for k in docorder(n) if k.txt() and not any(c.txt() for c in k.kids)]

def media_of(n):
    v = next((k.attrs.get('src','') for k in docorder(n) if k.tag in ('video','source') and k.attrs.get('src')), '')
    i = next((k.attrs.get('src','') for k in docorder(n) if k.tag=='img' and k.attrs.get('src')), '')
    p = next((k.attrs.get('poster','') for k in docorder(n) if k.tag=='video' and k.attrs.get('poster')), '')
    return v, (i or p)

def tiles(ns, need_cls, maxlen=46):
    """Tiles are the direct children of the grid container matching need_cls."""
    grids=[n for n in ns if need_cls in (n.attrs.get('class','') or '')]
    out=[]
    for g in grids:
        for n in g.kids:
            v,i = media_of(n)
            if not (v or i): continue
            ls=[x for x in leaf_texts(n) if 1 < len(x) < maxlen and 'browser does not support' not in x]
            title = ls[0] if ls else ''
            if not title or any(c['title']==title for c in out): continue
            out.append({'title':title,'vid':v,'img':i})
    return out

data=json.load(open('apps.json'))

r=parse('explainer.html'); ns=docorder(r)
data['explainer']['presets']=tiles(ns, 'grid grid-cols-1 md:grid-cols-2')[:24]
print('explainer presets', len(data['explainer']['presets']), [p['title'] for p in data['explainer']['presets'][:6]])

r=parse('moodboard.html'); ns=docorder(r)
data['moodboard']['presets']=tiles(ns, 'w-full grid grid-cols-1 sm:grid-cols-2')[:20]
print('moodboard presets', len(data['moodboard']['presets']), [p['title'] for p in data['moodboard']['presets'][:6]])

r=parse('faceless-studio.html'); ns=docorder(r)
data['faceless-studio']['presets']=tiles(ns, 'faceless-home-made-by-grid')[:20]
print('faceless presets', len(data['faceless-studio']['presets']), [p['title'] for p in data['faceless-studio']['presets'][:6]])

# headings/subs that the generic pass missed
for name, h, sub in [
  ('character','Make your own character','Upload photos from multiple angles to train your character. Then use the same consistent character across new images and videos.'),
  ('moodboard','Create your moodboard','Turn your references into a focused moodboard that defines style, tone, consistent details, and creative direction.'),
  ('mixed-media','Layer mixed media','Stack video, image and graphic layers into one composition.'),
]:
    data[name]['heading']=h; data[name]['sub']=sub
# character hero collage
r=parse('character.html'); ns=docorder(r)
data['character']['hero']=[k.attrs.get('src','') for k in ns if k.tag=='img' and k.attrs.get('src')][:4]
r=parse('moodboard.html'); ns=docorder(r)
data['moodboard']['hero']=[k.attrs.get('src','') for k in ns if k.tag=='img' and k.attrs.get('src')][:4]
json.dump(data, open('apps.json','w'), indent=1)
