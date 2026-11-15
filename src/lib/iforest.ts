/**
 * Isolation Forest for the browser.
 *
 * A deterministic port of the algorithm scikit-learn uses (Liu, Ting & Zhou 2008):
 * each tree is grown on a subsample drawn without replacement, splits pick a random
 * non-constant feature and a uniform random threshold between its min and max,
 * trees stop at depth ceil(log2(max_samples)), and the score is
 * 2^(-mean path length / c(max_samples)) - the same quantity as
 * -IsolationForest.score_samples() in scikit-learn.
 *
 * It uses its own seeded random generator, so individual scores can differ slightly
 * from the scikit-learn run in engine.py.
 */

export type Rng = () => number;

/** Small, fast seeded PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box-Muller). */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const EULER_GAMMA = 0.5772156649015329;

/** Average path length of an unsuccessful BST search, as in scikit-learn. */
export function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
}

/** numpy.quantile with the default 'linear' method. */
export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

type TreeNode =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; threshold: number; left: TreeNode; right: TreeNode };

function shuffled(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function grow(X: number[][], idx: number[], depth: number, maxDepth: number, rng: Rng): TreeNode {
  if (depth >= maxDepth || idx.length <= 1) return { leaf: true, size: idx.length };
  for (const f of shuffled(X[0].length, rng)) {
    let min = Infinity;
    let max = -Infinity;
    for (const i of idx) {
      const v = X[i][f];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max <= min) continue; // constant feature in this node
    const threshold = min + rng() * (max - min);
    const left: number[] = [];
    const right: number[] = [];
    for (const i of idx) (X[i][f] <= threshold ? left : right).push(i);
    if (left.length === 0 || right.length === 0) continue;
    return {
      leaf: false, feature: f, threshold,
      left: grow(X, left, depth + 1, maxDepth, rng),
      right: grow(X, right, depth + 1, maxDepth, rng),
    };
  }
  return { leaf: true, size: idx.length };
}

function pathLength(x: number[], tree: TreeNode): number {
  let node = tree;
  let depth = 0;
  while (!node.leaf) {
    node = x[node.feature] <= node.threshold ? node.left : node.right;
    depth += 1;
  }
  return depth + averagePathLength(node.size);
}

export class IsolationForest {
  private trees: TreeNode[] = [];
  private psi = 0;

  constructor(
    readonly nEstimators = 300,
    readonly maxSamples = 256,
    readonly seed = 0,
  ) {}

  fit(X: number[][]): this {
    const rng = mulberry32(this.seed + 0x9e3779b9);
    this.psi = Math.min(this.maxSamples, X.length);
    const maxDepth = Math.ceil(Math.log2(Math.max(this.psi, 2)));
    this.trees = [];
    for (let t = 0; t < this.nEstimators; t++) {
      const idx = shuffled(X.length, rng).slice(0, this.psi);
      this.trees.push(grow(X, idx, 0, maxDepth, rng));
    }
    return this;
  }

  /** Anomaly score in (0, 1]; higher = more unusual. Equals -score_samples(). */
  score(x: number[]): number {
    let total = 0;
    for (const tree of this.trees) total += pathLength(x, tree);
    const mean = total / this.trees.length;
    return 2 ** (-mean / averagePathLength(this.psi));
  }
}
