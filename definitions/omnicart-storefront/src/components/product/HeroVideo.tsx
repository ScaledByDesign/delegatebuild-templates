interface HeroVideoProps {
  videoUrl?: string;
}

export const HeroVideo: React.FC<HeroVideoProps> = ({ videoUrl }) => {
  if (!videoUrl) return null;

  return (
    <section className="bg-[#f9f6f1] py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          <iframe
            title="Product video"
            src={videoUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
};
