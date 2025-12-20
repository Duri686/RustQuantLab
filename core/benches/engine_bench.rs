//! # 性能基准测试
//!
//! 测试 K 线聚合和交易逻辑的性能，确保重构没有引入性能回退。

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use quant_core::MarketEngine;

/// Benchmark: 引擎初始化
fn bench_engine_creation(c: &mut Criterion) {
    c.bench_function("engine_new", |b| {
        b.iter(|| MarketEngine::new())
    });
}

/// Benchmark: 历史清除
fn bench_clear_history(c: &mut Criterion) {
    let mut group = c.benchmark_group("history_ops");
    
    group.bench_function("clear_history", |b| {
        let mut engine = MarketEngine::new();
        b.iter(|| {
            engine.clear_history();
        });
    });
    
    group.finish();
}

/// Benchmark: K 线数量获取
fn bench_candle_count(c: &mut Criterion) {
    let engine = MarketEngine::new();
    
    c.bench_function("get_candle_count", |b| {
        b.iter(|| engine.get_candle_count(black_box("1m")))
    });
}

/// Benchmark: 时间周期切换
fn bench_timeframe_switch(c: &mut Criterion) {
    c.bench_function("set_timeframe", |b| {
        let mut engine = MarketEngine::new();
        b.iter(|| {
            engine.set_timeframe(black_box("5m"));
        });
    });
    
    c.bench_function("get_timeframe", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.get_timeframe())
    });
}

/// Benchmark: 交易状态查询
fn bench_trading_state(c: &mut Criterion) {
    let mut group = c.benchmark_group("trading_state");
    
    group.bench_function("has_position", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.has_position())
    });
    
    group.bench_function("position_count", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.position_count())
    });
    
    group.bench_function("get_balance", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.get_balance())
    });
    
    group.bench_function("get_leverage", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.get_leverage())
    });
    
    group.finish();
}

/// Benchmark: 杠杆设置
fn bench_set_leverage(c: &mut Criterion) {
    c.bench_function("set_leverage", |b| {
        let mut engine = MarketEngine::new();
        b.iter(|| {
            engine.set_leverage(black_box(50));
        });
    });
}

/// Benchmark: 历史长度查询
fn bench_history_length(c: &mut Criterion) {
    c.bench_function("history_length", |b| {
        let engine = MarketEngine::new();
        b.iter(|| engine.history_length())
    });
}

criterion_group!(
    benches,
    bench_engine_creation,
    bench_clear_history,
    bench_candle_count,
    bench_timeframe_switch,
    bench_trading_state,
    bench_set_leverage,
    bench_history_length,
);

criterion_main!(benches);
