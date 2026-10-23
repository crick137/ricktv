import React from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  return (
    <div
      className={`inline-flex rt-glass rounded-2xl p-1 shadow-sm shadow-slate-900/5 ${className || ''}`}
      role='tablist'
    >
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type='button'
            role='tab'
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`relative min-w-[4.75rem] sm:min-w-[5.75rem] px-3.5 py-2 text-xs sm:text-sm rounded-xl font-medium transition-all duration-300 ${
              isActive
                ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
