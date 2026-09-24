from parse import parse, docorder
import re, json

def txts(n, tags):
    return [k.txt() for k in docorder(n) if k.tag in tags and k.txt()]

# ---------------- Enterprise ----------------
r = parse('enterprise.html'); ns = docorder(r)
ent = {}
ent['faq'] = []
for n in ns:
    if n.tag == 'details' and 'faq-item' in n.attrs.get('class', ''):
        q = ''
        for k in docorder(n):
            if k.tag == 'summary': q = k.txt(); break
        full = n.txt()
        a = full[len(q):].strip()
        ent['faq'].append({'q': q, 'a': a})
# testimonial cards: h3 + p pairs with logos
ent['clients'] = []
for n in ns:
    if n.tag == 'h3' and n.parent:
        sib = n.parent
        ps = [k.txt() for k in docorder(sib) if k.tag == 'p' and k.txt()]
        if ps and ps[0].startswith(('“', '"')):
            logos = [k.attrs.get('src', '') for k in docorder(sib) if k.tag == 'img']
            ent['clients'].append({'title': n.txt(), 'quote': ps[0], 'logos': logos[:2]})
# feature sections: h2 with following span description, within the tabbed area
FEATS = ['50+ Models', 'Marketing Studio', 'Cinema Studio', 'MCP & CLI', 'Agentic Engine', 'Canvas', 'Character Studio']
ent['features'] = []
for n in ns:
    if n.tag == 'h2' and n.txt() in FEATS:
        blk = n.parent
        desc = ''
        for k in docorder(blk):
            if k.tag == 'span' and k.txt() and k.txt() != n.txt():
                desc = k.txt(); break
        imgs = [k.attrs.get('src', '') for k in docorder(blk) if k.tag == 'img']
        vids = [k.attrs.get('src', '') for k in docorder(blk) if k.tag in ('video', 'source')]
        if not any(f['title'] == n.txt() for f in ent['features']):
            ent['features'].append({'title': n.txt(), 'desc': desc, 'imgs': imgs[:4], 'vids': vids[:2]})
# workspace cards
ent['workspace'] = []
for n in ns:
    if n.tag == 'h3' and n.txt() in ('Work as one team', 'Exclusive features', 'Pro control over workflow'):
        lis = [k.txt() for k in docorder(n.parent) if k.tag == 'li' and k.txt()]
        ent['workspace'].append({'title': n.txt(), 'items': lis})
ent['imgs'] = [n.attrs.get('src', '') for n in ns if n.tag == 'img' and n.attrs.get('src')]
ent['vids'] = [n.attrs.get('src', '') for n in ns if n.tag in ('video', 'source') and n.attrs.get('src')]
json.dump(ent, open('enterprise.json', 'w'), indent=1)
print('enterprise', {k: len(v) for k, v in ent.items()})

# ---------------- Marketing Studio ----------------
r = parse('marketing-studio.html'); ns = docorder(r)
ms = {}
ms['tabs'] = []
for n in ns:
    if n.tag == 'button' and n.txt() in ('All', 'Product shot', 'Motion', 'UGC', 'Ads', 'Posters', 'Marketplace'):
        if n.txt() not in ms['tabs']: ms['tabs'].append(n.txt())
ms['rail'] = [n.txt() for n in ns if n.tag in ('a', 'button') and n.txt() in
              ('Home', 'My generations', 'My favorites', 'Ad Reference', 'Product Link', 'New project')]
ms['modes'] = [n.txt() for n in ns if n.tag == 'button' and n.txt() in ('Image', 'Video')]
ms['imgs'] = [n.attrs.get('src', '') for n in ns if n.tag == 'img' and n.attrs.get('src')]
ms['vids'] = [n.attrs.get('src', '') for n in ns if n.tag in ('video', 'source') and n.attrs.get('src')]
json.dump(ms, open('marketing.json', 'w'), indent=1)
print('marketing', {k: len(v) for k, v in ms.items()})

# ---------------- Supercomputer ----------------
r = parse('supercomputer.html'); ns = docorder(r)
sc = {}
sc['heading'] = ''
for n in ns:
    if n.tag in ('h1', 'h2') and 'SKILLS' in n.txt().upper():
        sc['heading'] = n.txt(); break
sc['tabs'] = []
for n in ns:
    if n.tag == 'button' and n.txt() in ('All', 'Marketing', 'Explainer videos', 'Apps', 'Games'):
        if n.txt() not in sc['tabs']: sc['tabs'].append(n.txt())
# skill cards: a title plus a "Skill"/"Feature" badge
sc['cards'] = []
for n in ns:
    t = n.txt()
    if n.tag in ('div', 'a', 'article') and (t.endswith(' Skill') or t.endswith(' Feature')) and 3 < len(t) < 60:
        kind = 'Feature' if t.endswith(' Feature') else 'Skill'
        title = t[: -len(kind)].strip()
        imgs = [k.attrs.get('src', '') for k in docorder(n) if k.tag == 'img']
        vids = [k.attrs.get('src', '') for k in docorder(n) if k.tag in ('video', 'source')]
        if title and not any(c['title'] == title for c in sc['cards']):
            sc['cards'].append({'title': title, 'kind': kind, 'img': (imgs or [''])[0], 'vid': (vids or [''])[0]})
sc['rail'] = [n.txt() for n in ns if n.tag in ('a', 'button', 'span') and n.txt() in
              ('New chat', 'Search', 'Projects', 'Products', 'Faceless channel', 'Apps', 'Games',
               'Customize', 'Skills', 'Connectors', 'Memory', 'Chats')]
sc['imgs'] = [n.attrs.get('src', '') for n in ns if n.tag == 'img' and n.attrs.get('src')]
sc['vids'] = [n.attrs.get('src', '') for n in ns if n.tag in ('video', 'source') and n.attrs.get('src')]
json.dump(sc, open('super.json', 'w'), indent=1)
print('super', {k: (len(v) if isinstance(v, list) else v) for k, v in sc.items()})
