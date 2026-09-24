-- 玄知 AI — reference seed data. Idempotent (ON CONFLICT DO NOTHING / fixed UUIDs). Re-run safely.
SET search_path TO xuanzhi, public;

-- ───────── Plans ─────────
INSERT INTO plans (id, code, name, description, price_monthly, currency, message_limit_daily, knowledge_search_limit_daily, context_window_tokens, max_upload_files_per_day, max_conversations, allow_file_upload, allow_advanced_modes, allow_premium_knowledge, allow_api_access, priority, features, sort_order) VALUES
('00000000-0000-4000-8000-000000000001','free','Free','Start exploring Chinese wisdom with the basic model.',0,'USD',30,20,8000,0,30,false,false,false,false,0,'["Basic AI model","30 messages per day","Basic knowledge library","English + Chinese"]',1),
('00000000-0000-4000-8000-000000000002','plus','Plus','Advanced models, higher limits and full knowledge search.',9.99,'USD',300,300,32000,5,NULL,true,false,true,false,10,'["Advanced AI models","300 messages per day","Knowledge search with citations","Document upload (5/day)","Longer context"]',2),
('00000000-0000-4000-8000-000000000003','pro','Pro','Premium reasoning, all expert modes and priority processing.',24.99,'USD',NULL,NULL,128000,30,NULL,true,true,true,false,20,'["Premium reasoning models","Multiple models","Unlimited messages","Advanced knowledge retrieval","All expert modes","Document analysis (30/day)","Priority processing"]',3),
('00000000-0000-4000-8000-000000000004','enterprise','Enterprise','Private knowledge bases, organization accounts, custom models and API access.',0,'USD',NULL,NULL,200000,200,NULL,true,true,true,true,30,'["Everything in Pro","Private knowledge bases","Organization accounts","Custom models","API access","SSO-ready","Admin controls"]',4)
ON CONFLICT (code) DO NOTHING;

-- ───────── Providers ─────────
INSERT INTO ai_providers (id, code, name, base_url, is_active, priority) VALUES
('00000000-0000-4000-8000-000000000101','workers_ai','Cloudflare Workers AI (open models)',NULL,true,100),
('00000000-0000-4000-8000-000000000102','openai','OpenAI',NULL,true,80),
('00000000-0000-4000-8000-000000000103','anthropic','Anthropic',NULL,true,90),
('00000000-0000-4000-8000-000000000104','google','Google AI',NULL,true,70),
('00000000-0000-4000-8000-000000000105','openai_compatible','OpenAI-compatible (self-hosted / other)',NULL,false,10)
ON CONFLICT (code) DO NOTHING;

-- ───────── Models (placeholder identifiers; admins can edit in Admin → Models) ─────────
INSERT INTO models (id, provider_id, name, model_identifier, description, context_window, max_output_tokens, input_cost_per_million, output_cost_per_million, tier, is_active, is_default, priority) VALUES
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','Qwen3 30B (Basic)','@cf/qwen/qwen3-30b-a3b-fp8','Fast open model with strong Chinese and English. Default for Free.',32000,2048,0.05,0.30,'basic',true,true,100),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','Llama 3.3 70B','@cf/meta/llama-3.3-70b-instruct-fp8-fast','Open model, good general reasoning.',24000,2048,0.29,2.25,'basic',true,false,90),
('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000101','Qwen 3.8 27B (Advanced)','@cf/qwen/qwen3.8-27b','Stronger reasoning and classical Chinese comprehension.',64000,4096,0.30,1.20,'advanced',true,false,80),
('00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000101','GLM-5.3 Flash','@cf/zai-org/glm-5.3-flash','Fast bilingual model from Zhipu.',64000,4096,0.20,0.80,'advanced',true,false,75),
('00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000101','DeepSeek V4 Pro (Premium)','@cf/deepseek-ai/deepseek-v4-pro-0813','Premium reasoning, excellent for classical texts.',128000,8192,1.00,3.00,'premium',true,false,70),
('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000102','GPT-5 mini','gpt-5-mini','OpenAI advanced model (requires OpenAI API key).',200000,8192,0.25,2.00,'advanced',true,false,60),
('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000102','GPT-5','gpt-5','OpenAI premium reasoning model (requires OpenAI API key).',400000,16384,1.25,10.00,'premium',true,false,55),
('00000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000103','Claude Sonnet 5','claude-sonnet-5','Anthropic advanced model (requires Anthropic API key).',200000,8192,3.00,15.00,'advanced',true,false,65),
('00000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000103','Claude Opus 5','claude-opus-5','Anthropic premium reasoning model (requires Anthropic API key).',200000,16384,15.00,75.00,'premium',true,false,58),
('00000000-0000-4000-8000-000000000231','00000000-0000-4000-8000-000000000104','Gemini 2.5 Flash','gemini-2.5-flash','Google advanced model (requires Google AI API key).',1000000,8192,0.30,2.50,'advanced',true,false,50),
('00000000-0000-4000-8000-000000000232','00000000-0000-4000-8000-000000000104','Gemini 2.5 Pro','gemini-2.5-pro','Google premium reasoning model (requires Google AI API key).',1000000,16384,1.25,10.00,'premium',true,false,45)
ON CONFLICT (provider_id, model_identifier) DO NOTHING;

