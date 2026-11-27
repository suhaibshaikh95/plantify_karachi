// Ask questions about the recommended plants. Answers come from POST /api/chat.
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import ChatMessage from '../features/chat/ChatMessage';
import ChatComposer from '../features/chat/ChatComposer';
import { usePlan } from '../context/PlanContext';
import { askPlantQuestion, chatRecommendation } from '../services/plantifyApi';
import { CHAT_SUGGESTIONS } from '../constants/questions';
import { ROUTES } from '../constants/routes';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const { plan, addChat } = usePlan();
  const [pending, setPending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [plan.chat.length, pending]);

  if (!plan.result?.recommendations?.length) return <Navigate to={ROUTES.results} replace />;

  const plants = plan.result.recommendations;
  const names = plants.map((p) => p.common_name).join(', ');
  const suggestions = [`How often to water ${plants[0].common_name}?`, ...CHAT_SUGGESTIONS];

  async function send(question) {
    const history = plan.chat.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    addChat({ role: 'user', text: question });
    setPending(true);
    try {
      const res = await askPlantQuestion({
        question,
        siteId: plan.result.site?.site_id ?? plan.location?.site?.site_id ?? null,
        plants: plants.map((p) => p.scientific_name),
        history,
        recommendation: chatRecommendation(plan.result),
      });
      addChat({ role: 'assistant', text: res.answer, source: res.source || null });
    } catch (err) {
      const text =
        err.status === 501
          ? 'The plant chat is not available yet. It is coming in the next version of Plantify.'
          : `Sorry, I couldn’t answer that. ${err.message}`;
      addChat({ role: 'assistant', text, error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`container page-enter ${styles.page}`}>
      <PageHeader backTo={ROUTES.results} backLabel="Back to results" title="Ask about your plants" subtitle={names} />

      <div className={styles.log} aria-live="polite">
        <ChatMessage role="assistant" text={`Hi. I can answer questions about the ${plants.length} plants suggested for your plot.`} />
        {plan.chat.map((m, i) => (
          <ChatMessage key={i} {...m} />
        ))}
        {pending && <ChatMessage role="assistant" pending />}
        <div ref={endRef} />
      </div>

      <div className={styles.composer}>
        <ChatComposer suggestions={suggestions} onSend={send} disabled={pending} />
      </div>
    </div>
  );
}
