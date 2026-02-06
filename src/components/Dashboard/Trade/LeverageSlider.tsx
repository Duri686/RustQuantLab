import { memo, useCallback } from 'react';

/* ============================================
   Constants
   ============================================ */

/** Leverage snap points for quick selection */
const LEVERAGE_STEPS = [1, 10, 20, 50, 100, 125] as const;

/** Min and max leverage values */
const MIN_LEVERAGE = 1;
const MAX_LEVERAGE = 125;

/* ============================================
   Props Interface
   ============================================ */

export interface LeverageSliderProps {
  /** Current leverage value (1-125) */
  value: number;
  /** Callback when leverage changes */
  onChange: (value: number) => void;
  /** Optional disabled state */
  disabled?: boolean;
}

/* ============================================
   Component
   ============================================ */

/**
 * LeverageSlider Component
 * 
 * Cyberpunk-styled leverage control for Futures trading.
 * Features snap points and visual feedback.
 */
function LeverageSlider({ value, onChange, disabled = false }: LeverageSliderProps) {
  const percentage = ((value - MIN_LEVERAGE) / (MAX_LEVERAGE - MIN_LEVERAGE)) * 100;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  const handleStepClick = useCallback(
    (step: number) => {
      if (!disabled) {
        onChange(step);
      }
    },
    [onChange, disabled]
  );

  return (
    <div className="space-y-3">
      {/* Leverage Display */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Leverage</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono text-warning">
            {value}x
          </span>
        </div>
      </div>

      {/* Custom Slider Track */}
      <div className="relative h-2 group">
        {/* Background Track */}
        <div className="absolute inset-0 rounded-full bg-border-dark" />
        
        {/* Active Track (Yellow gradient) */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-75"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, var(--color-warning) 0%, var(--color-warning-alt) 100%)`,
          }}
        />

        {/* Slider Input (Invisible, for interaction) */}
        <input
          type="range"
          min={MIN_LEVERAGE}
          max={MAX_LEVERAGE}
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {/* Thumb Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-warning border-2 border-bg-dark shadow-lg transition-all duration-75 pointer-events-none"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>

      {/* Snap Point Buttons */}
      <div className="flex items-center justify-between gap-1">
        {LEVERAGE_STEPS.map((step) => (
          <button
            key={step}
            onClick={() => handleStepClick(step)}
            disabled={disabled}
            className={`
              flex-1 py-1.5 text-[10px] font-mono font-medium rounded transition-all
              ${value === step
                ? 'bg-warning/20 text-warning border border-warning/50'
                : 'bg-bg-surface text-gray-500 border border-border-dark hover:text-gray-300 hover:border-gray-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {step}x
          </button>
        ))}
      </div>

      {/* Risk Indicator Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden bg-border-dark flex">
          <div className="w-1/3 h-full bg-success" />
          <div className="w-1/3 h-full bg-warning-alt" />
          <div className="w-1/3 h-full bg-danger" />
        </div>
        <span className="text-[9px] text-gray-500 font-mono">
          {value <= 10 ? 'Low' : value <= 50 ? 'Medium' : 'High'} Risk
        </span>
      </div>
    </div>
  );
}

export default memo(LeverageSlider);
