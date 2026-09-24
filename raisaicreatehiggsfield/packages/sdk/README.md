# @raisai/sdk

Node client for RaisAI Create. Generate images, video, speech and text, and run
saved workflows and templates.

```bash
bun add @raisai/sdk   # or npm install @raisai/sdk
```

## Generating something

```ts
import { RaisAI, formatMYR } from "@raisai/sdk";

const raisai = new RaisAI({ apiKey: process.env.RAISAI_API_KEY! });

// Price it before you run it. Generations spend real prepaid balance.
const quote = await raisai.models.estimate("@cf/leonardo/lucid-origin", {
  prompt: "a rainy cyberpunk street in Kuala Lumpur",
});
console.log(`This will cost about ${formatMYR(quote.estimatedSen)}`);

const { generation, balanceAfterSen } = await raisai.generations.create({
  modelId: "@cf/leonardo/lucid-origin",
  prompt: "a rainy cyberpunk street in Kuala Lumpur",
  idempotencyKey: crypto.randomUUID(),
});

console.log(generation.outputs.image, formatMYR(balanceAfterSen), "left");
```

## Running a workflow

```ts
const preview = await raisai.workflows.preview("wf_123", { style: "noir" });
if (!preview.valid) throw new Error(preview.errors[0]?.message);

const started = await raisai.workflows.run("wf_123", { style: "noir" }, { maxCostSen: 500 });
const finished = await raisai.workflows.waitForRun(started.id);
console.log(finished.outputs, formatMYR(finished.chargedSen));
```

## Money

Every amount is an integer in **sen**, one hundredth of a Malaysian ringgit.
`4962` means RM49.62. Use `formatMYR` rather than dividing by 100 yourself.

## Errors

Failures throw `RaisAIError` with a stable `code`, a readable message, and
often the action to take. Insufficient balance throws
`InsufficientBalanceError`, which carries what the request would have cost and
what was available.

```ts
import { InsufficientBalanceError } from "@raisai/sdk";

try {
  await raisai.generations.create({ modelId, prompt });
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.log(`Needed ${formatMYR(error.estimatedSen)}, had ${formatMYR(error.availableSen)}`);
  }
}
```

## Retries

Reads are retried on transient failures. A call that spends money is retried
**only** when you pass an `idempotencyKey`, because retrying a charge blind
could bill twice. The same key always returns the original result.
