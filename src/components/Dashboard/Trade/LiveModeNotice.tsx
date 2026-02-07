import { memo } from 'react';

interface LiveModeNoticeProps {
    onSwitchToMock?: () => void;
}

/**
 * LiveModeNotice - LIVE 模式交易提示
 *
 * 在 Binance 实时行情模式下显示，提示用户切换至 Mock 模式进行模拟交易
 */
function LiveModeNotice({ onSwitchToMock }: LiveModeNoticeProps) {
    return (
        <div
            className="flex flex-col items-center justify-center h-full min-h-[300px] 
                    p-6 text-center"
        >
            {/* 图标 */}
            <div
                className="w-16 h-16 mb-4 rounded-full bg-blue-500/10 
                      flex items-center justify-center"
            >
                <svg
                    className="w-8 h-8 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            </div>

            {/* 标题 */}
            <h3 className="text-lg font-semibold text-white mb-2">实时行情模式</h3>

            {/* 说明 */}
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
                当前连接 Binance 实时行情，仅供观察学习。
                <br />
                如需模拟交易，请切换至 Mock 模式。
            </p>

            {/* 切换按钮 */}
            {onSwitchToMock && (
                <button
                    type="button"
                    onClick={onSwitchToMock}
                    className="px-6 py-2.5 text-sm font-medium text-white 
                     bg-linear-to-r from-yellow-500 to-yellow-600 
                     hover:from-yellow-400 hover:to-yellow-500
                     rounded-lg transition-all shadow-lg shadow-yellow-500/20"
                >
                    切换至 Mock 模式
                </button>
            )}

            {/* 补充说明 */}
            <p className="text-xs text-gray-500 mt-4 max-w-xs">
                💡 Mock 模式使用模拟数据，安全无风险
            </p>
        </div>
    );
}

export default memo(LiveModeNotice);
