window.TIP_DATA = {
  id: 'configuration-secrets',
  title: 'Configuration & Secrets Management in .NET',
  description: 'Options pattern, Secret Manager, Azure Key Vault, and environment-specific config. Stop hardcoding secrets.',
  category: '.NET · 7 slides',
  tags: ['#dotnet', '#security', '#aspnetcore', '#devops'],
  date: '2026-04-06',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Found a hardcoded connection string in appsettings.json last month. Committed to the repo. Pushed to GitHub. Eight months of production data accessible to anyone who found the repo.

Not a junior. A senior engineer. The habit of using appsettings.json for local development just never got unlearned when things went live.

This is not rare. It happens quietly, and you find out either via a security audit or because someone already used it.

Options pattern, Secret Manager, Key Vault, environment-specific overrides — the layered approach that keeps secrets out of source control.

#dotnet #security #aspnetcore #devops`,
  slides: [
    { type: 'evr-code', label:'topic 1 · options pattern',
      expect_items:['IOptions<T>, IOptionsSnapshot<T>, IOptionsMonitor<T> — typed config binding.','Validate options at startup with DataAnnotations or IValidateOptions<T>.','Environment-specific override files: appsettings.Production.json.'],
      reality_items:['IConfiguration injected everywhere and keys accessed by magic strings.','No validation — null reference at runtime when a config key is misspelled.','Same appsettings.json in dev and production with production secrets checked in.'],
      code_good:`<span class="cgr">// ✦ Options pattern — typed, validated</span>
<span class="cr">public class</span> <span class="cy">SmtpOptions</span>
{
    [Required] <span class="cr">public string</span> Host { <span class="cr">get; set;</span> } = <span class="cg">""</span>;
    [Range(1,65535)] <span class="cr">public int</span> Port { <span class="cr">get; set;</span> }
    [Required] <span class="cr">public string</span> ApiKey { <span class="cr">get; set;</span> } = <span class="cg">""</span>;
}
<span class="cgr">// Program.cs</span>
builder.Services
    .AddOptions&lt;SmtpOptions&gt;()
    .BindConfiguration(<span class="cg">"Smtp"</span>)
    .ValidateDataAnnotations()
    .ValidateOnStart();   <span class="cgr">// fail fast ✦</span>`,
      code_bad:`<span class="cgr">// ✗ Magic string config access</span>
<span class="cr">public class</span> <span class="cy">EmailService</span>
{
    <span class="cr">private readonly</span> IConfiguration _cfg;
    <span class="cr">public</span> EmailService(IConfiguration cfg) =&gt; _cfg = cfg;

    <span class="cr">public void</span> Send()
    {
        <span class="cr">var</span> host = _cfg[<span class="cg">"Smtp:Host"</span>];   <span class="cgr">// null if typo</span>
        <span class="cr">var</span> key  = _cfg[<span class="cg">"Smtp:APIKey"</span>]; <span class="cgr">// wrong casing?</span>
    }
}` },
    { type:'evr', label:'topic 2 · secrets management',
      expect_items:['dotnet user-secrets for local development — never committed to Git.','Azure Key Vault / AWS Secrets Manager for production secrets.','Environment variables as first-class override (12-factor app compliant).'],
      reality_items:['Real connection strings and API keys committed to Git (even private repos get breached).','Production secrets emailed or shared in Slack — no audit trail, no rotation.','Secrets baked into Docker images — exposed via docker inspect or registry access.'],
      code:`<span class="cgr">// ✦ Local dev secrets (not committed)</span>
<span class="cgr">// $ dotnet user-secrets set "Smtp:ApiKey" "sk_test_..."</span>
builder.Configuration.AddUserSecrets&lt;Program&gt;();

<span class="cgr">// ✦ Production: Azure Key Vault</span>
<span class="cr">if</span> (builder.Environment.IsProduction())
{
    <span class="cr">var</span> vaultUri = <span class="cr">new</span> Uri(builder.Configuration[<span class="cg">"KeyVaultUri"</span>]!);
    builder.Configuration.AddAzureKeyVault(
        vaultUri, <span class="cr">new</span> DefaultAzureCredential());
}
<span class="cgr">// ✗ Never — real secrets in source</span>
<span class="cr">private const string</span> ApiKey = <span class="cg">"sk_live_abcd1234"</span>; <span class="cgr">// 💀</span>` },
    { type:'nuance', label:'the real lesson · secrets are infrastructure, not code',
      quote_title:'Secrets don\'t belong<br>in <span style="color:var(--red);">source control.</span> Ever.',
      quote_body:'Git history is forever. Even if you delete the commit, the secret is in the history. Rotate any secret that has ever been committed, no exceptions.',
      left_label:'Local: user-secrets', left_body:'dotnet user-secrets stores secrets in your OS profile, never in the project directory. Use it for every local secret.',
      right_label:'Prod: managed identity', right_body:'Azure Managed Identity + Key Vault means no secrets in connection strings, no rotation scripts, no secret sprawl. Zero credentials to leak.',
      insight:'A breach via a committed secret costs on average <strong style="color:#fff;">USD 4.45 million</strong> (IBM 2023). dotnet user-secrets costs 5 minutes to set up.' },
    { type:'cta' }
  ]
};
