import { memo } from 'react';
import Tooltip from './Tooltip';

interface HelpIconProps {
    content: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * HelpIcon - 带 Tooltip 的帮助图标
 *
 * 用于在关键术语旁显示 "?" 图标，hover 时展示解释
 */
function HelpIcon({ content, position = 'top' }: HelpIconProps) {
    return (
        <Tooltip content={content} position={position}>
            <span
                className="inline-flex items-center justify-center w-4 h-4 ml-1 
                       text-xs text-gray-500 hover:text-gray-400 cursor-help
                       rounded-full border border-gray-700 hover:border-gray-600
                       transition-colors"
            >
                ?
            </span>
        </Tooltip>
    );
}

export default memo(HelpIcon);
