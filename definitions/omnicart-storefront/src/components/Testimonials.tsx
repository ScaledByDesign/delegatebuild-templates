import React from 'react';

const Testimonials = () => {
  const testimonials = [
    {
      quote: "This holster is everything it's advertised to be. Comfortable, ambidextrous, fits micro compacts to duty size. Wear shoulder, appendix, iwb, owb, strong side. Perfect for all day wear. Pockets for mag and flashlight. So comfortable you may forget you have a gun on you. Highly (to the power of 10) recommended you get one or two.",
      author: "Jimmy J. in Leavenworth, KS",
      avatar: "/images/jimmy.avif"
    },
    {
      quote: "I've always had broad shoulders and virtually no hips. Every belt I own struggles to hold up my pants let alone my handgun. I tried a rigid weathering belt. Better but uncomfortable and still had to keep pulling up my pants. No more. The VNSH holster never slips and holds all my handguns from the .380s to my .40 full size Sig Sauer.",
      author: "Keven G. in Louisville, KY",
      avatar: "/images/keven.avif"
    }
  ];

  return (
    <section className="pt-8 md:pt-12 pb-6 md:pb-9">
      <div className="container mx-auto px-4">
        <h2 data-aos="fade-up" className="uppercase text-2xl md:text-3xl lg:text-4xl text-center md:text-left">
          See Why They Say "This Is The Best Holster I've Ever Owned"
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 mt-6 md:mt-7.5 gap-8 md:gap-12 lg:gap-0">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="text-center px-2 md:px-3.75" data-aos="fade-up" data-aos-delay={((index + 1) * 150) + 300}>
              <div className="mb-4 md:mb-6">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover mx-auto"
                />
              </div>

              <p className="mt-4 md:mt-5 text-base md:text-lg lg:text-[20px] leading-relaxed md:leading-[36px]" style={{ fontWeight: 300, letterSpacing: '0.6px', opacity: 0.7 }}>
                <q>{testimonial.quote}</q>
              </p>
              <p className="mt-2 text-base md:text-lg lg:text-[20px] leading-relaxed md:leading-[36px]" style={{ fontWeight: 300, letterSpacing: '0.6px' }}>-{testimonial.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;