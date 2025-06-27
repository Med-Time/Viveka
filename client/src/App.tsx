import React from 'react';
import './index.css';
import LessonPlan from './LessonPlan';

function App() {
  // For demonstration, render the LessonPlan UI directly
  // In a real app, you would use React Router for navigation
  return (
    <div className="App">
      <LessonPlan />
    </div>
  );
}

export default App;
