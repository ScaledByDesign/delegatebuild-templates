interface IncludedItemsProps {
  items?: string[];
}

export const IncludedItems: React.FC<IncludedItemsProps> = ({ items }) => {
  if (!items?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="text-lg font-semibold uppercase tracking-wide text-gray-900">
        Included with every order
      </h2>
      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};
