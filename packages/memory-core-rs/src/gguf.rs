// ──────────────────────────────────────────────────────────────────────────────
// GGUF header parser — extracts real model metadata from GGUF model files.
//
// Implements the header (metadata) section of the GGUF container format used by
// llama.cpp. Reference: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
//
// Only the header metadata is parsed; tensor payload bytes are never touched.
// Header layout:
//   magic        u32 = 0x46554747 ("GGUF")
//   version      u32 (little-endian)
//   tensor_count u64
//   kv_count     u64
//   kv pairs     [key: u64 len + bytes, value_type: u32, value] × kv_count
//   tensors      ... (ignored)
//
// This replaces the filename-heuristic metadata inference that previously
// fabricated vocab/embedding/layer counts for LocalModel (audit M38).
// ──────────────────────────────────────────────────────────────────────────────

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

// GGUF metadata value types
const T_UINT8: u32 = 0;
const T_INT8: u32 = 1;
const T_UINT16: u32 = 2;
const T_INT16: u32 = 3;
const T_UINT32: u32 = 4;
const T_INT32: u32 = 5;
const T_FLOAT32: u32 = 6;
const T_BOOL: u32 = 7;
const T_STRING: u32 = 8;
const T_ARRAY: u32 = 9;
const T_UINT64: u32 = 10;
const T_INT64: u32 = 11;
const T_FLOAT64: u32 = 12;

/// Real metadata extracted from a GGUF header.
#[derive(Debug, Clone, Default)]
pub struct GgufMetadata {
    pub architecture: Option<String>,
    pub name: Option<String>,
    pub vocab_size: Option<u32>,
    pub embedding_size: Option<u32>,
    pub block_count: Option<u32>,
    pub context_length: Option<u32>,
    pub file_type: Option<u32>,
}

impl GgufMetadata {
    /// Human-readable quantization label derived from `general.file_type`.
    /// Returns `None` when the file type is absent or unknown.
    pub fn quantization(&self) -> Option<String> {
        let ft = self.file_type?;
        Some(match ft {
            0 => "F32".to_string(),
            1 => "F16".to_string(),
            2 => "Q4_0".to_string(),
            3 => "Q4_1".to_string(),
            6 => "Q5_0".to_string(),
            7 => "Q5_1".to_string(),
            8 => "Q8_0".to_string(),
            9 => "Q8_1".to_string(),
            10 => "Q2_K".to_string(),
            11 => "Q3_K_S".to_string(),
            12 => "Q3_K_M".to_string(),
            13 => "Q3_K_L".to_string(),
            14 => "Q4_K_S".to_string(),
            15 => "Q4_K_M".to_string(),
            16 => "Q5_K_S".to_string(),
            17 => "Q5_K_M".to_string(),
            18 => "Q6_K".to_string(),
            19 => "IQ2_XXS".to_string(),
            20 => "IQ2_XS".to_string(),
            21 => "Q2_K_S".to_string(),
            22 => "IQ3_XS".to_string(),
            23 => "IQ3_XXS".to_string(),
            24 => "IQ1_S".to_string(),
            25 => "IQ4_NL".to_string(),
            26 => "IQ3_S".to_string(),
            27 => "IQ3_M".to_string(),
            28 => "IQ2_S".to_string(),
            29 => "IQ2_M".to_string(),
            30 => "IQ4_XS".to_string(),
            31 => "IQ1_M".to_string(),
            32 => "BF16".to_string(),
            33 => "Q4_0_4_4".to_string(),
            34 => "Q4_0_4_8".to_string(),
            35 => "Q4_0_8_8".to_string(),
            _ => "Q?".to_string(),
        })
    }
}

struct HeaderReader {
    file: File,
    kv_count: u64,
}

