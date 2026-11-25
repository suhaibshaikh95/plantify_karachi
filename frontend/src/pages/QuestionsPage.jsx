// Step 2: the seven site questions.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import StepProgress from '../components/ui/StepProgress';
import Button from '../components/ui/Button';
import Notice from '../components/ui/Notice';
import SaltSignsCard from '../features/questions/SaltSignsCard';
import ChoiceQuestion from '../features/questions/ChoiceQuestion';
import { usePlan } from '../context/PlanContext';
import { CHOICE_QUESTIONS } from '../constants/questions';
import { ROUTES } from '../constants/routes';
import styles from './QuestionsPage.module.css';

export default function QuestionsPage() {
  const navigate = useNavigate();
  const { plan, setSaltSign, setAnswer } = usePlan();
  const [missing, setMissing] = useState([]);

  if (!plan.location) return <Navigate to={ROUTES.location} replace />;

  const { answers } = plan;

  function handleAnswer(key, value) {
    setAnswer(key, value);
    setMissing((m) => m.filter((k) => k !== key));
  }

  function submit() {
    const notAnswered = CHOICE_QUESTIONS.filter((q) => q.required && answers[q.key] === undefined).map((q) => q.key);
    setMissing(notAnswered);
    if (notAnswered.length) {
      document.getElementById(`q-${notAnswered[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    navigate(ROUTES.results);
  }

  return (
    <div className={`container page-enter ${styles.page}`}>
      <StepProgress current={2} />
      <PageHeader backTo={ROUTES.location} title="About your site" subtitle="Seven quick questions. Guess if you are not sure." />

      <SaltSignsCard values={answers.salt_signs} onChange={setSaltSign} />

      <div className={styles.grid}>
        {CHOICE_QUESTIONS.map((q) => (
          <ChoiceQuestion key={q.key} question={q} value={answers[q.key]} onChange={handleAnswer} missing={missing.includes(q.key)} />
        ))}
      </div>

      {missing.length > 0 && (
        <Notice tone="error" className={styles.notice}>
          Please answer the questions marked in red.
        </Notice>
      )}

      <div className={styles.footer}>
        <Button size="lg" iconRight="arrowRight" onClick={submit}>
          Get my plants
        </Button>
      </div>
    </div>
  );
}
