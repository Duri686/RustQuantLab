import { memo } from 'react';
import { Settings, Camera } from 'lucide-react';

/* ============================================
   Constants
   ============================================ */

/** Available timeframe options */
const TIMEFRAMES = ['1s', '1m', '5m', '15m', '1H', '4H', '1D'] as const;

/** Technical indicator options */
const MAIN_INDICATORS = ['MA', 'EMA', 'BOLL'] as const;
const SUB_INDICATORS = ['VOL', 'MACD', 'RSI'] as const;

/** Chart type options */
const CHART_TYPES = ['TradingView', 'Depth'] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];
export type Indicator =
  | (typeof MAIN_INDICATORS)[number]
  | (typeof SUB_INDICATORS)[number];
export type ChartType = (typeof CHART_TYPES)[number];

/* ============================================
   Props Interface
   ============================================ */

export interface ChartToolbarProps {
  /** Currently selected timeframe */
  activeTimeframe?: Timeframe;
  /** Callback when timeframe is selected */
  onTimeframeChange?: (timeframe: Timeframe) => void;
  /** Currently active indicators (multi-select) */
  activeIndicators?: Indicator[];
  /** Callback when indicator is toggled */
  onIndicatorToggle?: (indicator: Indicator) => void;
  /** Currently selected chart type */
  activeChartType?: ChartType;
  /** Callback when chart type is selected */
  onChartTypeChange?: (chartType: ChartType) => void;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
  /** Callback when screenshot is clicked */
  onScreenshotClick?: () => void;
}

/* ============================================
   Style Constants (预留：如需全局色值可在此扩展)
   ============================================ */

/* ============================================
   Sub-Components
   ============================================ */

interface ToolbarButtonProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}

/** Base button component with consistent styling */
function ToolbarButton({
  children,
  active,
  onClick,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        px-2 py-1 text-[11px] font-medium rounded transition-colors
        ${
          active
            ? 'text-warning bg-warning/10'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }
      `}
    >
      {children}
    </button>
  );
}

/** Icon button for toolbar actions */
interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
}

function IconButton({ icon, onClick, title }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      {icon}
    </button>
  );
}

/** Vertical divider */
function Divider() {
  return <div className="w-px h-5 bg-border-dark mx-1" />;
}

/* ============================================
   Main Component
   ============================================ */

/**
 * ChartToolbar Component
 *
 * Professional trading chart toolbar mimicking Binance/TradingView style.
 * Provides controls for timeframes, indicators, chart types, and actions.
 */
function ChartToolbar({
  activeTimeframe = '1H',
  onTimeframeChange,
  activeIndicators = ['MA', 'VOL'],
  onIndicatorToggle,
  activeChartType = 'TradingView',
  onChartTypeChange,
  onSettingsClick,
  onScreenshotClick,
}: ChartToolbarProps) {
  return (
    <div className="h-9 md:h-10 bg-bg-surface-alt border-b border-border-dark px-1 md:px-2 flex items-center justify-between overflow-hidden">
      {/* ========== Left Section: 横向滚动容器 ========== */}
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 min-w-max">
          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <ToolbarButton
                key={tf}
                active={activeTimeframe === tf}
                onClick={() => onTimeframeChange?.(tf)}
                title={`Switch to ${tf} timeframe`}
              >
                {tf}
              </ToolbarButton>
            ))}
          </div>

          <Divider />

          {/* Technical Indicators - 移动端只显示主要指标 */}
          <div className="flex items-center gap-0.5">
            {MAIN_INDICATORS.map((ind) => (
              <ToolbarButton
                key={ind}
                active={activeIndicators?.includes(ind as Indicator)}
                onClick={() => onIndicatorToggle?.(ind as Indicator)}
                title={`Toggle ${ind} indicator`}
              >
                {ind}
              </ToolbarButton>
            ))}
          </div>

          <Divider />

          <div className="flex items-center gap-0.5">
            {SUB_INDICATORS.map((ind) => (
              <ToolbarButton
                key={ind}
                active={activeIndicators?.includes(ind as Indicator)}
                onClick={() => onIndicatorToggle?.(ind as Indicator)}
                title={`Toggle ${ind} indicator`}
              >
                {ind}
              </ToolbarButton>
            ))}
          </div>

          {/* Chart Type - 移动端隐藏，仅桌面显示 */}
          <div className="hidden md:flex items-center gap-0.5">
            <Divider />
            {CHART_TYPES.map((type) => (
              <ToolbarButton
                key={type}
                active={activeChartType === type}
                onClick={() => onChartTypeChange?.(type)}
                title={`Switch to ${type} chart`}
              >
                {type}
              </ToolbarButton>
            ))}
          </div>
        </div>
      </div>

      {/* ========== Right Section: Actions (固定不滚动) ========== */}
      <div className="flex items-center gap-0.5 shrink-0 ml-1">
        <Divider />
        <IconButton
          icon={<Camera className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          onClick={onScreenshotClick}
          title="Take screenshot"
        />
        <IconButton
          icon={<Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          onClick={onSettingsClick}
          title="Chart settings"
        />
      </div>
    </div>
  );
}

export default memo(ChartToolbar);
