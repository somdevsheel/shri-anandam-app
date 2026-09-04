import { validateEnv, type Env } from "@shri-anandam/config";

/**
 * Nest's ConfigModule `validate` hook — throws and prevents boot if the
 * environment is misconfigured (section 44: fail fast, never boot into a
 * half-configured state).
 */
export function validate(rawConfig: Record<string, unknown>): Env {
  return validateEnv(rawConfig);
}

export default () => validateEnv(process.env as Record<string, unknown>);
