import { transformCdnUrl } from "@/lib/util/image-url";

interface Feature {
  title: string;
  description?: string;
  descriptionHtml?: string;
  image?: string;
  align?: "left" | "right";
}

interface FeaturesProps {
  features?: Feature[];
}

export const Features: React.FC<FeaturesProps> = ({ features }) => {
  if (!features?.length) return null;

  return (
    <>
      {features.map((feature, index) => (
        <section
          key={feature.title}
          className={`${index % 2 === 0 ? "bg-white" : "bg-[#f9f6f1]"} py-16`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              {feature.image ? (
                <div className={`${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <img
                    src={transformCdnUrl(feature.image)}
                    alt={feature.title}
                    className="w-full rounded-2xl object-cover shadow-xl"
                  />
                </div>
              ) : null}
              <div className={`${index % 2 === 1 ? "lg:order-1" : ""} space-y-4`}>
                <h2
                  className="uppercase"
                  style={{
                    fontSize: '40px',
                    fontWeight: '400',
                    lineHeight: '52px',
                    letterSpacing: '0.6px',
                    color: '#121212'
                  }}
                >
                  {feature.title}
                </h2>
                {feature.descriptionHtml ? (
                  <div
                    className="text-lg text-gray-700 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: feature.descriptionHtml }}
                  />
                ) : feature.description ? (
                  <p className="text-lg text-gray-700 leading-relaxed">{feature.description}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
};
