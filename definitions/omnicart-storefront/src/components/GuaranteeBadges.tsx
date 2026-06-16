const GuaranteeBadges = () => {
  const badges = [
    {
      image: "/images/money-back.avif",
      width: 163,
      height: 163,
      title: "60 DAY MONEY BACK GUARANTEE",
      description: "No question asked 60 day refund or replacement guaranteed. If you are unhappy for any reason, get your money back. Rock solid guarantee..."
    },
    {
      image: "/images/american-business.avif",
      width: 163,
      height: 163,
      title: "THANK YOU!",
      description: "Your purchase supports the second amendment community and increases our ability to defend ourselves and remain free."
    },
    {
      image: "/images/secure-payment.webp",
      width: 130,
      height: 163,
      title: "100% SECURE PAYMENT",
      description: "All orders are AES-256 Bit encrypted through a HTTPS secure network. We respect your privacy..."
    }
  ];

  return (
    <section className="pt-8 md:pt-12 pb-6 md:pb-9 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {badges.map((badge, index) => (
            <div key={index} className="text-center px-2 md:px-3.75" data-aos="fade-up" data-aos-delay={(index + 2) * 100}>
              <img
                width={badge.width}
                height={badge.height}
                alt={badge.title}
                src={badge.image}
                className="mx-auto max-w-[120px] md:max-w-none"
              />
              <div className="py-4 md:py-6">
                <h3 className="text-lg md:text-xl lg:text-2xl">{badge.title}</h3>
                <p className="mt-2 md:mt-2.5 text-base md:text-lg lg:text-[20px] leading-relaxed md:leading-[36px]" style={{ fontWeight: 300, letterSpacing: '0.6px', opacity: 0.75 }}>{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GuaranteeBadges;