import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_GATEWAY_URL = 'http://localhost:3001';

// Suppress console errors for navigation in tests
const originalError = console.error;
console.error = (...args: any[]) => {
    // Check if any argument contains the navigation error message
    const hasNavigationError = args.some(arg => {
        if (typeof arg === 'string') {
            return arg.includes('Not implemented: navigation');
        }
        if (arg && typeof arg === 'object' && arg.message) {
            return arg.message.includes('Not implemented: navigation');
        }
        return false;
    });

    if (hasNavigationError) {
        return;
    }
    originalError.apply(console, args);
};
