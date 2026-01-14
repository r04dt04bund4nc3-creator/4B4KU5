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
    // Exact URL from your screenshot
    const ENDPOINT = 'https://webhook.site/52fd93c2-d87a-4ced-a7e4-261e6b04f699';
    
    const payload = {
      sessionId: getSessionId(),
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    console.log(`📊 Tracking Event: ${event}`, payload);

    try {
      // Use standard fetch for reliability in dev/Codespaces
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      // We log to console so you can see if it fails in the browser inspector
      console.warn('❌ Tracking failed:', error);
    }
  };

  return { trackEvent };
};