import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useLocalStorage Hook
 * Provides a synchronous, persistent state backed by window.localStorage.
 * 
 * Guarantees:
 * 1. Checks localStorage on initialization.
 * 2. If existing user data is found, uses it immediately without resetting.
 * 3. If no data exists, computes initialValue and seeds localStorage synchronously.
 * 4. Every state mutation writes to localStorage synchronously in real-time.
 * 5. Multi-tab synchronization via window 'storage' events.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state from localStorage or seed
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        if (item !== null && item !== 'undefined') {
          const parsed = JSON.parse(item);
          // If parsed data is valid (not null/empty when initial value is non-empty object)
          if (parsed !== null && parsed !== undefined) {
            return parsed;
          }
        }
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Error reading key "${key}":`, error);
    }

    // Evaluate initial fallback
    const valueToStore =
      typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;

    // Immediately seed into localStorage so data is guaranteed to exist
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Error seeding key "${key}":`, error);
    }

    return valueToStore;
  });

  // Reference for current value to guarantee functional updates have fresh state
  const valueRef = useRef<T>(storedValue);
  valueRef.current = storedValue;

  // Synchronous updater
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          typeof value === 'function' ? (value as (prev: T) => T)(valueRef.current) : value;

        valueRef.current = valueToStore;
        setStoredValue(valueToStore);

        // Synchronously persist to localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`[useLocalStorage] Error saving key "${key}":`, error);
      }
    },
    [key]
  );

  // Sync across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          valueRef.current = parsed;
          setStoredValue(parsed);
        } catch (err) {
          console.warn(`[useLocalStorage] Failed to parse storage event for key "${key}"`);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}

/**
 * useLocalStorageString Hook
 * Specialized for string values (theme, URLs, inspector name, session IDs)
 * stored as clean raw strings without JSON quotes.
 */
export function useLocalStorageString(
  key: string,
  initialValue: string | (() => string)
): [string, (value: string | ((prev: string) => string)) => void] {
  const [storedValue, setStoredValue] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        if (item !== null && item !== undefined) {
          return item;
        }
      }
    } catch (error) {
      console.warn(`[useLocalStorageString] Error reading key "${key}":`, error);
    }

    const valueToStore =
      typeof initialValue === 'function' ? (initialValue as () => string)() : initialValue;

    try {
      if (typeof window !== 'undefined' && valueToStore !== '') {
        window.localStorage.setItem(key, valueToStore);
      }
    } catch (error) {
      console.warn(`[useLocalStorageString] Error seeding key "${key}":`, error);
    }

    return valueToStore;
  });

  const valueRef = useRef<string>(storedValue);
  valueRef.current = storedValue;

  const setValue = useCallback(
    (value: string | ((prev: string) => string)) => {
      try {
        const valueToStore =
          typeof value === 'function'
            ? (value as (prev: string) => string)(valueRef.current)
            : value;

        valueRef.current = valueToStore;
        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, valueToStore);
        }
      } catch (error) {
        console.error(`[useLocalStorageString] Error saving key "${key}":`, error);
      }
    },
    [key]
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        valueRef.current = e.newValue;
        setStoredValue(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}
