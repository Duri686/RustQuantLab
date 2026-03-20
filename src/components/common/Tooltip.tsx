import { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
}

function Tooltip({
    content,
    children,
    position = 'top',
    delay = 200,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number>();

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const padding = 8;

        let x = rect.left + rect.width / 2;
        let y = rect.top;

        switch (position) {
            case 'bottom':
                y = rect.bottom + padding;
                break;
            case 'left':
                x = rect.left - padding;
                y = rect.top + rect.height / 2;
                break;
            case 'right':
                x = rect.right + padding;
                y = rect.top + rect.height / 2;
                break;
            default: // top
                y = rect.top - padding;
        }

        setCoords({ x, y });
    };

    const handleMouseEnter = () => {
        timeoutRef.current = window.setTimeout(() => {
            updatePosition();
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="inline-flex"
            >
                {children}
            </div>
            {isVisible &&
                createPortal(
                    <div
                        className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-800 
                     rounded-lg shadow-lg max-w-xs animate-in fade-in zoom-in-95"
                        style={{
                            left: coords.x,
                            top: coords.y,
                            transform:
                                position === 'top'
                                    ? 'translate(-50%, -100%)'
                                    : position === 'bottom'
                                        ? 'translate(-50%, 0)'
                                        : position === 'left'
                                            ? 'translate(-100%, -50%)'
                                            : 'translate(0, -50%)',
                        }}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </>
    );
}

export default memo(Tooltip);
