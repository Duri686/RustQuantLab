import { useState, useCallback } from 'react';

/**
 * localStorage 持久化 Hook
 * @param key localStorage 键名
 * @param initialValue 初始值
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value: T | ((val: T) => T)) => {
        setStoredValue((prev) => {
            const valueToStore = value instanceof Function ? value(prev) : value;
            localStorage.setItem(key, JSON.stringify(valueToStore));
            return valueToStore;
        });
    }, [key]);

    return [storedValue, setValue] as const;
}
