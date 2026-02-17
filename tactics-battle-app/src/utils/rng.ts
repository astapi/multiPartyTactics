export type Rng = () => number;

export const createSeededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

export const generateTimeSeed = (): number => Date.now() % 2147483647;
