export const useAnalytics = () => {
  const getSessionId = () => {
    let id = localStorage.getItem('abakus_session');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('abakus_session', id);
    }
    return id;
  };

  const trackEvent = (event: string, metadata: object = {}) => {
    // YOUR WEBHOOK URL
    const ENDPOINT = 'https://webhook.site/52fd93c2-d87a-4ced-a7e4-261e6b04f699';
    
    const payload = JSON.stringify({
      sessionId: getSessionId(),
      event,
      timestamp: Date.now(),
      ...metadata,
    });

    // Navigator.sendBeacon is more reliable for analytics and ignores CORS issues
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, payload);
    } else {
      // Fallback for older browsers
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // text/plain prevents CORS preflight
        body: payload
      }).catch(err => console.warn('Analytics skipped', err));
    }
  };

  return { trackEvent };
};