fn open_header(path: &Path) -> Option<HeaderReader> {
    let mut f = File::open(path).ok()?;
    let mut magic = [0u8; 4];
    f.read_exact(&mut magic).ok()?;
    if &magic != b"GGUF" {
        return None;
    }
    let version = read_u32(&mut f)?;
    if version == 0 || version > 100 {
        return None;
    }
    let _tensor_count = read_u64(&mut f)?;
    let kv_count = read_u64(&mut f)?;
    if kv_count > 1_000_000 {
        return None;
    }
    Some(HeaderReader { file: f, kv_count })
}

fn read_exact_n<R: Read>(r: &mut R, n: usize) -> Option<Vec<u8>> {
    let mut buf = vec![0u8; n];
    r.read_exact(&mut buf).ok()?;
    Some(buf)
}

fn read_u8<R: Read>(r: &mut R) -> Option<u8> {
    let b = read_exact_n(r, 1)?;
    Some(b[0])
}

fn read_i8<R: Read>(r: &mut R) -> Option<i8> {
    read_u8(r).map(|v| v as i8)
}

fn read_u16<R: Read>(r: &mut R) -> Option<u16> {
    let b = read_exact_n(r, 2)?;
    Some(u16::from_le_bytes([b[0], b[1]]))
}

fn read_i16<R: Read>(r: &mut R) -> Option<i16> {
    let b = read_exact_n(r, 2)?;
    Some(i16::from_le_bytes([b[0], b[1]]))
}

