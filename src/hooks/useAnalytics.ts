// src/hooks/useAnalytics.ts
export const useAnalytics = () => {
  const getSessionId = () => {
    let id = localStorage.getItem('abakus_session');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('abakus_session', id);
    }
    return id;
  };

  const trackEvent = async (event: string, metadata: object = {}) => {
    // YOUR WEBHOOK URL FROM SCREENSHOT
    const ENDPOINT = 'https://webhook.site/52fd93c2-d87a-4ced-a7e4-261e6b04f699'; 

    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors', // Important: prevents browser from blocking the request
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          event,
          timestamp: Date.now(),
          ...metadata,
        }),
      });
      // console.log(`[Analytics] ${event} sent.`);
    } catch (err) {
      console.warn('Analytics skipped', err);
    }
  };

  return { trackEvent };
};