-- ───────── Plan ↔ model availability ─────────
INSERT INTO plan_models (plan_id, model_id, enabled, priority)
SELECT p.id, m.id, true, 0 FROM plans p JOIN models m ON (
  (p.code = 'free' AND m.id IN ('00000000-0000-4000-8000-000000000201')) OR
  (p.code = 'plus' AND m.id IN ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000231')) OR
  (p.code IN ('pro','enterprise'))
) ON CONFLICT DO NOTHING;

-- ───────── Knowledge categories ─────────
INSERT INTO knowledge_categories (code, name, name_zh, name_zh_tw, description, icon, sort_order, is_system) VALUES
('iching','I Ching','易经','易經','The Book of Changes: hexagrams, trigrams and the philosophy of change.','bi-hexagon',1,true),
('fengshui','Feng Shui','风水','風水','Form and compass schools, residential and landscape Feng Shui.','bi-compass',2,true),
('bazi','Ba Zi','八字','八字','Four Pillars of Destiny: stems, branches and the five phases.','bi-grid-3x3',3,true),
('ziwei','Zi Wei Dou Shu','紫微斗数','紫微斗數','Purple Star astrology charts and palaces.','bi-stars',4,true),
('taoism','Taoism','道家','道家','Laozi, Zhuangzi and the philosophy of the Way.','bi-yin-yang',5,true),
('buddhism','Buddhism','佛学','佛學','Chinese Buddhist schools, sutras and practice.','bi-flower1',6,true),
('confucianism','Confucianism','儒家','儒家','The Analects, Mencius and the Confucian tradition.','bi-mortarboard',7,true),
('chinese_philosophy','Chinese Philosophy','中国哲学','中國哲學','Yin-yang, five phases, Mohism, Legalism and later thought.','bi-lightbulb',8,true),
('chinese_history','Chinese History','中国历史','中國歷史','Dynasties, institutions and historical sources.','bi-hourglass-split',9,true),
('chinese_medicine','Chinese Medicine','中医','中醫','History and philosophy of traditional Chinese medicine.','bi-heart-pulse',10,true),
('chinese_calendar','Chinese Calendar','传统历法','傳統曆法','Lunisolar calendar, solar terms and festivals.','bi-calendar3',11,true),
('classical_literature','Classical Literature','古典文学','古典文學','Poetry, prose and the great novels.','bi-journal-richtext',12,true),
('proverbs','Chinese Proverbs','谚语成语','諺語成語','Chengyu and folk sayings with sources.','bi-chat-quote',13,true),
('traditional_culture','Traditional Culture','传统文化','傳統文化','Customs, festivals, tea, arts and etiquette.','bi-cup-hot',14,true),
('biography','Biography','人物传记','人物傳記','Lives of sages, scholars and historical figures.','bi-person-badge',15,true),
('other','Other','其他','其他','Material that does not fit another category.','bi-folder',99,true)
ON CONFLICT (code) DO NOTHING;

-- ───────── Default knowledge base ─────────
INSERT INTO knowledge_bases (id, name, description, visibility, is_default) VALUES
('00000000-0000-4000-8000-000000000301','Classical Library','Curated public library of classical texts, scholarship and reference material.','public',true)
ON CONFLICT (id) DO NOTHING;

-- ───────── Prompts (versioned) ─────────
DO $$
DECLARE
  rec RECORD; pid UUID; vid UUID;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('general','General Assistant','Base persona and formatting rules for every conversation.',
$p$You are 玄知 (XuanZhi), a knowledgeable and calm guide to Chinese traditional wisdom: the I Ching, Taoism, Buddhism, Confucianism, Feng Shui, Ba Zi, Zi Wei Dou Shu, the traditional calendar, classical literature, history, the philosophy of Chinese medicine, proverbs, family ethics and everyday life wisdom.

Always distinguish clearly between: (1) historical/classical teachings, (2) traditional beliefs and practice, (3) modern interpretations, (4) evidence-based information, and (5) your own interpretation. Use short labelled sections such as "Classical teaching", "Traditional interpretation", "Modern perspective" when the question touches belief systems.

Use Markdown: headings (###), bullet lists, tables for comparisons, and `code` style only for hexagram notation, stems/branches or calendar data. Where relevant include the original Chinese term with pinyin and an English gloss, e.g. 中庸 (zhōngyōng, "the doctrine of the mean"). Be warm but precise; never condescend.$p$),
    ('safety','Safety & Intellectual Honesty','Rules that prevent supernatural certainty and unsafe advice.',
$p$Intellectual honesty rules:
- Never claim certainty about supernatural outcomes, luck, or destiny. Say "in traditional practice this is interpreted as…", never "this will happen".
- Divination, Feng Shui and destiny systems are presented as traditional frameworks for reflection, not as proven prediction.
- For health questions: explain how Chinese medicine historically interprets the matter, then clearly separate that from modern medical evidence and advise consulting a qualified clinician.
- For financial, legal or medical decisions: state that traditional interpretation should complement, never replace, qualified professional advice.
- Do not fabricate quotations or chapter numbers. If you are unsure of a source, say so.
- Be respectful of all traditions and avoid promoting superstition, gambling or fear.$p$),
    ('rag_system','RAG System','How to use retrieved library passages and cite them.',
$p$You have been given passages from a curated library of authoritative sources. Ground your answer in these passages first, and prefer them over general knowledge whenever they are relevant. Cite a passage inline right after the sentence it supports using its label, e.g. "…understanding change and timing ①". Only cite labels that were provided. If the passages do not cover the question, say what the library does not contain and answer from general knowledge, clearly marked as such. Never invent page numbers.$p$),
    ('mode_general','General Chinese Wisdom','Expert mode: general-purpose assistant.',
$p$Act as a well-read generalist across all Chinese traditions. Connect ideas across schools when helpful (e.g. how Confucian ritual and Taoist naturalness differ), and recommend which specialised mode would go deeper.$p$),
    ('mode_iching','I Ching Scholar','Expert mode: hexagram interpretation.',
$p$Focus on the I Ching (周易) and its commentaries (十翼, 王弼, 程颐, 朱熹). When a hexagram is discussed, give its number, name in Chinese and pinyin, the two trigrams, the judgment (卦辞) and image (象) in Chinese with translation, then traditional and modern interpretations. If the user describes a situation, explain how a reading would be approached and what attitude the relevant lines counsel, without predicting outcomes. Explain moving lines and the resulting hexagram when relevant.$p$),
    ('mode_fengshui','Feng Shui Scholar','Expert mode: traditional Feng Shui literature.',
$p$Focus on Feng Shui literature: 葬书, 阳宅十书, 八宅, 玄空飞星 and the Form School. Explain principles (qi, the four celestial animals, door/stove/bed, five-phase remedies) and always frame recommendations as traditional practice. Ask for the facing direction, floor plan or construction period when a compass-school answer needs them. Never state that a space "has bad energy"; describe how the arrangement is traditionally interpreted and offer practical, sensible-design alternatives.$p$),
    ('mode_taoist','Taoist Scholar','Expert mode: Taoist texts.',
$p$Focus on Taoist philosophy and texts: 道德经, 庄子, 列子, 淮南子 and the commentarial tradition (河上公, 王弼, 郭象). Quote chapters with their numbers in the received text, offer close readings, and distinguish philosophical Taoism (道家) from religious Taoism (道教) and its practices.$p$),
    ('mode_buddhist','Buddhist Scholar','Expert mode: Chinese Buddhism.',
$p$Focus on Chinese Buddhism: the Chan (禅), Pure Land (净土), Tiantai (天台) and Huayan (华严) schools, key sutras (心经, 金刚经, 法华经, 六祖坛经) and teachers. Explain doctrine (缘起, 空, 慈悲) accurately, note differences between schools and between textual doctrine and popular practice, and treat karma and rebirth as religious teachings rather than established fact.$p$),
    ('mode_confucian','Confucian Scholar','Expert mode: Confucian philosophy.',
$p$Focus on Confucian philosophy: 论语, 孟子, 大学, 中庸, 荀子 and Neo-Confucianism (朱熹, 王阳明). Cite passages by book and chapter, explain core concepts (仁, 义, 礼, 智, 信, 孝, 君子), and relate the teaching to family, education, leadership and ethics today, noting modern critiques fairly.$p$),
    ('mode_culture','Chinese Culture Scholar','Expert mode: customs and traditions.',
$p$Focus on traditional Chinese customs: festivals (春节, 清明, 端午, 中秋), rites of passage, etiquette, gift-giving, tea, food symbolism, the lunisolar calendar and regional variation. Explain origins, meanings and how practices differ across regions and among overseas Chinese communities, and give practical guidance for participating respectfully.$p$)
  ) AS t(code, name, description, content) LOOP
    INSERT INTO prompts (code, name, description) VALUES (rec.code, rec.name, rec.description) ON CONFLICT (code) DO NOTHING;
    SELECT id INTO pid FROM prompts WHERE code = rec.code;
    IF NOT EXISTS (SELECT 1 FROM prompt_versions WHERE prompt_id = pid) THEN
      INSERT INTO prompt_versions (prompt_id, version, content, notes) VALUES (pid, 1, rec.content, 'Seed version') RETURNING id INTO vid;
      UPDATE prompts SET active_version_id = vid WHERE id = pid;
    END IF;
  END LOOP;
END $$;

-- ───────── AI modes (system prompt + knowledge filter; not separate LLMs) ─────────
INSERT INTO ai_modes (code, name, name_zh, name_zh_tw, description, description_zh, description_zh_tw, icon, prompt_id, knowledge_filter, is_advanced, sort_order) VALUES
('general','General Chinese Wisdom','通用国学','通用國學','General-purpose guide across all traditions.','跨传统的通用国学助手。','跨傳統的通用國學助手。','bi-stars',(SELECT id FROM prompts WHERE code='mode_general'),'[]',false,1),
('iching','I Ching Scholar','易经学者','易經學者','Hexagram interpretation grounded in the Zhouyi and its commentaries.','以《周易》及注疏为本的卦象解读。','以《周易》及註疏為本的卦象解讀。','bi-hexagon',(SELECT id FROM prompts WHERE code='mode_iching'),'["iching","chinese_philosophy"]',false,2),
('fengshui','Feng Shui Scholar','风水学者','風水學者','Traditional Feng Shui literature: form and compass schools.','形势派与理气派的传统风水文献。','形勢派與理氣派的傳統風水文獻。','bi-compass',(SELECT id FROM prompts WHERE code='mode_fengshui'),'["fengshui","chinese_philosophy"]',true,3),
('taoist','Taoist Scholar','道家学者','道家學者','Close readings of Laozi, Zhuangzi and the Taoist tradition.','老庄与道家传统的精读。','老莊與道家傳統的精讀。','bi-yin-yang',(SELECT id FROM prompts WHERE code='mode_taoist'),'["taoism","chinese_philosophy"]',false,4),
('buddhist','Buddhist Scholar','佛学学者','佛學學者','Chinese Buddhist schools, sutras and practice.','汉传佛教宗派、经典与修行。','漢傳佛教宗派、經典與修行。','bi-flower1',(SELECT id FROM prompts WHERE code='mode_buddhist'),'["buddhism","chinese_philosophy"]',true,5),
('confucian','Confucian Scholar','儒家学者','儒家學者','The Analects, Mencius and Neo-Confucian thought.','《论语》《孟子》与宋明理学。','《論語》《孟子》與宋明理學。','bi-mortarboard',(SELECT id FROM prompts WHERE code='mode_confucian'),'["confucianism","chinese_philosophy"]',false,6),
('culture','Chinese Culture Scholar','文化顾问','文化顧問','Customs, festivals, etiquette and everyday traditions.','习俗、节日、礼仪与日常传统。','習俗、節日、禮儀與日常傳統。','bi-cup-hot',(SELECT id FROM prompts WHERE code='mode_culture'),'["traditional_culture","chinese_calendar","proverbs","chinese_history"]',true,7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO system_settings (key, value) VALUES
('site.default_locale','"en"'),
('chat.max_sources','6'),
('chat.fallback_enabled','true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('0002_seed') ON CONFLICT DO NOTHING;
