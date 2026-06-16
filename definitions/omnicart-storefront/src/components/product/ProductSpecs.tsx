import { CheckCircle2 } from "lucide-react";

interface Spec {
  label: string;
  value: string;
}

interface ProductSpecsProps {
  specs?: Spec[];
  bulletFeatures?: string[];
}

export const ProductSpecs: React.FC<ProductSpecsProps> = ({ specs, bulletFeatures }) => {
  const hasContent = (specs?.length ?? 0) > 0 || (bulletFeatures?.length ?? 0) > 0;
  if (!hasContent) return null;

  return (
    <section className="bg-[#f9f6f1] py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          className="text-center uppercase mb-12"
          style={{
            fontSize: '40px',
            fontWeight: '400',
            lineHeight: '52px',
            letterSpacing: '0.6px',
            color: '#121212'
          }}
        >
          Specs & Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {specs?.length ? (
            <div className="rounded-2xl bg-white p-6 border border-gray-200 space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 uppercase tracking-wide">
                Specifications
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
                {specs.map((spec, idx) => (
                  <li key={`${spec.label}-${spec.value || idx}`} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-vnsh-red mt-1 flex-shrink-0" />
                    <span>
                      <span className="font-semibold text-gray-900">{spec.label}</span>
                      {spec.value ? ` ${spec.value}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {bulletFeatures?.length ? (
            <div className="rounded-2xl bg-white p-6 border border-gray-200 space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 uppercase tracking-wide">
                Features
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
                {bulletFeatures.map((feature, idx) => (
                  <li key={`${feature}-${idx}`} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-vnsh-red mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
