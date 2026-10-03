import { EngineError } from "../errors";

/**
 * Comlink serialises thrown `Error`s down to name/message/stack, dropping our
 * `code` and `recovery`. Rethrowing EngineErrors as plain objects keeps them
 * intact across the worker boundary; `toItemError` understands both shapes.
 */
export function withPlainErrors<T extends Record<string, (...args: never[]) => Promise<unknown>>>(api: T): T {
  const wrapped = {} as T;
  for (const key of Object.keys(api) as (keyof T)[]) {
    const fn = api[key];
    wrapped[key] = (async (...args: never[]) => {
      try {
        return await fn(...args);
      } catch (err) {
        if (err instanceof EngineError) throw { code: err.code, message: err.message, recovery: err.recovery };
        throw err;
      }
    }) as T[keyof T];
  }
  return wrapped;
}
