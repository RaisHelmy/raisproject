// Scripted product tour for the /ads showcase: a fake cursor drives the real UI (hover, click,
// type) scene by scene, with captions. Runs only inside the demo iframe (?demo=1&tour=1).

import { useEffect } from "react";
import { START_SCENE } from "./clock";

type Spec = { css: string; text?: string; exact?: boolean; nth?: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

function find(s: Spec): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(s.css)].filter((e) => visible(e) && !e.closest(".tour-ui")
    && (!s.text || (s.exact ? e.textContent?.trim() === s.text : e.textContent?.includes(s.text))));
  return all[s.nth ?? 0] ?? null;
}
async function waitFor(s: Spec, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    const e = find(s);
    if (e) return e;
    if (Date.now() - t0 > timeout) throw new Error(`tour: ${s.css} ${s.text ?? ""} not found`);
    await sleep(150);
  }
}

let cursor: HTMLDivElement, cap: HTMLDivElement, hovered: HTMLElement | null = null;
let pos = { x: 700, y: 450 };

async function move(e: HTMLElement) {
  const r0 = e.getBoundingClientRect();
  if (r0.top < 60 || r0.bottom > innerHeight - 110) { e.scrollIntoView({ block: "center", behavior: "smooth" }); await sleep(550); }
  const r = e.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 40 + r.width / 4), y = r.top + r.height / 2;
  const dist = Math.hypot(x - pos.x, y - pos.y);
  const ms = Math.min(900, 250 + dist * 0.8);
  cursor.style.transition = `transform ${ms}ms cubic-bezier(.4,.1,.2,1)`;
  cursor.style.transform = `translate(${x}px, ${y}px)`;
  pos = { x, y };
  await sleep(ms);
  hovered?.classList.remove("tour-hover");
  hovered = e; e.classList.add("tour-hover");
  e.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
}
async function hover(s: Spec, pause = 500) { await move(await waitFor(s)); await sleep(pause); }
async function click(s: Spec, pause = 700) {
  const e = await waitFor(s);
  await move(e);
  cursor.classList.add("down"); await sleep(140);
  e.click();
  cursor.classList.remove("down");
  await sleep(pause);
}
async function type(s: Spec, text: string) {
  const e = (await waitFor(s)) as HTMLInputElement;
  await move(e); e.focus();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  for (let i = 1; i <= text.length; i++) { set.call(e, text.slice(0, i)); e.dispatchEvent(new Event("input", { bubbles: true })); await sleep(110); }
  await sleep(500);
}
function say(i: number, title: string, text: string) {
  cap.innerHTML = `<div class="tour-step">${i + 1} / ${SCENES.length}</div><div class="tour-title">${title}</div><div class="tour-text">${text}</div>`;
  cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show");
  window.parent?.postMessage({ rt: "scene", i, title }, "*");
}
const nav = (label: string) => click({ css: ".topbar .seg button", text: label }, 1200);
/** Makes a scene self-contained: go to its page if the tour isn't already there (needed when starting mid-tour). */
async function ensure(label: string) {
  const b = find({ css: ".topbar .seg button", text: label });
  if (!b?.classList.contains("active")) await nav(label);
}

