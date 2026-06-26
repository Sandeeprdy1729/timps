// ──────────────────────────────────────────────────────────────────────────────
// TIMPS Compute Engine — Rust-native accelerated math for memory operations.
// Phase 4d: replaces hot-path TypeScript compute with SIMD-friendly Rust.
// ──────────────────────────────────────────────────────────────────────────────

use napi_derive::napi;

const COSINE_DIM: usize = 768;

fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    let len = a.len().min(b.len());
    if len == 0 {
        return 0.0;
    }
    let mut dot = 0.0f64;
    let mut na = 0.0f64;
    let mut nb = 0.0f64;
    for i in 0..len {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = (na * nb).sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

fn cosine_distance(a: &[f64], b: &[f64]) -> f64 {
    1.0 - cosine_similarity(a, b)
}

/// Batch cosine similarity: compute scores between N vectors and a single query.
///
/// # Arguments
/// * `vectors` — flat f64 buffer of `[v0_0, v0_1, ..., v0_{d-1}, v1_0, ...]`
/// * `query` — flat f64 buffer of query vector (length `dims`)
/// * `count` — number of vectors in the batch
/// * `dims` — dimensionality of each vector
///
/// # Returns
/// `Float64Array` of similarity scores, one per vector.
#[napi]
pub fn compute_batch_similarity(
    vectors: Vec<f64>,
    query: Vec<f64>,
    count: i32,
    dims: i32,
) -> Vec<f64> {
    let n = count.max(0) as usize;
    let d = dims.max(0) as usize;
    if n == 0 || d == 0 || vectors.len() < n * d || query.len() < d {
        return vec![];
    }
    let mut scores = Vec::with_capacity(n);
    for i in 0..n {
        let start = i * d;
        let end = start + d;
        let slice = &vectors[start..end.min(vectors.len())];
        scores.push(cosine_similarity(slice, &query[..d]));
    }
    scores
}

/// K-means clustering on embedding vectors. Deterministic seeding via golden ratio.
///
/// # Arguments
/// * `embeddings` — flat f64 buffer of `[v0_0, ..., v0_{d-1}, v1_0, ...]`
/// * `count` — number of vectors
/// * `dims` — dimensionality
/// * `k` — number of clusters
/// * `max_iter` — optional max iterations (default 20)
///
/// # Returns
/// `Int32Array` of cluster assignments (0..k-1) per vector.
#[napi]
pub fn kmeans_cluster_flat(
    embeddings: Vec<f64>,
    count: i32,
    dims: i32,
    k: i32,
    max_iter: Option<i32>,
) -> Vec<i32> {
    let n = count.max(1) as usize;
    let d = dims.max(1) as usize;
    let kc = k.max(1).min(n as i32) as usize;
    let max_it = max_iter.unwrap_or(20).max(1) as usize;

    if embeddings.len() < n * d {
        return vec![0i32; n];
    }

    // Helper: get row vector
    let row = |idx: usize| -> &[f64] {
        let start = idx * d;
        &embeddings[start..start + d]
    };

    // k-means++ initialization with golden-ratio deterministic seeding
    let mut centroids: Vec<Vec<f64>> = Vec::with_capacity(kc);
    let seed = |offset: f64, i: usize| -> f64 {
        ((offset + 1.0) * (i as f64 + 1.0) * 0.618033988749895).sin() * 2.0 - 1.0
    };
    // First centroid: deterministic from first vector + seed
    {
        let f0 = row(0);
        let mut c0 = Vec::with_capacity(d);
        for j in 0..d {
            c0.push(f0[j] + seed(0.0, j) * 0.01);
        }
        centroids.push(c0);
    }
    // Remaining: distance-squared weighting
    for c in 1..kc {
        let mut dist_sqs: Vec<f64> = Vec::with_capacity(n);
        for i in 0..n {
            let v = row(i);
            let min_dist = centroids
                .iter()
                .map(|cen| cosine_distance(v, cen))
                .fold(f64::MAX, |a, b| a.min(b));
            dist_sqs.push(min_dist * min_dist);
        }
        let total: f64 = dist_sqs.iter().sum();
        if total == 0.0 {
            // All remaining points are at centroids — fill with perturbed copies
            for remaining in c..kc {
                let mut cr = Vec::with_capacity(d);
                let base = row(remaining % n);
                for j in 0..d {
                    cr.push(base[j] + seed(remaining as f64, j) * 0.01);
                }
                centroids.push(cr);
            }
            break;
        }
        let mut r = seed(c as f64, 0).abs() / 2.0 + 0.5; // (0..1)
        // Scale r by total
        r *= total;
        let mut cumulative = 0.0;
        let mut pick = n - 1;
        for (i, ds) in dist_sqs.iter().enumerate() {
            cumulative += ds;
            if r <= cumulative {
                pick = i;
                break;
            }
        }
        let v = row(pick);
        let mut cp = Vec::with_capacity(d);
        for j in 0..d {
            cp.push(v[j] + seed(c as f64 + 1000.0, j) * 0.001);
        }
        centroids.push(cp);
    }

    let mut assignments = vec![0usize; n];
    let mut changed = true;

    for _iter in 0..max_it {
        if !changed {
            break;
        }
        changed = false;

        // Assign each point to nearest centroid
        for i in 0..n {
            let v = row(i);
            let mut best_dist = f64::MAX;
            let mut best_c = assignments[i];
            for (c_idx, cen) in centroids.iter().enumerate() {
                let d = cosine_distance(v, cen);
                if d < best_dist {
                    best_dist = d;
                    best_c = c_idx;
                }
            }
            if assignments[i] != best_c {
                changed = true;
                assignments[i] = best_c;
            }
        }

        if !changed {
            break;
        }

        // Update centroids
        let mut sums: Vec<Vec<f64>> = vec![vec![0.0f64; d]; kc];
        let mut counts = vec![0usize; kc];
        for i in 0..n {
            let c = assignments[i];
            counts[c] += 1;
            let v = row(i);
            for j in 0..d {
                sums[c][j] += v[j];
            }
        }
        for c in 0..kc {
            if counts[c] > 0 {
                let norm = (0..d)
                    .map(|j| sums[c][j] * sums[c][j])
                    .sum::<f64>()
                    .sqrt();
                if norm > 0.0 {
                    for j in 0..d {
                        sums[c][j] /= norm;
                    }
                }
                centroids[c] = sums[c].clone();
            }
        }
    }

    assignments.iter().map(|&a| a as i32).collect()
}

/// Warm-started power iteration for eigenmode computation.
/// Matches the TypeScript `computeEigenpairsWarm` from HarmonicSheafWeaver.
///
/// # Arguments
/// * `n` — matrix dimension
/// * `i_indices` — row indices of Laplacian triples
/// * `j_indices` — column indices of Laplacian triples  
/// * `values` — values of Laplacian triples
/// * `k` — number of eigenpairs to compute
/// * `cached_values` — optional eigenvalues from previous computation (for warm start)
/// * `cached_vectors` — optional flat eigenvectors array (for warm start)
/// * `cached_n` — dimension of the cached matrix
/// * `max_iter` — max power iterations (default 8 for warm, 40 for cold)
///
/// # Returns
/// JSON string: `{"values": [v0, v1, ...], "vectors": [v0_0, v0_1, ..., v1_0, ...]}`
#[napi]
pub fn eigenmode_warm_start(
    n: i32,
    i_indices: Vec<i32>,
    j_indices: Vec<i32>,
    values: Vec<f64>,
    k: i32,
    cached_values: Option<Vec<f64>>,
    cached_vectors: Option<Vec<f64>>,
    cached_n: Option<i32>,
    max_iter: Option<i32>,
) -> String {
    let n = n.max(0) as usize;
    let k = k.max(1).min(n as i32) as usize;
    if n == 0 {
        return serde_json::json!({ "values": [], "vectors": [] }).to_string();
    }

    // Build triples
    let triples: Vec<(usize, usize, f64)> = i_indices
        .into_iter()
        .zip(j_indices.into_iter())
        .zip(values.into_iter())
        .map(|((i, j), v)| (i as usize, j as usize, v))
        .collect();

    let max_iter = max_iter.unwrap_or(8) as usize;

    // Find shift sigma (max diagonal via Gershgorin)
    let mut sigma = 0.0f64;
    for &(i, j, v) in &triples {
        if i == j && v > sigma {
            sigma = v;
        }
    }
    sigma += 1.0;

    // Build shifted matrix S = sigma*I - L
    let mut shifted: Vec<(usize, usize, f64)> = Vec::with_capacity(triples.len() + n);
    let mut diag_added = vec![false; n];
    for &(i, j, v) in &triples {
        if i == j {
            shifted.push((i, j, sigma - v));
            diag_added[i] = true;
        } else {
            shifted.push((i, j, -v));
        }
    }
    for i in 0..n {
        if !diag_added[i] {
            shifted.push((i, i, sigma));
        }
    }

    let prev_k = cached_values.as_ref().map_or(0, |v| v.len());
    let prev_n = cached_n.unwrap_or(0) as usize;
    let cache = cached_vectors.unwrap_or_default();

    let mut eigenvalues = vec![0.0f64; k];
    let mut eigenvectors = vec![0.0f64; n * k];

    // Deterministic seeding via golden ratio
    let det_seed = |vec_idx: usize, dim: usize| -> f64 {
        ((vec_idx + 1) as f64 * (dim + 1) as f64 * 0.618033988749895).sin()
    };

    for vec_idx in 0..k {
        // Initial vector: warm start from cache, or deterministic seed
        let mut v = vec![0.0f64; n];

        if vec_idx < prev_k && n >= prev_n {
            // Warm start: interpolate from cached eigenvectors
            for i in 0..prev_n.min(n) {
                v[i] = cache[i * prev_k + vec_idx];
            }
        } else {
            // Deterministic fallback
            for i in 0..n {
                v[i] = det_seed(vec_idx, i);
            }
        }

        // Normalize
        let norm = v.iter().map(|x| x * x).sum::<f64>().sqrt();
        if norm > 0.0 {
            for x in v.iter_mut() {
                *x /= norm;
            }
        }

        let mut eigenvalue = 0.0f64;

        for _iter in 0..max_iter {
            // Sparse matrix-vector multiply: w = S * v
            let mut w = vec![0.0f64; n];
            for &(i, j, val) in &shifted {
                w[i] += val * v[j];
            }

            // Deflate against previously found eigenvectors
            for prev in 0..vec_idx {
                let mut dot = 0.0;
                for i in 0..n {
                    dot += w[i] * eigenvectors[i * k + prev];
                }
                for i in 0..n {
                    w[i] -= dot * eigenvectors[i * k + prev];
                }
            }

            let norm = w.iter().map(|x| x * x).sum::<f64>().sqrt();
            eigenvalue = norm;
            if norm < 1e-12 {
                break;
            }
            for i in 0..n {
                v[i] = w[i] / norm;
            }
        }

        eigenvalues[vec_idx] = sigma - eigenvalue;
        for i in 0..n {
            eigenvectors[i * k + vec_idx] = v[i];
        }
    }

    serde_json::json!({
        "values": eigenvalues,
        "vectors": eigenvectors,
    })
    .to_string()
}
