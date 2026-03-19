import React from 'react';
import { usePreferences } from '../state/preferences';

const FaqView: React.FC = () => {
  const { copy } = usePreferences();

  return (
    <div className="page faq-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.faq.eyebrow}</p>
          <h1 className="title">{copy.faq.title}</h1>
          <p className="lede">{copy.faq.lede}</p>
        </div>
      </header>

      <section className="faq-list" aria-label={copy.faq.listLabel}>
        {copy.faq.items.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary className="faq-question">{item.question}</summary>
            <p className="faq-answer">{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
};

export default FaqView;
