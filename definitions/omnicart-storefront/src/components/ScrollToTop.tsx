import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;

// Also exported as a named export so either import style resolves
// (`import ScrollToTop from ...` or `import { ScrollToTop } from ...`).
export { ScrollToTop };
