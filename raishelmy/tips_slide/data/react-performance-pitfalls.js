/* ── React Performance Pitfalls ─────────────────────────────── */
window.TIP_DATA = {
  id: 'react-performance-pitfalls',
  title: 'React Performance: 7 Pitfalls to Stop Now',
  description: 'memo, useMemo, useCallback, unnecessary re-renders, large bundles — the React mistakes that silently tank your app.',
  category: 'React · 7 slides',
  tags: ['#react', '#performance', '#frontend', '#javascript'],
  date: '2026-04-22',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `The most common React performance mistake I see?

Wrapping everything in memo, useMemo, and useCallback before profiling anything.

Then the app actually slows down. Stale closure bugs. Broken referential equality. Components that do not update when they should.

Performance work in React needs to start with measurement. DevTools profiler first. Then fix the actual bottleneck — which is rarely what you suspected before you looked.

The 7 pitfalls I keep seeing, in slides.

#react #performance #frontend #javascript`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'React Performance.<br><span style="color:var(--red);">7 Pitfalls.</span><br><span style="color:#555;font-weight:300;">Fix them now.</span>',
      description: 'Your React app feels sluggish. Users notice. You added memo everywhere and it got worse. Here are the real culprits — and proper fixes.',
      tags: ['#react', '#performance', '#frontend', '#javascript']
    },

    /* 02 Unnecessary re-renders */
    {
      type: 'evr-code',
      label: 'pitfall 1 · unnecessary re-renders',
      expect_items: [
        'Wrap expensive child components in <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">React.memo</code> so they only re-render when props change.',
        'Colocate state — lift state only as high as needed, not all the way to root.',
        'Use <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">React DevTools Profiler</code> to identify what actually re-renders.'
      ],
      reality_items: [
        'Adding memo everywhere without profiling — adds overhead with no benefit.',
        'Huge global state (Context or Redux) triggering entire tree re-renders on small updates.',
        '"The profiler is confusing" — shipping blind and wondering why it\'s slow.'
      ],
      code_good: `<span class="cgr">// ✦ Expensive child — memoize it</span>
<span class="cr">const</span> HeavyList = React.memo(({ items }) => (
  &lt;ul&gt;{items.map(i =&gt; &lt;ListItem key={i.id} item={i}/&gt;)}&lt;/ul&gt;
));

<span class="cgr">// ✦ Colocated state — filter stays local</span>
<span class="cb">function</span> ProductPage() {
  <span class="cr">const</span> [filter, setFilter] = useState('');
  <span class="cr">return</span> (
    &lt;&gt;
      &lt;FilterInput value={filter} onChange={setFilter}/&gt;
      &lt;HeavyList items={<span class="cy">useFilteredItems</span>(filter)}/&gt;
    &lt;/&gt;
  );
}`,
      code_bad: `<span class="cgr">// ✗ Global context re-renders everything</span>
<span class="cr">const</span> AppContext = createContext({});
<span class="cb">function</span> App() {
  <span class="cr">const</span> [user, setUser] = useState(null);
  <span class="cr">const</span> [cart, setCart] = useState([]);
  <span class="cr">const</span> [theme, setTheme] = useState('light');
  <span class="cr">const</span> [filter, setFilter] = useState('');
  <span class="cr">return</span> (
    <span class="cr">&lt;AppContext.Provider</span> value={{user,cart,theme,filter}}&gt;
      &lt;Everything/&gt; <span class="cgr">// ALL of it re-renders on filter change</span>
    &lt;/AppContext.Provider&gt;`
    },

    /* 03 useMemo / useCallback misuse */
    {
      type: 'evr',
      label: 'pitfall 2 · usememo / usecallback abuse',
      expect_items: [
        '<code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">useMemo</code> for expensive derivations (filtering 10k items, heavy math).',
        '<code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">useCallback</code> only when passing callbacks to memoized children.',
        'Measure first — premature optimisation adds memory pressure and cognitive overhead.'
      ],
      reality_items: [
        'useMemo on every value, even primitive string/number concatenation.',
        'useCallback on every function regardless of whether the child is memoized.',
        'Dependency arrays wrong — stale closures, infinite loops, or ignored lint warnings.'
      ],
      code: `<span class="cgr">// ✗ Pointless memoization</span>
<span class="cr">const</span> title = useMemo(() => <span class="cy">\`Hello \${name}\`</span>, [name]);
<span class="cr">const</span> handleClick = useCallback(() =&gt; setCount(c+1), [c]);
<span class="cgr">// 👆 String concat costs less than memo overhead</span>
<span class="cgr">// 👆 useCallback pointless if Button isn't memo'd</span>

<span class="cgr">// ✦ Justified memoization</span>
<span class="cr">const</span> sorted = useMemo(
  () =&gt; [...items].sort(expensiveSort),
  [items]   <span class="cgr">// only re-sort when items change</span>
);
<span class="cr">const</span> onSubmit = useCallback(
  () =&gt; submitOrder(cart),
  [cart]   <span class="cgr">// stable ref for memoized &lt;Form /&gt;</span>
);`
    },

    /* 04 Bundle size */
    {
      type: 'nuance',
      label: 'pitfall 3 · ignoring bundle size',
      quote_title: 'Your JavaScript bundle is your first performance problem.',
      quote_body: 'A 3 MB bundle parsed on a mid-range Android phone costs ~4 seconds before a single pixel renders. Tree shaking, lazy imports, and route-based code splitting are not optional luxuries.',
      left_label: 'Warning signs',
      left_body: 'lodash fully imported · moment.js in bundle · no lazy() on routes · single 1MB+ chunk · no bundle analyser run',
      right_label: 'Fixes',
      right_body: 'date-fns / dayjs · lodash-es · React.lazy + Suspense on routes · Webpack Bundle Analyser · import cost VS Code extension',
      insight: '→ Run: npx vite-bundle-visualizer (Vite) or npx webpack-bundle-analyzer (CRA) before every major release.'
    },

    /* 05 Key misuse */
    {
      type: 'evr-code',
      label: 'pitfall 4 · key prop mistakes',
      expect_items: [
        'Use stable, unique IDs from your data as list keys.',
        'Keys must be stable across renders — never use array index for reorderable lists.',
        'Keys help React skip DOM mutations — wrong keys destroy this benefit.'
      ],
      reality_items: [
        'key={index} on all lists — causes incorrect DOM reuse, broken animations, lost input state.',
        'key={Math.random()} — remounts every item on every render, UI flashes constantly.',
        'Keys on wrong element — key must be on the outermost element returned from map().'
      ],
      code_good: `<span class="cgr">// ✦ Stable ID keys</span>
{todos.map(todo =&gt; (
  &lt;TodoItem
    <span class="cy">key={todo.id}</span>   <span class="cgr">// stable, unique</span>
    item={todo}
  /&gt;
))}`,
      code_bad: `<span class="cgr">// ✗ Index keys — breaks reordering</span>
{todos.map(<span class="cr">(todo, index)</span> =&gt; (
  &lt;TodoItem
    <span class="cr">key={index}</span>   <span class="cgr">// wrong: shifts on delete/sort</span>
    item={todo}
  /&gt;
))}

<span class="cgr">// ✗ Random keys — remounts everything</span>
{todos.map(todo =&gt; (
  &lt;TodoItem <span class="cr">key={Math.random()}</span> item={todo}/&gt;
))}`
    },

    /* 06 Effect overuse */
    {
      type: 'nuance',
      label: 'pitfall 5 · useeffect for derived state',
      quote_title: 'useEffect is not a data transformation tool.',
      quote_body: 'Triggering state updates from inside effects to derive new state causes double renders (state → effect → setState → re-render). Derive values directly in render instead.',
      left_label: 'Wrong pattern',
      left_body: 'useEffect watching [items] → setFilteredItems(items.filter(...)) → extra render cycle, race conditions with async',
      right_label: 'Correct pattern',
      right_body: 'const filtered = useMemo(() => items.filter(...), [items, query]) — computed inline, zero extra renders',
      insight: '→ Rule of thumb: if you find yourself doing setState inside useEffect for synchronous derived data, compute it during render instead.'
    },

    /* 07 CTA */
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
