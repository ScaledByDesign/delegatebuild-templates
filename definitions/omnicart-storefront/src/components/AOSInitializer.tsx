import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const AOSInitializer = () => {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: false,
      delay: 150,
    });
  }, []);

  return null;
};

export default AOSInitializer;


// Also exported as a named export so either import style resolves
// (`import AOSInitializer from ...` or `import { AOSInitializer } from ...`).
export { AOSInitializer };
