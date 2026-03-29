import React, { useEffect, useId, useRef } from 'react';
import { AppCopy } from '../../lib/i18n';

type ChartsGeolocationConsentModalProps = {
  copy: AppCopy['charts']['geolocationConsent'];
  geolocationSupported: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

const ChartsGeolocationConsentModal: React.FC<ChartsGeolocationConsentModalProps> = ({
  copy,
  geolocationSupported,
  onAccept,
  onDecline,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    primaryButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDecline();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onDecline]);

  return (
    <div className="consent-modal-backdrop">
      <div
        className="consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id={titleId} className="consent-modal-title">
          {copy.title}
        </h2>
        <p id={descriptionId} className="consent-modal-lede">
          {copy.description}
        </p>
        <p className="consent-modal-note">
          {geolocationSupported ? copy.browserPromptNote : copy.browserUnavailable}
        </p>
        <p className="consent-modal-note">{copy.fallbackNotice}</p>
        <div className="consent-modal-actions">
          <button type="button" className="pill pill-ghost" onClick={onDecline}>
            {copy.decline}
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            className="pill pill-active"
            onClick={onAccept}
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartsGeolocationConsentModal;
