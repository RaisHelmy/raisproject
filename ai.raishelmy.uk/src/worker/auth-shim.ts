export * from "./auth";
import { constantTimeEqual } from "./util";
export async function constantTimeEqualSafe(a: string, b: string): Promise<boolean> {
  return constantTimeEqual(a, b);
}
