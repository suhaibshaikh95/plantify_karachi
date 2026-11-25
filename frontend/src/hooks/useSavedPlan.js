// Saves the current results on this device (localStorage) so they can be reopened later.
import { useCallback, useEffect, useState } from 'react';
import { readJson, removeKey, writeJson } from '../utils/storage';

const KEY = 'plantify.saved.v2';
const EVENT = 'plantify:saved-plan';

function load() {
  return readJson(KEY, window.localStorage);
}

export function useSavedPlan() {
  const [saved, setSaved] = useState(load);

  useEffect(() => {
    const sync = () => setSaved(load());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const save = useCallback((plan) => {
    const { location, answers, result } = plan;
    const ok = writeJson(KEY, { savedAt: new Date().toISOString(), plan: { location, answers, result } }, window.localStorage);
    window.dispatchEvent(new Event(EVENT));
    return ok;
  }, []);

  const remove = useCallback(() => {
    removeKey(KEY, window.localStorage);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { saved, save, remove };
}
