interface ValueProp {
  title: string;
  description: string;
}

interface ValuePropsProps {
  props?: ValueProp[];
}

export const ValueProps: React.FC<ValuePropsProps> = ({ props }) => {
  if (!props?.length) return null;

  return (
    <section className="bg-[#111827] py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {props.map((prop) => (
            <div
              key={prop.title}
              className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-6 text-white space-y-3"
            >
              <h3 className="text-lg font-semibold uppercase tracking-wide">{prop.title}</h3>
              <p className="text-sm text-gray-200 leading-relaxed">{prop.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
