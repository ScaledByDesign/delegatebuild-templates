import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ProductShowcase = () => {
  return (
    <section className="pt-8 md:pt-13 pb-6 md:pb-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div data-aos="fade-up" data-aos-delay="150">
            <img
              src="/images/image-1.webp"
              loading="eager"
              alt="VNSH Holster"
              className="object-cover h-full w-full rounded-lg md:rounded-none"
            />
          </div>
          <div className="pl-0 md:p-10 lg:p-17.5 pt-6 md:pt-12" data-aos="fade-up" data-aos-delay="250">
            <h2 className="uppercase text-2xl md:text-3xl lg:text-4xl">THE VNSH HOLSTER</h2>
            <p className="mt-4 md:mt-5 text-base md:text-lg lg:text-[20px] leading-relaxed md:leading-[36px]" style={{ fontWeight: 300, letterSpacing: '0.6px', opacity: 0.7 }}>
              If you're a gun owner who wants to carry everyday but find you take your gun with you less often than you'd like...all because <em>your holster isn't comfortable</em>...then you owe it to yourself to use the VNSH holster.
              <br /><br />
              The VNSH holster is insanely comfortable (check out our reviews). It also saves you money because it works with 99% of all modern guns, has 2 built-in mag-pouches and doesn't require a tactical belt.
              <br /><br />
              It truly is an evolution in comfort.
              <br /><br />
              Click Discover More to discover why it may be the last holster you ever buy!
            </p>
            <Button asChild className="bg-vnsh-green hover:bg-[#0f4a1c] text-white px-6 py-3 mt-6 md:mt-7.5 w-full md:w-auto touch-manipulation">
              <Link to="/products/vnsh-holster">Discover More</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductShowcase;


// Also exported as a named export so either import style resolves
// (`import ProductShowcase from ...` or `import { ProductShowcase } from ...`).
export { ProductShowcase };
