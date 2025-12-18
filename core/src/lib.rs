use wasm_bindgen::prelude::*;

/// 初始化 panic hook，将 Rust panic 信息输出到浏览器控制台
/// 便于调试 WebAssembly 错误
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// 初始化 Wasm 模块
/// 在 JavaScript 侧调用其他函数前需先调用此函数
#[wasm_bindgen(start)]
pub fn init() {
    set_panic_hook();
}

/// 问候函数 - 用于测试 Rust 与 JavaScript 的通信
/// 
/// # Arguments
/// * `name` - 要问候的名称
/// 
/// # Returns
/// 返回包含问候语的字符串
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! This is Rust speaking from WebAssembly. 🦀", name)
}

/// 简单的加法运算 - 演示数值计算
/// 
/// # Arguments
/// * `a` - 第一个数字
/// * `b` - 第二个数字
/// 
/// # Returns
/// 返回两数之和
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert!(result.contains("World"));
    }

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}
