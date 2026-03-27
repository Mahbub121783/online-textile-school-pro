import { useState } from 'react';
import QuizDashboard from './QuizDashboard';
import QuizBuilder from './QuizBuilder';
import QuizResultsBoard from './QuizResultsBoard';

type View = { mode: 'dashboard' } | { mode: 'builder'; quizId?: string } | { mode: 'results'; quizId: string };

const QuizManagementTab = () => {
  const [view, setView] = useState<View>({ mode: 'dashboard' });

  if (view.mode === 'builder') {
    return <QuizBuilder quizId={view.quizId} onBack={() => setView({ mode: 'dashboard' })} />;
  }

  if (view.mode === 'results') {
    return <QuizResultsBoard quizId={view.quizId} onBack={() => setView({ mode: 'dashboard' })} />;
  }

  return (
    <QuizDashboard
      onCreateNew={() => setView({ mode: 'builder' })}
      onEdit={(id) => setView({ mode: 'builder', quizId: id })}
      onResults={(id) => setView({ mode: 'results', quizId: id })}
    />
  );
};

export default QuizManagementTab;