fn read_u32<R: Read>(r: &mut R) -> Option<u32> {
    let b = read_exact_n(r, 4)?;
    Some(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn read_i32<R: Read>(r: &mut R) -> Option<i32> {
    let b = read_exact_n(r, 4)?;
    Some(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn read_u64<R: Read>(r: &mut R) -> Option<u64> {
    let b = read_exact_n(r, 8)?;
    Some(u64::from_le_bytes(b.as_slice().try_into().ok()?))
}

fn read_i64<R: Read>(r: &mut R) -> Option<i64> {
    let b = read_exact_n(r, 8)?;
    Some(i64::from_le_bytes(b.as_slice().try_into().ok()?))
}

fn read_str<R: Read>(r: &mut R) -> Option<String> {
    let len = read_u64(r)?;
    if len > (16 << 20) {
        // 16 MiB cap — sane bound for any metadata string key
        return None;
    }
    let b = read_exact_n(r, len as usize)?;
    String::from_utf8(b).ok()
}

/// Read a string scalar, or consume (skip) the value when its type is not a
/// string and return `None`.
fn read_str_or_skip<R: Read + Seek>(r: &mut R, value_type: u32) -> Option<String> {
    match value_type {
        T_STRING => read_str(r),
        _ => {
            skip_value(r, value_type)?;
            None
        }
    }
}

/// Consume a value of any type (including arrays) without retaining it.
fn skip_value<R: Read + Seek>(r: &mut R, value_type: u32) -> Option<()> {
    match value_type {
        T_UINT8 | T_INT8 | T_BOOL => {
            r.seek(SeekFrom::Current(1)).ok()?;
        }
        T_UINT16 | T_INT16 => {
            r.seek(SeekFrom::Current(2)).ok()?;
        }
        T_UINT32 | T_INT32 | T_FLOAT32 => {
            r.seek(SeekFrom::Current(4)).ok()?;
        }
        T_UINT64 | T_INT64 | T_FLOAT64 => {
            r.seek(SeekFrom::Current(8)).ok()?;
        }
        T_STRING => {
            let len = read_u64(r)?;
            if len > (1 << 30) {
                return None;
            }
            r.seek(SeekFrom::Current(len as i64)).ok()?;
        }
        T_ARRAY => {
            let elem_type = read_u32(r)?;
            let count = read_u64(r)?;
            for _ in 0..count.min(50_000_000) {
                skip_value(r, elem_type)?;
            }
        }
        _ => return None,
    }
    Some(())
}

/// Read an integer scalar into a `u64`, or consume (skip) the value when the
/// type is not an integer and return `None`.
fn read_uint_or_skip<R: Read + Seek>(r: &mut R, value_type: u32) -> Option<u64> {
    match value_type {
        T_UINT8 => Some(read_u8(r)? as u64),
        T_INT8 => Some(read_i8(r)? as u64),
        T_UINT16 => Some(read_u16(r)? as u64),
        T_INT16 => Some(read_i16(r)? as u64),
        T_UINT32 => Some(read_u32(r)? as u64),
        T_INT32 => Some(read_i32(r)? as u64),
        T_UINT64 => Some(read_u64(r)?),
        T_INT64 => Some(read_i64(r)? as u64),
        _ => {
            skip_value(r, value_type)?;
            None
        }
    }
}

/// First pass: find `general.architecture`, which scopes the model-specific
/// metadata keys (e.g. `llama.vocab_size`).
fn discover_architecture(path: &Path) -> Option<String> {
    let mut h = open_header(path)?;
    for _ in 0..h.kv_count {
        let key = read_str(&mut h.file)?;
        let value_type = read_u32(&mut h.file)?;
        if key == "general.architecture" {
            if let Some(s) = read_str_or_skip(&mut h.file, value_type) {
                return Some(s);
            }
            return None;
        }
        skip_value(&mut h.file, value_type)?;
    }
    None
}

/// Parse a GGUF header. Returns `None` when the path is not a readable GGUF
/// file. Missing keys are simply left as `None` in the returned metadata.
pub fn read_header(path: &Path) -> Option<GgufMetadata> {
    let architecture = discover_architecture(path);
    let mut h = open_header(path)?;

    let mut meta = GgufMetadata::default();
    meta.architecture = architecture.clone();

    let arch_prefix = architecture.map(|a| format!("{}.", a));

    for _ in 0..h.kv_count {
        let key = read_str(&mut h.file)?;
        let value_type = read_u32(&mut h.file)?;

        match key.as_str() {
            "general.name" => {
                if let Some(s) = read_str_or_skip(&mut h.file, value_type) {
                    meta.name = Some(s);
                }
            }
            "general.file_type" => {
                if let Some(v) = read_uint_or_skip(&mut h.file, value_type) {
                    meta.file_type = Some(v as u32);
                }
            }
            _ => {
                // Model-scoped keys follow the pattern `{arch}.{metric}`.
                if let Some(ref prefix) = arch_prefix {
                    if let Some(metric) = key.strip_prefix(prefix.as_str()) {
                        match metric {
                            "vocab_size" => {
                                if let Some(v) = read_uint_or_skip(&mut h.file, value_type) {
                                    meta.vocab_size = Some(v as u32);
                                }
                            }
                            "embedding_length" => {
                                if let Some(v) = read_uint_or_skip(&mut h.file, value_type) {
                                    meta.embedding_size = Some(v as u32);
                                }
                            }
                            "block_count" => {
                                if let Some(v) = read_uint_or_skip(&mut h.file, value_type) {
                                    meta.block_count = Some(v as u32);
                                }
                            }
                            "context_length" => {
                                if let Some(v) = read_uint_or_skip(&mut h.file, value_type) {
                                    meta.context_length = Some(v as u32);
                                }
                            }
                            _ => skip_value(&mut h.file, value_type)?,
                        }
                    } else {
                        skip_value(&mut h.file, value_type)?;
                    }
                } else {
                    skip_value(&mut h.file, value_type)?;
                }
            }
        }
    }

    Some(meta)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_gguf(temp_dir: &std::path::Path, kvs: &[(&str, u32, &[u8])]) -> std::path::PathBuf {
        // Build a minimal GGUF header: magic, version, tensor_count, kv_count,
        // then raw pre-serialized kv values.
        let mut data: Vec<u8> = Vec::new();
        data.extend_from_slice(b"GGUF");
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&0u64.to_le_bytes()); // tensor_count
        data.extend_from_slice(&(kvs.len() as u64).to_le_bytes());
        for (key, value_type, value) in kvs {
            data.extend_from_slice(&(key.len() as u64).to_le_bytes());
            data.extend_from_slice(key.as_bytes());
            data.extend_from_slice(&value_type.to_le_bytes());
            data.extend_from_slice(value);
        }
        let path = temp_dir.join("model.gguf");
        std::fs::write(&path, &data).unwrap();
        path
    }

    fn u32_bytes(v: u32) -> Vec<u8> {
        v.to_le_bytes().to_vec()
    }

    fn str_bytes(s: &str) -> Vec<u8> {
        let mut out = (s.len() as u64).to_le_bytes().to_vec();
        out.extend_from_slice(s.as_bytes());
        out
    }

    fn array_u32_bytes(elements: &[u32]) -> Vec<u8> {
        let mut out = T_UINT32.to_le_bytes().to_vec();
        out.extend_from_slice(&(elements.len() as u64).to_le_bytes());
        for e in elements {
            out.extend_from_slice(&e.to_le_bytes());
        }
        out
    }

    #[test]
    fn parses_llama_metadata() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_gguf(
            dir.path(),
            &[
                ("general.architecture", T_STRING, &str_bytes("llama")),
                ("general.name", T_STRING, &str_bytes("Llama 3.2 1B Instruct")),
                ("general.file_type", T_UINT32, &u32_bytes(15)),
                ("llama.vocab_size", T_UINT32, &u32_bytes(128256)),
                ("llama.embedding_length", T_UINT32, &u32_bytes(2048)),
                ("llama.block_count", T_UINT32, &u32_bytes(16)),
                ("llama.context_length", T_UINT32, &u32_bytes(8192)),
                ("llama.attention.head_count", T_UINT32, &u32_bytes(32)),
                ("llama.attention.layer_norm_rms_epsilon", T_FLOAT32, &0.00001f32.to_le_bytes()),
            ],
        );

        let meta = read_header(&path).expect("header should parse");
        assert_eq!(meta.architecture.as_deref(), Some("llama"));
        assert_eq!(meta.name.as_deref(), Some("Llama 3.2 1B Instruct"));
        assert_eq!(meta.vocab_size, Some(128256));
        assert_eq!(meta.embedding_size, Some(2048));
        assert_eq!(meta.block_count, Some(16));
        assert_eq!(meta.context_length, Some(8192));
        assert_eq!(meta.quantization().as_deref(), Some("Q4_K_M"));
    }

    #[test]
    fn skips_array_values_correctly() {
        // Architecture must be discoverable even when a large array (e.g. the
        // tokenizer vocab) appears before the arch-specific scalars.
        let dir = tempfile::tempdir().unwrap();
        let path = write_gguf(
            dir.path(),
            &[
                ("general.architecture", T_STRING, &str_bytes("qwen2")),
                ("tokenizer.ggml.tokens", T_ARRAY, &array_u32_bytes(&[1, 2, 3, 4])),
                ("qwen2.vocab_size", T_UINT32, &u32_bytes(151936)),
            ],
        );

        let meta = read_header(&path).expect("header should parse");
        assert_eq!(meta.architecture.as_deref(), Some("qwen2"));
        assert_eq!(meta.vocab_size, Some(151936));
    }

    #[test]
    fn rejects_non_gguf_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("not-a-model.gguf");
        std::fs::write(&path, b"THIS IS NOT GGUF DATA").unwrap();
        assert!(read_header(&path).is_none());
    }

    #[test]
    fn missing_file_returns_none() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_header(&dir.path().join("missing.gguf")).is_none());
    }

    #[test]
    fn unknown_file_type_quantization() {
        let meta = GgufMetadata {
            file_type: Some(999),
            ..Default::default()
        };
        assert_eq!(meta.quantization().as_deref(), Some("Q?"));
        assert!(GgufMetadata::default().quantization().is_none());
    }
}
