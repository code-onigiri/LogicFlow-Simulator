
/**
 * Pure logic operations for bitwise arrays.
 * Decouples the mathematical logic from the circuit state management.
 */

// Utility: Apply binary operation bit-by-bit
export const bitwiseOp = (
  a: boolean[], 
  b: boolean[] | null, 
  op: (x: boolean, y: boolean) => boolean
): boolean[] => {
    const len = a.length;
    // Safe fallback if b is missing or shorter
    const safeB = b || new Array(len).fill(false);
    
    const res = new Array(len);
    for(let i = 0; i < len; i++) {
        // Handle mismatched lengths by treating missing bits as false (0)
        const valB = i < safeB.length ? safeB[i] : false;
        res[i] = op(a[i], valB);
    }
    return res;
};

export const bitwiseNot = (a: boolean[]): boolean[] => a.map(v => !v);

export const gateNot = (input: boolean[]) => bitwiseNot(input);
export const gateAnd = (a: boolean[], b: boolean[]) => bitwiseOp(a, b, (x, y) => x && y);
export const gateOr = (a: boolean[], b: boolean[]) => bitwiseOp(a, b, (x, y) => x || y);
export const gateNand = (a: boolean[], b: boolean[]) => bitwiseNot(gateAnd(a, b));
export const gateNor = (a: boolean[], b: boolean[]) => bitwiseNot(gateOr(a, b));
export const gateXor = (a: boolean[], b: boolean[]) => bitwiseOp(a, b, (x, y) => x !== y);

export const splitBus = (input: boolean[], width: number): [boolean[], boolean[]] => {
    const half = Math.floor(width / 2);
    // Safety check
    if (input.length < width) {
        // Pad input if shorter than expected width
        const padded = [...input, ...new Array(width - input.length).fill(false)];
        return [padded.slice(0, half), padded.slice(half)];
    }
    return [input.slice(0, half), input.slice(half)];
};

export const mergeBus = (low: boolean[], high: boolean[], targetWidth: number): boolean[] => {
    const half = Math.floor(targetWidth / 2);
    // Pad or trim inputs to ensure they fit the half-width
    const safeLow = low.length === half ? low : [...low, ...new Array(Math.max(0, half - low.length)).fill(false)].slice(0, half);
    const safeHigh = high.length === half ? high : [...high, ...new Array(Math.max(0, half - high.length)).fill(false)].slice(0, half);
    return [...safeLow, ...safeHigh];
};
