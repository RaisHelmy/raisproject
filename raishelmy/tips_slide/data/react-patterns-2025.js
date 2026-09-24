/* ── React Patterns That Actually Scale ─────────────────────── */
window.TIP_DATA = {
  id: 'react-patterns-2025',
  title: 'React Patterns That Actually Scale',
  description: 'Compound components, render props vs hooks, custom hook patterns, and state management decisions that age well.',
  category: 'React · 7 slides',
  tags: ['#react', '#patterns', '#frontend', '#hooks'],
  date: '2026-04-23',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Six months into a React project and adding a new feature required touching eight files.

That is usually a sign the component architecture did not account for how the app would grow. Not a design failure from the start — a growth problem that accumulated quietly.

Compound components, proper custom hook boundaries, state colocation — patterns that make a codebase easier to extend without constant rewrites.

This is the reference I keep sending to teams asking why their React apps are getting harder to change over time.

#react #frontend #javascript #hooks`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'React Patterns<br><span style="color:var(--red);">That Actually Scale.</span>',
      description: 'Compound components, custom hooks, state colocation, and the patterns that make codebases readable six months later.',
      tags: ['#react', '#patterns', '#frontend', '#hooks']
    },
    {
      type: 'evr-code',
      label: 'pattern 1 · compound components',
      expect_items: [
        'Compound components share implicit state via context — consumers compose the UI without prop drilling.',
        'Clean public API: <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">&lt;Tabs&gt;</code>, <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">&lt;Tabs.List&gt;</code>, <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">&lt;Tabs.Panel&gt;</code>.',
        'Flexible — caller controls layout, library controls behaviour.'
      ],
      reality_items: [
        'God component with 20 boolean props: showHeader, hasFooter, isCollapsible.',
        'Render prop chaos — nested callbacks, unreadable JSX trees.',
        '"Props explosion" — every variation adds a new prop.'
      ],
      code_good: `<span class="cgr">// ✦ Compound component — clean API</span>
&lt;Tabs defaultValue="profile"&gt;
  &lt;Tabs.List&gt;
    &lt;<span class="cg">Tabs.Trigger</span> value="profile"&gt;Profile&lt;/Tabs.Trigger&gt;
    &lt;<span class="cg">Tabs.Trigger</span> value="billing"&gt;Billing&lt;/Tabs.Trigger&gt;
  &lt;/Tabs.List&gt;
  &lt;<span class="cg">Tabs.Panel</span> value="profile"&gt;&lt;ProfileForm/&gt;&lt;/Tabs.Panel&gt;
  &lt;<span class="cg">Tabs.Panel</span> value="billing"&gt;&lt;BillingForm/&gt;&lt;/Tabs.Panel&gt;
&lt;/Tabs&gt;`,
      code_bad: `<span class="cgr">// ✗ Props explosion</span>
&lt;Tabs
  <span class="cr">tabs={[{label:'Profile',content:&lt;ProfileForm/&gt;},</span>
  <span class="cr">      {label:'Billing',content:&lt;BillingForm/&gt;}]}</span>
  defaultIndex={0}
  showBorder={true}
  alignment="left"
  onChange={(i) =&gt; trackTabChange(i)}
  renderHeader={(tab) =&gt; &lt;span&gt;{tab.label}&lt;/span&gt;}
/&gt; <span class="cgr">// add one more variant → another prop</span>`
    },
    {
      type: 'evr',
      label: 'pattern 2 · custom hooks vs context',
      expect_items: [
        'Custom hooks for reusable logic — auth, forms, data fetching, local state patterns.',
        'Context for cross-tree shared values that change infrequently: theme, user, locale.',
        'Zustand / Jotai for frequent client state updates — avoids context-triggered re-renders.'
      ],
      reality_items: [
        'Context for everything, including high-frequency state like cart totals and search queries.',
        'Duplicated fetch logic in 30 components instead of a shared useOrders() hook.',
        'Redux for a 5-page app — boilerplate heavier than application logic.'
      ],
      code: `<span class="cgr">// ✦ Custom hook — reusable fetch logic</span>
<span class="cb">function</span> useOrders(userId) {
  <span class="cr">const</span> [orders, setOrders] = useState([]);
  <span class="cr">const</span> [loading, setLoading] = useState(true);
  useEffect(() =&gt; {
    fetchOrders(userId).then(data =&gt; {
      setOrders(data); setLoading(false);
    });
  }, [userId]);
  <span class="cr">return</span> { orders, loading };
}

<span class="cgr">// ✦ Use anywhere — no context needed</span>
<span class="cb">function</span> OrdersPage({ userId }) {
  <span class="cr">const</span> { orders, loading } = <span class="cy">useOrders</span>(userId);
  <span class="cr">if</span> (loading) <span class="cr">return</span> &lt;Spinner/&gt;;
  <span class="cr">return</span> &lt;OrderList orders={orders}/&gt;;
}`
    },
    {
      type: 'nuance',
      label: 'pattern 3 · state colocation',
      quote_title: 'State belongs as low in the tree as possible.',
      quote_body: 'Lifting state all the way to the root causes global re-renders for local concerns. A modal\'s open/close state should live in the component that triggers it — not in AppContext.',
      left_label: 'Lift state when',
      left_body: 'Two sibling components both need the value · A parent needs to respond to child changes · The value is truly global (user session, theme)',
      right_label: 'Keep it local when',
      right_body: 'Only one component needs it · It\'s transient UI state (hover, focus, open/close) · It resets when the component unmounts',
      insight: '→ Rule: colocate first. Lift only when you have a concrete reason — not "just in case".'
    },
    {
      type: 'framework',
      label: 'state management decision framework',
      cells: [
        { label: 'Server state', value: 'React Query / SWR', sub: 'Fetch, cache, synchronise — purpose-built', red: false },
        { label: 'Global UI state', value: 'Zustand / Jotai', sub: 'Fast, no boilerplate, no context re-renders', red: false },
        { label: 'Form state', value: 'React Hook Form', sub: 'Uncontrolled forms, minimal re-renders', red: false },
        { label: 'URL state', value: 'useSearchParams', sub: 'Shareable, bookmarkable filter state', red: false },
        { label: 'Local UI state', value: 'useState / useReducer', sub: 'Default choice for component-local state', red: false },
        { label: 'Context', value: 'Theme / Auth only', sub: 'Infrequently changing, read-heavy values', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
