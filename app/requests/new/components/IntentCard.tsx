'use client';

interface IntentCardProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
  isFullWidth?: boolean;
}

export default function IntentCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  isFullWidth = false,
}: IntentCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer transition-all duration-300 ease-in-out
        p-8 rounded-2xl border-2 flex flex-col gap-4
        ${selected 
          ? 'bg-[#0e4b5a] border-[#0e4b5a] shadow-2xl scale-[1.02] z-10' 
          : `bg-white border-slate-200 shadow-sm 
             hover:border-cyan-500 hover:bg-slate-50/80 hover:shadow-xl hover:-translate-y-1`}
        ${isFullWidth ? 'w-full' : ''}
      `}
    >
      {/* Top right indicator dot */}
      {selected && (
        <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
      )}

      {/* Icon Box */}
      <div className={`
        w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all duration-300
        ${selected 
          ? 'bg-white/10 text-white rotate-0' 
          : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:shadow-inner'}
      `}>
        {icon}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className={`
          text-xl font-bold leading-tight transition-colors duration-300
          ${selected ? 'text-white' : 'text-slate-900'}
        `}>
          {title}
        </h3>
        <p className={`
          text-sm leading-relaxed transition-colors duration-300
          ${selected ? 'text-cyan-50/70' : 'text-slate-500'}
        `}>
          {description}
        </p>
      </div>
    </div>
  );
}