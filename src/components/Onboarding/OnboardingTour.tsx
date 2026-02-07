import { memo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ============================================
   Constants
   ============================================ */
const ONBOARDING_KEY = 'rustquantlab_onboarding_complete';

interface TourStep {
    target: string; // CSS selector
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="leverage"]',
        title: '杠杆 (Leverage)',
        content:
            '杠杆放大您的交易规模。10x 杠杆意味着用 100 USDT 保证金可以开 1000 USDT 的仓位。高杠杆 = 高风险 = 高收益/亏损。',
        position: 'bottom',
    },
    {
        target: '[data-tour="margin-mode"]',
        title: '保证金模式',
        content:
            '全仓模式：所有仓位共享保证金，一个爆仓可能影响全部。逐仓模式：每个仓位独立保证金，风险隔离。',
        position: 'bottom',
    },
    {
        target: '[data-tour="liq-price"]',
        title: '强平价 (Liquidation)',
        content:
            '当价格触及强平价时，系统自动平仓以防止亏损超过保证金。距离强平价越近 = 风险越高。',
        position: 'left',
    },
    {
        target: '[data-tour="open-position"]',
        title: '开仓交易',
        content:
            '做多 (Long)：预期价格上涨获利。做空 (Short)：预期价格下跌获利。准备好开始模拟交易了吗？',
        position: 'top',
    },
];

/* ============================================
   Component
   ============================================ */
interface OnboardingTourProps {
    onComplete?: () => void;
}

function OnboardingTour({ onComplete }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [highlight, setHighlight] = useState<DOMRect | null>(null);

    // 检查是否需要显示引导
    useEffect(() => {
        const completed = localStorage.getItem(ONBOARDING_KEY);
        if (!completed) {
            // 延迟启动，等待 DOM 渲染
            setTimeout(() => setIsActive(true), 1000);
        }
    }, []);

    // 更新高亮位置
    useEffect(() => {
        if (!isActive) return;

        const step = TOUR_STEPS[currentStep];
        const element = document.querySelector(step.target);

        if (element) {
            const rect = element.getBoundingClientRect();
            setHighlight(rect);
        }
    }, [currentStep, isActive]);

    const handleNext = useCallback(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep((s) => s + 1);
        } else {
            // 完成引导
            localStorage.setItem(ONBOARDING_KEY, 'true');
            setIsActive(false);
            onComplete?.();
        }
    }, [currentStep, onComplete]);

    const handleSkip = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setIsActive(false);
        onComplete?.();
    }, [onComplete]);

    if (!isActive) return null;

    const step = TOUR_STEPS[currentStep];

    return createPortal(
        <div className="fixed inset-0 z-50">
            {/* 遮罩层 */}
            <div className="absolute inset-0 bg-black/70" onClick={handleSkip} />

            {/* 高亮区域 (镂空) */}
            {highlight && (
                <div
                    className="absolute bg-transparent border-2 border-yellow-400 rounded-lg
                     shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]"
                    style={{
                        left: highlight.left - 4,
                        top: highlight.top - 4,
                        width: highlight.width + 8,
                        height: highlight.height + 8,
                    }}
                />
            )}

            {/* Tooltip 内容 */}
            {highlight && (
                <div
                    className="absolute bg-gray-900 rounded-xl border border-gray-700 
                     shadow-2xl p-4 max-w-sm animate-in fade-in zoom-in-95"
                    style={{
                        left:
                            step.position === 'left'
                                ? highlight.left - 320
                                : step.position === 'right'
                                    ? highlight.right + 16
                                    : highlight.left,
                        top:
                            step.position === 'top'
                                ? highlight.top - 180
                                : step.position === 'bottom'
                                    ? highlight.bottom + 16
                                    : highlight.top,
                    }}
                >
                    {/* 步骤指示 */}
                    <div className="text-xs text-gray-500 mb-2">
                        步骤 {currentStep + 1} / {TOUR_STEPS.length}
                    </div>

                    {/* 标题 */}
                    <h4 className="text-lg font-semibold text-white mb-2">
                        {step.title}
                    </h4>

                    {/* 内容 */}
                    <p className="text-sm text-gray-400 mb-4">{step.content}</p>

                    {/* 按钮组 */}
                    <div className="flex justify-between">
                        <button
                            onClick={handleSkip}
                            className="text-sm text-gray-500 hover:text-gray-400"
                        >
                            跳过引导
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-4 py-2 text-sm font-medium text-black 
                         bg-yellow-400 hover:bg-yellow-300 rounded-lg"
                        >
                            {currentStep < TOUR_STEPS.length - 1 ? '下一步' : '开始交易'}
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
}

export default memo(OnboardingTour);
