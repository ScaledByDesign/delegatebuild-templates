import { Link } from 'react-router-dom';

const HeroBanner = () => {
  return (
    <section className="relative min-h-[544px] md:min-h-[560px] w-full flex flex-row text-white overflow-hidden">
      {/* banner__media - image container with overlay */}
      <div className="absolute inset-0 w-full h-full -z-10">
        <img
          src="/images/hero-1.webp"
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Dark overlay - matches .banner__media::after with opacity 0.3 */}
        <div className="absolute inset-0 w-full h-full bg-black opacity-30 z-[1]"></div>
      </div>

      {/* banner__content wrapper */}
      <div className="relative w-full flex items-end justify-center z-[2] p-0 md:p-[50px]">
        {/* banner__box */}
        <div className="relative text-center w-full h-fit px-6 md:px-[35px] py-8 md:py-[40px] md:max-w-[545px]" data-aos="fade-up">
          <h1
            className="uppercase mb-0 text-4xl md:text-5xl lg:text-[52px]"
            style={{
              fontFamily: 'stratumno1-black',
              fontWeight: 400,
              lineHeight: 1.3,
              letterSpacing: '0.6px',
            }}
          >
            THE VNSH HOLSTER
          </h1>
          <p
            className="mt-4 mb-0 text-base md:text-lg lg:text-[20px]"
            style={{
              fontFamily: 'URWDIN-Regular',
              fontWeight: 300,
              lineHeight: 1.8,
              letterSpacing: '0.6px',
              color: 'rgba(255, 255, 255, 0.75)',
            }}
          >
            So Comfy It's Like It Ain't Even There
          </p>
          <div className="mt-6 md:mt-[2rem]">
            <Link to="/products/vnsh-holster" className="btn-primary">Buy Now</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;

// Also exported as a named export so either import style resolves
// (`import HeroBanner from ...` or `import { HeroBanner } from ...`).
export { HeroBanner };
