-- Run everything on Workers AI: add the strong open models, disable external-provider
-- entries (kept for later), and rewire every alias to Workers AI candidates only.
INSERT OR IGNORE INTO models(id, provider, display_name, input_usd_per_m, output_usd_per_m, enabled, tags, sort) VALUES
  ('workers-ai/@cf/moonshotai/kimi-k2.7-code',             'workers-ai', 'Kimi K2.7 Code',           0.950, 4.000, 1, 'coding,premium',     5),
  ('workers-ai/@cf/zai-org/glm-5.3',                       'workers-ai', 'GLM 5.3',                  1.400, 4.400, 1, 'premium,reasoning',  6),
  ('workers-ai/@cf/openai/gpt-oss-120b',                   'workers-ai', 'GPT-OSS 120B',             0.350, 0.750, 1, 'reasoning,coding',   7),
  ('workers-ai/@cf/openai/gpt-oss-20b',                    'workers-ai', 'GPT-OSS 20B',              0.200, 0.300, 1, 'cheap,fast',         8),
  ('workers-ai/@cf/google/gemma-4-26b-a4b-it',             'workers-ai', 'Gemma 4 26B',              0.100, 0.300, 1, 'cheap,fast',         9),
  ('workers-ai/@cf/zai-org/glm-4.7-flash',                 'workers-ai', 'GLM 4.7 Flash',            0.061, 0.400, 1, 'cheap,fast',        18),
  ('workers-ai/@cf/mistralai/mistral-small-3.1-24b-instruct','workers-ai','Mistral Small 3.1 24B',   0.351, 0.555, 1, 'fast',              19),
  ('workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',   'workers-ai', 'Llama 4 Scout',            0.270, 0.850, 1, 'fast',              23),
  ('workers-ai/@cf/nvidia/nemotron-3-120b-a12b',           'workers-ai', 'Nemotron 3 120B',          0.500, 1.500, 1, 'reasoning',         24);

UPDATE models SET enabled = 0 WHERE provider IN ('anthropic', 'openai', 'openrouter');

UPDATE aliases SET candidates = '["workers-ai/@cf/qwen/qwen3-30b-a3b-fp8","workers-ai/@cf/google/gemma-4-26b-a4b-it","workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"]',
  description = 'Sensible default: cheap Workers AI chat models' WHERE name = 'auto';
UPDATE aliases SET candidates = '["workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct","workers-ai/@cf/moonshotai/kimi-k2.7-code","workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731"]',
  description = 'Qwen Coder first, Kimi K2.7 Code then DeepSeek V4 Flash if unavailable' WHERE name = 'auto/coding';
UPDATE aliases SET candidates = '["workers-ai/@cf/zai-org/glm-5.3","workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813","workers-ai/@cf/openai/gpt-oss-120b"]',
  description = 'Strong reasoning: GLM 5.3, DeepSeek V4 Pro, GPT-OSS 120B' WHERE name = 'auto/reasoning';
UPDATE aliases SET candidates = '["workers-ai/@cf/qwen/qwen3-30b-a3b-fp8","workers-ai/@cf/zai-org/glm-4.7-flash","workers-ai/@cf/google/gemma-4-26b-a4b-it"]',
  description = 'Cheapest usable chat models' WHERE name = 'cheap';
UPDATE aliases SET candidates = '["workers-ai/@cf/zai-org/glm-5.3-flash","workers-ai/@cf/google/gemma-4-26b-a4b-it","workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"]',
  description = 'Lowest latency' WHERE name = 'fast';
UPDATE aliases SET candidates = '["workers-ai/@cf/moonshotai/kimi-k2.7-code","workers-ai/@cf/zai-org/glm-5.3","workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813"]',
  description = 'Best quality on Workers AI: Kimi K2.7 Code, GLM 5.3, DeepSeek V4 Pro' WHERE name = 'premium';
