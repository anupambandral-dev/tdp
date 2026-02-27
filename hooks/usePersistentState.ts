import { useState, useEffect, useRef } from 'react';

/**
 * A hook that persists state in localStorage.
 * @param key The key to use in localStorage
 * @param initialState The initial state value
 * @returns [state, setState]
 */
export function usePersistentState<T>(key: string, initialState: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Initialize state from localStorage if available, otherwise use initialState
    const [state, setState] = useState<T>(() => {
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(`Error parsing persistent state for key "${key}":`, e);
            }
        }
        return initialState instanceof Function ? initialState() : initialState;
    });

    const isInitialMount = useRef(true);

    // Update localStorage whenever state or key changes
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (state === undefined || state === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(state));
        }
    }, [key, state]);

    // Handle visibility change to ensure data is saved when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                localStorage.setItem(key, JSON.stringify(state));
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [key, state]);

    return [state, setState];
}
