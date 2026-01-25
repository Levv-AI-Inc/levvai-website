type IntentCardProps = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  selected: boolean;
  onSelect: () => void;
};

export default function IntentCard({
  title,
  description,
  icon,
  selected,
  onSelect,
}: IntentCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-5 transition-all ${
        selected
          ? 'border-cyan-400 bg-cyan-50'
          : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <div className="flex items-start space-x-4">
        {icon && <div className="text-2xl leading-none">{icon}</div>}
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}
