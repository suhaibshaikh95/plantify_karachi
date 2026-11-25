// App-wide state for one planning session: photo, location, answers, results and chat.
// Kept in sessionStorage so a page refresh does not lose the user's progress.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { readJson, writeJson } from '../utils/storage';
import { answerValue } from '../constants/questions';

const STORAGE_KEY = 'plantify.plan.v3';

const emptyAnswers = { salt_signs: {} };

export const initialPlan = {
  photo: null, // { name, hasGps } (the image itself is not stored)
  location: null, // { lat, lon, source, site, distance_km }
  answers: emptyAnswers,
  result: null, // backend /api/recommend response
  chat: [], // [{ role: 'user' | 'assistant', text, source? }]
};

function reducer(state, action) {
  switch (action.type) {
    case 'setPhoto':
      return { ...state, photo: action.photo };
    case 'setLocation':
      return { ...state, location: action.location, result: null, chat: [] };
    case 'clearLocation':
      return { ...state, location: null, result: null, chat: [] };
    case 'setSaltSign': {
      const signs = { ...state.answers.salt_signs };
      if (action.value === null) delete signs[action.key];
      else signs[action.key] = action.value;
      return { ...state, answers: { ...state.answers, salt_signs: signs }, result: null, chat: [] };
    }
    case 'setAnswer':
      return { ...state, answers: { ...state.answers, [action.key]: action.value }, result: null, chat: [] };
    case 'setResult':
      return { ...state, result: action.result, chat: [] };
    case 'addChat':
      return { ...state, chat: [...state.chat, action.message] };
    case 'load':
      return { ...initialPlan, ...action.plan };
    case 'reset':
      return initialPlan;
    default:
      return state;
  }
}

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [plan, dispatch] = useReducer(reducer, undefined, () => ({ ...initialPlan, ...readJson(STORAGE_KEY) }));

  useEffect(() => {
    writeJson(STORAGE_KEY, plan);
  }, [plan]);

  const actions = useMemo(
    () => ({
      setPhoto: (photo) => dispatch({ type: 'setPhoto', photo }),
      setLocation: (location) => dispatch({ type: 'setLocation', location }),
      clearLocation: () => dispatch({ type: 'clearLocation' }),
      setSaltSign: (key, value) => dispatch({ type: 'setSaltSign', key, value }),
      setAnswer: (key, value) => dispatch({ type: 'setAnswer', key, value }),
      setResult: (result) => dispatch({ type: 'setResult', result }),
      addChat: (message) => dispatch({ type: 'addChat', message }),
      load: (saved) => dispatch({ type: 'load', plan: saved }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  );

  const value = useMemo(() => ({ plan, ...actions }), [plan, actions]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}

/**
 * Builds the POST /api/recommend body the backend expects (docs/BACKEND_API.md).
 * Only answered salt signs are sent; the backend works out salinity from them.
 */
export function useRecommendRequest() {
  const { plan } = usePlan();
  return useCallback(() => {
    const { location, answers } = plan;
    return {
      lat: location.lat,
      lon: location.lon,
      site_id: location.site?.site_id ?? null,
      distance_km: location.distance_km ?? null,
      salt_signs: { ...answers.salt_signs },
      water_days: answerValue('water_days', answers.water_days),
      space: answerValue('space', answers.space),
      care: answerValue('care', answers.care),
      purpose: answerValue('purpose', answers.purpose),
      children_or_animals: answerValue('children_or_animals', answers.children_or_animals),
      budget: answers.budget ? answerValue('budget', answers.budget) : null,
    };
  }, [plan]);
}
