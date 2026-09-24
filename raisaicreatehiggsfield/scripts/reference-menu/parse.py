import re
from html.parser import HTMLParser
VOID={'img','br','source','input','path','circle','rect','line','polygon','use','stop','meta','link','ellipse','polyline','hr','wbr','track','area','col','embed','param'}
class Node:
    def __init__(s,tag,attrs): s.tag=tag; s.attrs=attrs; s.kids=[]; s.text=''; s.parent=None
    def all(s):
        for k in s.kids: yield k; yield from k.all()
    def txt(s): return re.sub(r'\s+',' ',' '.join([s.text]+[k.txt() for k in s.kids])).strip()
    def anc_cls(s):
        out=[];n=s
        while n is not None: out.append(n.attrs.get('class','')); n=n.parent
        return ' '.join(out)
class B(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.root=Node('root',{}); s.stack=[s.root]
    def handle_starttag(s,t,a):
        n=Node(t,dict(a)); n.parent=s.stack[-1]; s.stack[-1].kids.append(n)
        if t not in VOID: s.stack.append(n)
    def handle_startendtag(s,t,a): s.handle_starttag(t,a)
    def handle_endtag(s,t):
        if t in VOID: return
        for i in range(len(s.stack)-1,0,-1):
            if s.stack[i].tag==t: del s.stack[i:]; break
    def handle_data(s,d):
        d=re.sub(r'\s+',' ',d).strip()
        if d and s.stack[-1].tag not in('script','style'): s.stack[-1].text+=d+' '
def parse(path):
    p=B(); p.feed(open(path).read()); return p.root
def docorder(n):
    out=[]
    def w(x):
        out.append(x)
        for k in x.kids: w(k)
    w(n); return out
