import { createElement, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourceDTO } from "@xuanzhi/shared-types";

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";
const CITE_RE = /([①②③④⑤⑥⑦⑧⑨⑩]|\[(\d{1,2})\])/g;

/** Turn citation labels (① or [1]) inside text nodes into clickable chips. */
function withCitations(children: ReactNode, sources: SourceDTO[], onCite?: (s: SourceDTO) => void): ReactNode {
  if (!sources.length || !onCite) return children;
  const walk = (node: ReactNode): ReactNode => {
    if (typeof node === "string") {
      const parts: ReactNode[] = []; let last = 0; let m: RegExpExecArray | null; CITE_RE.lastIndex = 0;
      while ((m = CITE_RE.exec(node))) {
        const idx = m[2] ? Number(m[2]) : CIRCLED.indexOf(m[1]!) + 1;
        const src = sources.find((s) => s.rank === idx || s.label === m![1]);
        if (!src) continue;
        parts.push(node.slice(last, m.index));
        parts.push(<button key={`${m.index}-${idx}`} type="button" className="xz-cite" title={src.document_title} onClick={() => onCite(src)}>{src.label}</button>);
        last = m.index + m[0].length;
      }
      if (!parts.length) return node;
      parts.push(node.slice(last));
      return parts;
    }
    if (Array.isArray(node)) return node.map((n, i) => <span key={i}>{walk(n)}</span>);
    return node;
  };
  return walk(children);
}

export const Markdown = memo(function Markdown({ text, sources = [], onCite, streaming }: { text: string; sources?: SourceDTO[]; onCite?: (s: SourceDTO) => void; streaming?: boolean }) {
  const C = (tag: string) => ({ children }: { children?: ReactNode }) => createElement(tag, null, withCitations(children, sources, onCite));
  return (
    <div className={`xz-md ${streaming ? "xz-cursor" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: C("p"), li: C("li"), td: C("td"), th: C("th"), h1: C("h3"), h2: C("h3"), h3: C("h3"), h4: C("h4"), blockquote: C("blockquote"), strong: C("strong"), em: C("em"), a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
