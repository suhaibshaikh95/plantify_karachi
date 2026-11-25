// Step 3: recommendations from the backend, with site facts, filters and excluded plants.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import StepProgress from '../components/ui/StepProgress';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import Notice from '../components/ui/Notice';
import SiteSummary from '../features/results/SiteSummary';
import FilterBar from '../features/results/FilterBar';
import PlantCard from '../features/results/PlantCard';
import ExcludedList from '../features/results/ExcludedList';
import ResultsSkeleton from '../features/results/ResultsSkeleton';
import { usePlan, useRecommendRequest } from '../context/PlanContext';
import { useSavedPlan } from '../hooks/useSavedPlan';
import { getRecommendations } from '../services/plantifyApi';
import { toResultsView } from '../services/recommendationMapper';
import { RESULT_FILTERS } from '../constants/questions';
import { ROUTES } from '../constants/routes';
import { plural, siteName } from '../utils/format';
import styles from './ResultsPage.module.css';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { plan, setResult, load, reset } = usePlan();
  const buildRequest = useRecommendRequest();
  const { saved, save, remove } = useSavedPlan();
  const [status, setStatus] = useState(plan.result ? 'success' : 'idle');
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState([]);
  const [toast, setToast] = useState(null);
  const requestedRef = useRef(false); // send /api/recommend once per visit, even in React StrictMode

  // Open a saved plan (header link: /results?saved=1)
  useEffect(() => {
    if (params.get('saved') && saved?.plan?.result) {
      load(saved.plan);
      setStatus('success');
      setParams({}, { replace: true });
    }
  }, [params, saved, load, setParams]);

  const fetchResults = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setFilters([]);
    try {
      setResult(await getRecommendations(buildRequest()));
      setStatus('success');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, [buildRequest, setResult]);

  const canRequest = plan.location && plan.answers.water_days !== undefined;
  useEffect(() => {
    if (!plan.result && canRequest && status === 'idle' && !params.get('saved') && !requestedRef.current) {
      requestedRef.current = true;
      fetchResults();
    }
  }, [plan.result, canRequest, status, fetchResults, params]);

  const result = useMemo(() => toResultsView(plan.result), [plan.result]);

  if (!plan.result && !canRequest && !params.get('saved')) return <Navigate to={plan.location ? ROUTES.questions : ROUTES.location} replace />;

  const recommendations = result?.recommendations || [];
  const showFilters = recommendations.some((p) => p.traits);
  const shown = filters.length ? recommendations.filter((p) => filters.every((f) => p.traits?.[f])) : recommendations;
  const filterWords = RESULT_FILTERS.filter((f) => filters.includes(f.key)).map((f) => f.label.toLowerCase()).join(' + ');
  const isSaved = !!(saved && plan.result && JSON.stringify(saved.plan?.result) === JSON.stringify(plan.result));

  function toggleFilter(key) {
    setFilters((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));
  }

  function toggleSave() {
    if (isSaved) {
      remove();
      flash('Removed from this device');
    } else {
      flash(save(plan) ? 'Saved on this device' : 'Could not save: storage is blocked in this browser');
    }
  }

  function flash(text) {
    setToast(text);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(null), 2600);
  }

  function startOver() {
    reset();
    navigate(ROUTES.home);
  }

  const saveButton = result && (
    <button type="button" className={styles.saveBtn} onClick={toggleSave} aria-pressed={isSaved}>
      <Icon name="bookmark" size={18} />
      <span>{isSaved ? 'Saved' : 'Save'}</span>
    </button>
  );

  const actions = (
    <div className={styles.actions}>
      {recommendations.length > 0 && (
        <Button to={ROUTES.chat} icon="chat" block>
          Ask about a plant
        </Button>
      )}
      <Button variant="secondary" block onClick={startOver}>
        Start over
      </Button>
    </div>
  );

  return (
    <div className={`container page-enter`}>
      <StepProgress current={3} />
      <PageHeader backTo={ROUTES.questions} backLabel="Edit answers" action={saveButton} />

      {status === 'loading' && <ResultsSkeleton />}

      {status === 'error' && (
        <Notice tone="error" title="We couldn’t get your plants" actionLabel="Try again" onAction={fetchResults}>
          {error?.message}
        </Notice>
      )}

      {status === 'success' && result && (
        <div className={styles.layout}>
          <aside className={styles.side}>
            <h1 className={styles.title}>
              {recommendations.length ? `${plural(recommendations.length, 'plant')} for your plot` : 'No safe plants found'}
            </h1>
            <p className={styles.where}>
              <Icon name="pin" size={16} />
              <span>
                {siteName(result.site) || siteName(plan.location?.site)}
                {result.site?.distance_km ? ` · nearest reference site ${result.site.distance_km} km` : ''}
              </span>
            </p>
            <SiteSummary site={result.site} />
            <div className={styles.desktopOnly}>{actions}</div>
            <p className={`${styles.source} ${styles.desktopOnly}`}>
              Based on mapped soil and salt data, not a soil test.{result.ranked_by ? ` Ranked by ${result.ranked_by}.` : ''}
            </p>
          </aside>

          <section className={styles.main} aria-label="Recommended plants">
            {recommendations.length > 0 ? (
              <>
                <div className={styles.listHead}>
                  <h2 className={styles.listTitle}>{filters.length ? 'Filtered' : 'Recommended'}</h2>
                  {showFilters && <FilterBar active={filters} onToggle={toggleFilter} />}
                </div>
                {filters.length > 0 && (
                  <p className={styles.filterNote} aria-live="polite">
                    {shown.length
                      ? `${shown.length} of your ${plural(recommendations.length, 'plant')} ${shown.length === 1 ? 'is' : 'are'} ${filterWords}.`
                      : `None of your plants are ${filterWords}. Remove a filter to see them all.`}
                  </p>
                )}
                <div className={styles.grid}>
                  {shown.map((p, i) => (
                    <PlantCard key={p.scientific_name} plant={p} rank={i} />
                  ))}
                </div>
              </>
            ) : (
              <Notice tone="warning" title="None of the plants passed every safety and survival check">
                More watering days or a larger space usually helps. Edit your answers and try again.
              </Notice>
            )}

            <div className={styles.excluded}>
              <ExcludedList items={result.excluded} />
            </div>

            <div className={styles.mobileOnly}>
              {actions}
              <p className={styles.source}>
                Based on mapped soil and salt data, not a soil test.{result.ranked_by ? ` Ranked by ${result.ranked_by}.` : ''}
              </p>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
