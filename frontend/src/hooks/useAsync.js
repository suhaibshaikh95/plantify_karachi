// Runs an async function and tracks { status, data, error } for loading and error states.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param fn      async function to run (receives { signal })
 * @param options { immediate: run on mount, deps: re-run when these change }
 */
export function useAsync(fn, { immediate = false, deps = [] } = {}) {
  const [state, setState] = useState({ status: immediate ? 'loading' : 'idle', data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const controllerRef = useRef(null);

  const run = useCallback(async (...args) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await fnRef.current(...args, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', data: null, error });
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, run };
}
