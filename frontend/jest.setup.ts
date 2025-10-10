import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_GATEWAY_URL = 'http://localhost:3001';

// Suppress console errors for navigation in tests
const originalError = console.error;
console.error = (...args: any[]) => {
    if (args[0]?.message?.includes('Not implemented: navigation')) {
        return;
    }
    originalError.apply(console, args);
};
