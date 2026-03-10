import React from 'react';

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: 'Why can OWID, WHO, and Worldometer show different numbers?',
    answer:
      'Sources use different reporting pipelines, update timings, and country submissions. WHO and OWID both note that national testing and reporting practices vary, which affects comparability.',
  },
  {
    question: 'Does WHO still publish daily global case counts?',
    answer:
      'WHO dashboard messaging emphasizes weekly reporting and trend interpretation. WHO also notes countries report at different frequencies, so daily interpretation can be misleading.',
  },
  {
    question: 'What changed on August 25, 2023 in WHO reporting guidance?',
    answer:
      'WHO requested countries to continue strong weekly reporting from August 25, 2023 and shifted dashboard emphasis to weekly indicators to reflect current data quality.',
  },
  {
    question: 'Why can weekly data sometimes contain negative values?',
    answer:
      'WHO explains that retrospective data cleaning and reclassification by countries can produce apparent negative corrections in specific weeks.',
  },
  {
    question: 'Is Worldometer still updating COVID totals every day?',
    answer:
      'According to its own notice, Worldometer stopped updating its COVID tracker on April 13, 2024, but keeps historical data and archives available.',
  },
  {
    question: 'What does OWID mean by confirmed cases?',
    answer:
      'OWID defines confirmed cases as infections confirmed by a test. OWID also states confirmed counts are lower than true infections because not everyone is tested.',
  },
  {
    question: 'Where does OWID case data come from?',
    answer:
      'OWID documentation on the cases page says its confirmed case/death dataset relies on WHO reporting.',
  },
  {
    question: 'Why can this dashboard show no data for some places or dates?',
    answer:
      'No-data appears when a value is absent for the selected metric/date mode in the ingested dataset, or when a source has reporting gaps in the selected period.',
  },
  {
    question: 'Where can I verify source methodology directly?',
    answer:
      'Open the About page source links: OWID cases documentation, WHO dashboard page, and Worldometer tracker/about pages.',
  },
];

const FaqView: React.FC = () => {
  return (
    <div className="page faq-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Help center</p>
          <h1 className="title">Frequently Asked Questions</h1>
          <p className="lede">
            These answers summarize OWID, WHO Dashboard, and Worldometer reporting context plus how
            this dashboard displays available data.
          </p>
        </div>
      </header>

      <section className="faq-list" aria-label="FAQ list">
        {faqItems.map((item) => (
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
