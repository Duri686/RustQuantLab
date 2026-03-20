//! # 引擎错误类型
//!
//! 结构化错误枚举，替代散落的 `JsValue::from_str` 字符串错误。
//! 所有 WASM 边界错误统一通过此类型处理。

use std::fmt;
use wasm_bindgen::JsValue;

/// 引擎错误类型
#[derive(Debug)]
pub enum EngineError {
    /// 序列化失败 (Rust → JS)
    Serialize(String),
    /// 反序列化失败 (JS → Rust)
    Deserialize(String),
    /// 输入验证失败
    Validation(String),
    /// 解析失败 (如时间周期字符串)
    Parse(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EngineError::Serialize(msg) => write!(f, "序列化失败: {}", msg),
            EngineError::Deserialize(msg) => write!(f, "{}", msg),
            EngineError::Validation(msg) => write!(f, "{}", msg),
            EngineError::Parse(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<EngineError> for JsValue {
    fn from(err: EngineError) -> JsValue {
        JsValue::from_str(&err.to_string())
    }
}
