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