export const SCENES: { title: string; text: string; run: () => Promise<void> }[] = [
  { title: "Live markets", text: "18 instruments — US & HK stocks, forex, crypto, gold and oil — streaming in real time.", run: async () => {
    await nav("Stocks");
    for (let i = 0; i < 4; i++) await hover({ css: ".watch-item", nth: i }, 350);
    await click({ css: ".watch-item", text: "NVDA" }, 1200);
    await click({ css: ".btn", text: "5m", exact: true }, 1500);
    await click({ css: ".btn", text: "1m", exact: true }, 1200);
  } },
  { title: "One-click orders", text: "Market or limit orders on a paper account, with live positions and P/L in ringgit or dollars.", run: async () => {
    await ensure("Stocks");
    if (!find({ css: ".watch-item.active", text: "NVDA" })) await click({ css: ".watch-item", text: "NVDA" }, 800);
    await click({ css: "button", text: "Buy", exact: true }, 400);
    await click({ css: "button.btn-outline-secondary", text: "+", exact: true }, 300);
    await click({ css: "button.btn-outline-secondary", text: "+", exact: true }, 400);
    await click({ css: "button", text: "Buy NVDA" }, 1500);
    await click({ css: ".nav-link", text: "Positions" }, 1500);
  } },
  { title: "Binary options", text: "IQ-Option-style Higher / Lower trades from 30 seconds to 15 minutes, settled on the live price.", run: async () => {
    await nav("Binary");
    await click({ css: "button", text: "RM500", exact: true }, 300);
    await click({ css: "button", text: "1m", exact: true }, 400);
    await click({ css: "button", text: "▲ Higher" }, 2200);
    await click({ css: "button", text: "▼ Lower" }, 2500);
  } },
  { title: "Build a trading robot", text: "Pick a strategy, see its backtest update live, and start it — it keeps trading on the server 24/7.", run: async () => {
    await nav("Auto-Trade");
    await hover({ css: ".rule-card", nth: 0 }, 400);
    await hover({ css: ".rule-card", nth: 1 }, 400);
    await click({ css: "button", text: "+ New rule" }, 900);
    for (let i = 0; i < 3; i++) await hover({ css: ".tpl-card", nth: i * 2 }, 300);
    await click({ css: ".tpl-card", text: "RSI Overbought" }, 1800);
    await hover({ css: ".kpi", text: "Success" }, 1200);
    await click({ css: "button", text: "▶ Start rule" }, 1500);
  } },
  { title: "100 strategies · 1,591 rules", text: "From moving-average crosses to candlestick patterns — plus a library of tuned, ready-made presets.", run: async () => {
    await ensure("Auto-Trade");
    await click({ css: "button", text: "+ New rule" }, 700);
    await click({ css: "button.chip", text: "Pattern", exact: true }, 1000);
    await click({ css: ".seg button", text: "Rule library" }, 800);
    await click({ css: "button.chip", text: "All", exact: true }, 500);
    await type({ css: "input[placeholder*='Search presets']" }, "Grid");
    await hover({ css: ".tpl-card", nth: 1 }, 600);
    await click({ css: "button", text: "Close", exact: true }, 600);
  } },
  { title: "Pick how you trade", text: "Quick profit, day trading, weekly swing or long-term — the best robots for your style, ranked by stability.", run: async () => {
    await nav("Combos");
    say(5, "Backtesting 28,000 combos…", "Every rule on every asset, scored in the background and re-ranked each time a candle closes.");
    await waitFor({ css: ".goal-card" }, 90000);
    say(5, "Pick how you trade", "Quick profit, day trading, weekly swing or long-term — the best robots for your style, ranked by stability.");
    for (let i = 0; i < 4; i++) await click({ css: ".goal-card", nth: i }, 1300);
    await click({ css: ".goal-card", nth: 1 }, 900);
    await hover({ css: ".pick-card", nth: 0 }, 900);
    await hover({ css: ".pick-stat", text: "Next period" }, 1200);
  } },
  { title: "Prediction you can trust", text: "Each robot is checked across time periods, on fresh data and on similar assets — and flagged if it's just riding a trend.", run: async () => {
    await ensure("Combos");
    await waitFor({ css: ".win-spark" }, 90000);
    await hover({ css: ".win-spark", nth: 0 }, 1200);
    await click({ css: "tbody tr[role=button]", nth: 0 }, 2200);
    await click({ css: "button", text: "▶ Start this robot" }, 1200);
  } },
  { title: "100 ready-made bundles", text: "Conservative, balanced or aggressive portfolios — start several robots in one click.", run: async () => {
    await ensure("Combos");
    await waitFor({ css: ".goal-card" }, 90000);
    await click({ css: ".seg button", text: "Bundles" }, 900);
    await click({ css: "button.chip", text: "Risk profile" }, 700);
    for (let i = 0; i < 3; i++) await hover({ css: ".bundle-card", nth: i }, 500);
  } },
  { title: "Full audit trail", text: "Every order, robot signal, win, loss and auto-stop is recorded.", run: async () => {
    await nav("Activity");
    await click({ css: ".nav-link", text: "Audit trail" }, 2000);
  } },
  { title: "Light or dark", text: "A clean, modern interface — your way.", run: async () => {
    await nav("Stocks");
    await click({ css: "button[aria-label='Toggle theme']" }, 1800);
    await click({ css: "button[aria-label='Toggle theme']" }, 1200);
  } },
];

export function Tour() {
  useEffect(() => {
    document.documentElement.classList.add("touring");
    cursor = document.createElement("div"); cursor.className = "tour-ui tour-cursor";
    cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="tour-ring"></span>`;
    cap = document.createElement("div"); cap.className = "tour-ui tour-cap";
    document.body.appendChild(cursor); document.body.appendChild(cap);
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    let alive = true;
    (async () => {
      await sleep(1500);
      for (let i = START_SCENE; i < SCENES.length && alive; i++) {
        say(i, SCENES[i]!.title, SCENES[i]!.text);
        try { await SCENES[i]!.run(); } catch (e) { console.warn(e); }
        await sleep(900);
      }
      if (!alive) return;
      say(SCENES.length - 1, "Try it yourself", "Paper money, real strategies. Open RaisTrade and start your first robot.");
      window.parent?.postMessage({ rt: "done" }, "*");
      await sleep(4000);
      const u = new URL(location.href); u.searchParams.set("scene", "0"); location.replace(u);
    })();
    return () => { alive = false; cursor.remove(); cap.remove(); };
  }, []);
  return null;
}
