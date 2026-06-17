import { useEffect, useRef } from 'react';

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  id?: string;
}

/**
 * Injects JSON-LD structured data into the document head.
 * Automatically cleans up on unmount or when data changes.
 * Uses data-jsonld-id to prevent duplicates across SPA navigations.
 */
const JsonLd = ({ data, id }: JsonLdProps) => {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    // Remove previous script owned by this instance
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }

    // Also remove any orphaned script with the same id (SPA navigation edge case)
    if (id) {
      const existing = document.querySelector(`script[data-jsonld-id="${id}"]`);
      if (existing) existing.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    if (id) {
      script.setAttribute('data-jsonld-id', id);
    }
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [data, id]);

  return null;
};

export default JsonLd;

// Also exported as a named export so either import style resolves
// (`import JsonLd from ...` or `import { JsonLd } from ...`).
export { JsonLd };
