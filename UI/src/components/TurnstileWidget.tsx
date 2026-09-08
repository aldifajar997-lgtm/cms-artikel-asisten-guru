import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action: string;
}

export function TurnstileWidget({ action }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let intervalId: any;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
        if (sitekey) {
          try {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
              sitekey: sitekey,
              action: action,
            });
          } catch (e) {
            console.error("Failed to render Turnstile:", e);
          }
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          clearInterval(intervalId);
          renderWidget();
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore removal errors
        }
      }
    };
  }, [action]);

  return (
    <div className="flex justify-center mt-2 w-full overflow-hidden">
      <div ref={containerRef} />
    </div>
  );
}
