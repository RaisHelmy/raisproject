/**
 * Bundled demonstration/reference documents so the library answers questions right after setup.
 * These are short, original introductions (not full classical texts) and are labelled as demonstration content.
 */
import type { SourceType } from "@xuanzhi/shared-types";
import iching from "./iching-introduction.md";
import daodejing from "./daodejing-introduction.md";
import analects from "./analects-introduction.md";
import wuxing from "./five-elements.md";
import fengshui from "./fengshui-fundamentals.md";
import wisdom from "./classical-wisdom.md";

export interface DemoDocument { title: string; filename: string; category: string; language: string; author: string; source: string; tags: string[]; source_type: SourceType; content: string }

export const DEMO_DOCUMENTS: DemoDocument[] = [
  { title: "I Ching (易经) — Introduction and the Eight Trigrams", filename: "iching-introduction.md", category: "iching", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "hexagram", "trigram", "change"], source_type: "scholarly", content: iching },
  { title: "Dao De Jing (道德经) — Introduction and Key Chapters", filename: "daodejing-introduction.md", category: "taoism", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "laozi", "wu wei", "dao"], source_type: "scholarly", content: daodejing },
  { title: "The Analects (论语) — Introduction and Core Teachings", filename: "analects-introduction.md", category: "confucianism", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "confucius", "ren", "li"], source_type: "scholarly", content: analects },
  { title: "The Five Elements (五行) — Wood, Fire, Earth, Metal, Water", filename: "five-elements.md", category: "chinese_philosophy", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "wu xing", "cycles", "medicine", "bazi"], source_type: "scholarly", content: wuxing },
  { title: "Feng Shui (风水) — Fundamentals of Form and Compass Schools", filename: "fengshui-fundamentals.md", category: "fengshui", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "form school", "compass school", "qi", "residential"], source_type: "scholarly", content: fengshui },
  { title: "Chinese Classical Wisdom — Proverbs and Life Guidance", filename: "classical-wisdom.md", category: "proverbs", language: "en", author: "XuanZhi editorial team", source: "Demonstration reference content", tags: ["demo", "proverbs", "family", "ethics"], source_type: "modern_commentary", content: wisdom },
];
