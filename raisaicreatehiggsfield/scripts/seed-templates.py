import json, urllib.request, http.cookiejar
API="https://create.raishelmy.uk/api/v1"
cj=http.cookiejar.MozillaCookieJar(); cj.load("/tmp/rc.jar", ignore_discard=True, ignore_expires=True)
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
csrf=next(c.value for c in cj if c.name=="rais_csrf")
def call(method,path,body=None):
    req=urllib.request.Request(API+path,method=method,data=(json.dumps(body).encode() if body is not None else None),
        headers={"content-type":"application/json","x-csrf-token":csrf,"user-agent":"Mozilla/5.0 raisai-admin-script/1.0"})
    try:
        with op.open(req,timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def N(id,type,config=None,x=0,y=0): return {"id":id,"type":type,"version":1,"config":config or {},"position":{"x":x,"y":y}}
def E(a,ap,b,bp): return {"id":f"e-{a}-{ap}-{b}-{bp}","from":{"node":a,"port":ap},"to":{"node":b,"port":bp}}
def V(name,type,label,required=True,default=None,enum=None):
    v={"name":name,"type":type,"label":label,"required":required}
    if default is not None: v["default"]=default
    if enum: v["enum"]=enum
    return v
def doc(nodes,edges,variables,name): return {"version":1,"nodes":nodes,"edges":edges,"variables":variables,"settings":{"cache":False,"maxParallel":2},"meta":{"name":name}}
def studio(id,type,x=300,y=0): return N(id,type,{"modelId":"","parameters":{}},x,y)

T=[]
# 1 Product shot
T.append(dict(name="Product shot", category="ads", tags=["product","photo","e-commerce"],
  description="Turn a plain product photo into an editorial shot. Keeps the product, replaces the setting.",
  doc=doc([N("img","input.image",{"variable":"product_image"},0,0),
           N("p","prompt",{"template":"Professional product photograph of the exact product in the reference image, {{style}}. Keep the product unchanged; change only the surroundings and lighting."},0,120),
           studio("s","ai.image.edit"), N("out","output",{"name":"image"},600,0)],
          [E("img","image","s","images"),E("p","prompt","s","prompt"),E("s","image","out","value")],
          [V("product_image","image","Product photo"),V("style","string","Setting & style",False,"soft morning window light, wet slate surface, shallow depth of field, editorial")],"Product shot")))
# 2 Poster
T.append(dict(name="Poster", category="professional", tags=["poster","typography","design"],
  description="A bold poster from a headline, a subject and a style.",
  doc=doc([N("p","prompt",{"template":"Poster design. Headline text: \"{{headline}}\". Subject: {{subject}}. Style: {{style}}. Strong composition, legible type, print quality."},0,0),
           studio("s","ai.image"), N("out","output",{"name":"image"},600,0)],
          [E("p","prompt","s","prompt"),E("s","image","out","value")],
          [V("headline","string","Headline"),V("subject","string","Subject"),V("style","string","Style",False,"bold retro, halftone dots, high contrast, 1970s")],"Poster")))
# 3 Headshot
T.append(dict(name="Headshot", category="characters", tags=["portrait","headshot","profile"],
  description="A clean professional headshot from a description.",
  doc=doc([N("p","prompt",{"template":"Professional headshot portrait of {{description}}. {{setting}}. Sharp focus on the eyes, natural skin, head and shoulders, looking at camera."},0,0),
           studio("s","ai.image"), N("out","output",{"name":"image"},600,0)],
          [E("p","prompt","s","prompt"),E("s","image","out","value")],
          [V("description","string","Who (age, look, outfit)"),V("setting","string","Background & light",False,"neutral studio background, soft key light, 85mm lens")],"Headshot")))
# 4 Character sheet
T.append(dict(name="Character sheet", category="characters", tags=["character","turnaround","consistency"],
  description="Front, three-quarter and side views of one character on a neutral background — the reference for every later shot.",
  doc=doc([N("p","prompt",{"template":"Character turnaround sheet: front view, three-quarter view and side view of {{character}}, same face, same outfit and same proportions in every view, evenly spaced, {{style}}."},0,0),
           studio("s","ai.image"), N("out","output",{"name":"image"},600,0)],
          [E("p","prompt","s","prompt"),E("s","image","out","value")],
          [V("character","string","Character"),V("style","string","Style",False,"clean concept-art lineup, flat neutral grey background, soft even light")],"Character sheet")))
# 5 Reframe for Reels
T.append(dict(name="Reframe for Reels (9:16)", category="video", tags=["reframe","tiktok","reels","crop"],
  description="Crops any image to 9:16 for TikTok, Reels and Shorts, and re-encodes it as WebP. No model, no cost.",
  doc=doc([N("img","input.image",{"variable":"image"},0,0),
           N("t","image.transform",{"aspectRatio":"9:16","fit":"cover","gravity":"auto","format":"webp","quality":90,"rotate":0},300,0),
           N("out","output",{"name":"image"},600,0)],
          [E("img","image","t","image"),E("t","image","out","value")],
          [V("image","image","Image")],"Reframe for Reels")))
# 6 Subtitle a clip
T.append(dict(name="Subtitle a clip", category="video", tags=["subtitles","srt","transcribe"],
  description="Transcribes the audio with timings and returns an SRT subtitle file.",
  doc=doc([N("a","input.audio",{"variable":"audio"},0,0),
           studio("s","ai.transcribe"),
           N("sub","subtitles",{"format":"srt","wordsPerMinute":150},600,0),
           N("out","output",{"name":"subtitles"},900,0)],
          [E("a","audio","s","audio"),E("s","text","sub","text"),E("s","json","sub","transcript"),E("sub","subtitles","out","value")],
          [V("audio","audio","Audio (or a video's audio track)")],"Subtitle a clip")))
# 7 Describe my product
T.append(dict(name="Describe my product", category="ads", tags=["listing","description","vision"],
  description="A store-ready description written from a product photo.",
  doc=doc([N("img","input.image",{"variable":"image"},0,0),
           N("p","prompt",{"template":"{{question}}"},0,120),
           studio("s","ai.describe"), N("out","output",{"name":"text"},600,0)],
          [E("img","image","s","images"),E("p","prompt","s","prompt"),E("s","text","out","value")],
          [V("image","image","Product photo"),V("question","string","What to write",False,"Describe this product for an online store listing in two sentences: what it is, its material and colour, and who it is for.")],"Describe my product")))
# 8 Script to voice
T.append(dict(name="Script to voice", category="audio", tags=["voice","tts","narration"],
  description="Reads a script aloud with a natural voice.",
  doc=doc([N("t","input.text",{"value":"","variable":"script"},0,0),
           studio("s","ai.speech"), N("out","output",{"name":"audio"},600,0)],
          [E("t","text","s","prompt"),E("s","audio","out","value")],
          [V("script","text","Script")],"Script to voice")))
# 9 Ad captions from a product photo
T.append(dict(name="Ad captions from a product photo", category="ads", tags=["captions","ads","copy"],
  description="Looks at the product, then writes three short ad captions in your brand voice.",
  doc=doc([N("img","input.image",{"variable":"image"},0,0),
           N("p1","prompt",{"template":"Describe this product precisely: what it is, colour, material, and its one standout feature. Two sentences."},0,120),
           studio("see","ai.describe",300,0),
           N("p2","prompt",{"template":"Write three short ad captions (under 12 words each) for this product. Brand voice: {{brand_voice}}. Return them as a numbered list.\n\nProduct: {{input}}"},600,0),
           studio("write","ai.text",900,0),
           N("out","output",{"name":"text"},1200,0)],
          [E("img","image","see","images"),E("p1","prompt","see","prompt"),E("see","text","p2","text"),E("p2","prompt","write","prompt"),E("write","text","out","value")],
          [V("image","image","Product photo"),V("brand_voice","string","Brand voice",False,"friendly, confident, short")],"Ad captions")))
# 10 Logline & synopsis
T.append(dict(name="Logline & synopsis", category="professional", tags=["story","film","writing"],
  description="A one-sentence logline and a three-sentence synopsis from an idea. The first step of Movie mode, on its own.",
  doc=doc([N("p","prompt",{"template":"Write a one-sentence logline and then a three-sentence synopsis for this film idea: {{idea}}. Genre: {{genre}}. Be specific and vivid; no preamble."},0,0),
           studio("s","ai.text"), N("out","output",{"name":"text"},600,0)],
          [E("p","prompt","s","prompt"),E("s","text","out","value")],
          [V("idea","string","Idea"),V("genre","string","Genre",False,"thriller")],"Logline & synopsis")))
# 11 Rewrite for social
T.append(dict(name="Rewrite for social", category="trending", tags=["social","caption","rewrite"],
  description="Rewrites any text as a post for the platform you pick.",
  doc=doc([N("p","prompt",{"template":"Rewrite the following as a {{platform}} post in a natural voice, keeping the meaning, with a hook in the first line and no hashtags unless the platform expects them.\n\n{{text}}"},0,0),
           studio("s","ai.text"), N("out","output",{"name":"text"},600,0)],
          [E("p","prompt","s","prompt"),E("s","text","out","value")],
          [V("text","text","Text"),V("platform","string","Platform",True,"Instagram",["TikTok","Instagram","LinkedIn","X"])],"Rewrite for social")))

s,existing=call("GET","/templates"); have={t["name"] for t in existing.get("items",[])}
for t in T:
    if t["name"] in have: print("skip (exists):",t["name"]); continue
    s,r=call("POST","/templates",{**t,"visibility":"public"})
    if s==201: print("created:",t["name"],"| est sen:",r.get("estimatedCostSen"))
    else: print("FAILED:",t["name"],s,json.dumps(r)[:400])
s,r=call("GET","/templates?scope=public"); print("public now:",[(x["name"],x["category"],x.get("authorName")) for x in r.get("items",[])])
