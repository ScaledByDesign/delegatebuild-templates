const ContestWinners = () => {
  return (
    <section className="pt-12 pb-9">
      <div className="container mx-auto px-4">
        <h2 data-aos="fade-up" className="uppercase">
          OUR CONTEST WINNERS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-7.5">
          {/* VNSH Gladiator Winner */}
          <div className="w-full max-w-full" data-aos="fade-up" data-aos-delay="300">
            <video
              playsInline
              controls
              preload="metadata"
              aria-label="VNSH Gladiator Winner"
              poster="/images/thumbnail-1.avif"
              style={{width: '100%', maxWidth: '100%'}}
            >
              <source src="https://cdn.shopify.com/videos/c/vp/a017c2a944844ef0834ef36f3ddd5a41/a017c2a944844ef0834ef36f3ddd5a41.HD-1080p-7.2Mbps-36759828.mp4?v=0" type="video/mp4" />
              <img
                width={300}
                height={170}
                alt="VNSH Gladiator Winner"
                src="/images/thumbnail-1.avif"
              />
            </video>
            <h3 className="text-center py-6.25 bg-[rgba(18,18,18,.04)] rounded-b-md">
              VNSH GLADIATOR WINNER
            </h3>
          </div>

          {/* VNSH Truck Giveaway */}
          <div className="w-full max-w-full" data-aos="fade-up" data-aos-delay="400">
            <video
              playsInline
              controls
              preload="metadata"
              aria-label="VNSH Truck Giveaway"
              poster="/images/thumbnail-1.avif"
              style={{width: '100%', maxWidth: '100%'}}
            >
              <source src="https://cdn.shopify.com/videos/c/vp/fe18896b4b6945b599cf1a022e757627/fe18896b4b6945b599cf1a022e757627.HD-1080p-7.2Mbps-36759827.mp4?v=0" type="video/mp4" />
              <img
                width={300}
                height={170}
                alt="VNSH Truck Giveaway"
                src="/images/thumbnail-1.avif"
              />
            </video>
            <h3 className="text-center py-6.25 bg-[rgba(18,18,18,.04)] rounded-b-md">
              VNSH TRUCK GIVEAWAY
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContestWinners;

// Also exported as a named export so either import style resolves
// (`import ContestWinners from ...` or `import { ContestWinners } from ...`).
export { ContestWinners };
