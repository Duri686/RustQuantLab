# Mock Market Data 算法设计文档

> 本文档详细描述了 RustQuantLab 项目中模拟加密货币市场数据生成器的核心算法设计与实现细节。

---

## 一、设计哲学

本模拟器的核心目标是 **生成在统计特征上接近真实加密货币市场的 K 线数据**，而非简单的随机游走。我们重点模拟了以下真实市场现象：

| 现象 | 描述 | 实现方式 |
|------|------|----------|
| **情绪速度不对称性** | 下跌如电梯，上涨如爬楼梯 | Wyckoff 阶段不同持续时间 |
| **杠杆清算与插针** | Scam Wicks, Cascade Liquidations | 微观趋势 V 型展开系统 |
| **市场操纵特征** | Bart Pattern, Fakeouts, Stop Hunts | 多事件触发与形态生成 |
| **技术指标响应** | 80% 遵循 MA/布林带，20% 破坏 | 概率性支撑阻力反弹 |
| **成交量-波动率解耦** | 无量空涨、放量滞涨 | VolumeMode 状态机 |
| **分形噪声** | 厚尾分布、跳空、极端波动 | Student's t 分布近似 |

---

## 二、核心模块架构

```
mockWorker.ts              ← 消息路由入口
└── marketSimulation/
    ├── index.ts           ← 统一导出
    ├── state.ts           ← 全局状态管理
    ├── constants.ts       ← 常量配置
    ├── types.ts           ← 类型定义
    ├── scheduler.ts       ← 实时数据调度器
    ├── history.ts         ← 历史 K 线批量生成
    ├── orderbook.ts       ← 订单簿实时生成
    ├── candles/           ← K 线核心生成器
    │   ├── generator.ts   ← 主生成逻辑
    │   ├── shadows.ts     ← 影线算法
    │   └── volume.ts      ← 成交量算法
    ├── manipulation/      ← 市场操纵模块
    │   ├── events.ts      ← 事件触发与初始化
    │   ├── bart.ts        ← Bart 形态生成
    │   ├── microTrend.ts  ← 微观趋势 V 型展开
    │   └── manipulationCandles.ts ← 操纵 K 线路由
    ├── wyckoff/           ← Wyckoff 周期状态机
    │   └── phase.ts       ← 阶段转换逻辑
    └── utils/             ← 工具函数
        ├── math.ts        ← 数学工具（厚尾随机数等）
        └── indicators.ts  ← 技术指标计算
```

---

## 三、Wyckoff 市场周期状态机

### 3.1 四阶段循环

我们采用经典的 **Wyckoff 市场周期理论**，将市场分为四个阶段循环：

```
┌──────────────┐     70%      ┌──────────────┐
│ ACCUMULATION │─────────────▶│    MARKUP    │
│    (吸筹)    │              │    (拉升)    │
└──────────────┘              └──────────────┘
       ▲                              │
       │ 50%                    50%   │
       │                              ▼
┌──────────────┐     70%      ┌──────────────┐
│   MARKDOWN   │◀─────────────│ DISTRIBUTION │
│    (下跌)    │              │    (派发)    │
└──────────────┘              └──────────────┘
```

### 3.2 阶段特征与参数

| 阶段 | 典型持续时间 | 价格 Drift | 波动率 | 成交量 |
|------|--------------|------------|--------|--------|
| ACCUMULATION | 1-4 小时 | +0.01%/根 | 0.6x | 1.2x-1.7x (放大不涨) |
| MARKUP | 30 分钟-2 小时 | +0.05%/根 (加速) | 0.7x-1.0x | 随趋势放大 |
| DISTRIBUTION | 1-3 小时 | -0.01%/根 | 0.7x | 1.3x-1.8x (放大不跌) |
| MARKDOWN | 15-60 分钟 | -0.1%/根 (加速) | 1.2x-1.7x | 恐慌放量 |

**关键设计：下跌阶段持续时间最短但跌速最快**，体现"电梯下楼梯"的市场特性。

### 3.3 阶段转换概率

```typescript
// ACCUMULATION 后：70% 进入拉升，30% 继续吸筹
// MARKUP 后：50% 进入派发，30% 继续拉升，20% 回调吸筹
// DISTRIBUTION 后：70% 进入下跌，30% 继续派发
// MARKDOWN 后：50% 进入吸筹，30% 继续下跌，20% 反弹派发
```

---

## 四、K 线价格生成算法

### 4.1 基础价格变化公式

```
ΔP = Drift + Random + Momentum + Inertia + TechnicalResponse + MeanReversion
```

各分量说明：

| 分量 | 公式 | 作用 |
|------|------|------|
| **Drift** | `phase_drift × dt_scale × acceleration` | 阶段趋势方向 |
| **Random** | `fatTailRandom() × baseVol` | 厚尾分布随机波动 |
| **Momentum** | `momentum × 0.0002 × dt_scale` | 动量延续 |
| **Inertia** | 同向增强 / 反向阻力 | 减少毛刺震荡 |
| **TechnicalResponse** | MA/布林带支撑阻力 | 80% 概率遵循 |
| **MeanReversion** | `-deviation × 0.0008 × dt_scale` | 长期均值回归 |

### 4.2 厚尾分布随机数 (Fat-Tail Random)

```typescript
function fatTailRandom(): number {
  // Box-Muller 变换生成正态分布
  const u1 = Math.random();
  const u2 = Math.random();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // 5% 概率生成极端值（厚尾特征）
  if (Math.random() < 0.05) {
    return normal * (2 + Math.random() * 2); // 2-4 倍放大
  }
  return normal;
}
```

### 4.3 价格惯性系统

```typescript
// 同向惯性增强
if (currentDirection === lastPriceDirection) {
  change *= (1 + INERTIA_STRENGTH × |momentum|);
}

// 反向阻力
if (currentDirection !== lastPriceDirection) {
  change *= (1 - INERTIA_STRENGTH × |momentum| × 0.5);
}
```

这确保了价格趋势的延续性，减少真实市场中不常见的剧烈来回震荡。

---

## 五、波动率时间分形约束

### 5.1 平方根法则

真实市场中，不同时间周期的波动率符合 **平方根法则**：

```
Range_T = Range_1m × √(T/1m)
```

例如：1 分钟振幅 0.1%，则 1 小时振幅约 0.77%（√60 × 0.1%）。

### 5.2 振幅限制配置

```typescript
// 1分钟K线振幅限制
MAX_RANGE_1M = 0.003;    // 最大 0.3%
NORMAL_RANGE_1M = 0.001; // 常规 0.1%

// 各周期缩放因子
VOLATILITY_SCALE = {
  60:    1.0,           // 1分钟基准
  300:   √5 ≈ 2.24,     // 5分钟
  900:   √15 ≈ 3.87,    // 15分钟
  3600:  √60 ≈ 7.75,    // 1小时
  14400: √240 ≈ 15.5,   // 4小时
  86400: √1440 ≈ 37.9,  // 1天
};
```

### 5.3 振幅限幅

```typescript
function clampPriceChange(change, timeframeSeconds, isExtremeEvent) {
  const scale = Math.sqrt(timeframeSeconds / 60);
  const maxChange = isExtremeEvent 
    ? MAX_RANGE_1M × scale × 1.5 
    : MAX_RANGE_1M × scale × 0.7;
  return clamp(change, -maxChange, maxChange);
}
```

---

## 六、影线生成算法

### 6.1 核心原则

**真实市场中，大部分 K 线影线都很短**。长影线（插针）是稀有事件，必须有触发条件。

### 6.2 影线类型分布

```
95% ─┬─ 70%: 几乎无影线 (实体饱满)
     ├─ 20%: 微小影线 (实体 2-5%)
     └─  5%: 短影线 (实体 5-15%)

 5% ─── 流动性异常时允许长影线
```

### 6.3 流动性状态触发

```typescript
type LiquidityState = 'NORMAL' | 'VACUUM_LOW' | 'VACUUM_HIGH';

// 判断逻辑
if (volumeRatio < 0.3) liquidityState = 'VACUUM_LOW';   // 成交量 < 30% 均值
if (volumeRatio > 2.5) liquidityState = 'VACUUM_HIGH';  // 成交量 > 250% 均值
```

**只有在流动性异常状态下，才允许生成较长影线**：

- `VACUUM_LOW`：订单簿被击穿，价格跳空
- `VACUUM_HIGH`：爆仓连环触发，价格剧烈波动

### 6.4 阶段影响

| 阶段 | 上影线 | 下影线 | 说明 |
|------|--------|--------|------|
| MARKUP | ×0.6 | ×0.7 | 实体饱满，压制影线 |
| MARKDOWN | ×0.7 | ×0.6 | 恐慌出逃，实体饱满 |
| ACCUMULATION | ×1.0 | ×1.05 | 略增下影线（吸筹试探） |
| DISTRIBUTION | ×1.05 | ×1.0 | 略增上影线（出货压力） |

---

## 七、市场操纵事件系统

### 7.1 事件类型

| 事件 | 描述 | 触发条件 | 持续时间 |
|------|------|----------|----------|
| `SCAM_WICK` | 插针扫损 | 价格接近布林带/关键位 + 流动性异常 | 5-15 根 |
| `BART_PATTERN` | 画门形态 | 派发阶段 + 低波动 | 30-80 根 |
| `CASCADE_LONG` | 多头连环爆仓 | 跌破布林下轨 + 高成交量 | 5-15 根 |
| `CASCADE_SHORT` | 空头连环爆仓 | 突破布林上轨 + 高成交量 | 5-15 根 |
| `STOP_HUNT_LOW` | 向下停损狩猎 | 箱体震荡中 | 5-15 根 |
| `STOP_HUNT_HIGH` | 向上停损狩猎 | 箱体震荡中 | 5-15 根 |
| `FAKEOUT_BULL` | 假突破向上 | 派发阶段 + 接近前高 | 4-12 根 |
| `FAKEOUT_BEAR` | 假突破向下 | 吸筹阶段 + 接近前低 | 4-12 根 |

### 7.2 触发概率

```typescript
// 基础触发概率
baseProbability = liquidityState !== 'NORMAL' ? 0.12 : 0.03;

// 大部分时间不触发任何事件，保持常规噪音
```

---

## 八、微观趋势 V 型展开系统

### 8.1 问题背景

传统模拟器中，插针事件在 **单根 K 线内完成**，导致 1 分钟 K 线出现不真实的长影线。

### 8.2 解决方案

将大的插针/波动事件分解为 **5-15 根 K 线的 V 型展开**：

```
4H 图看到：一根长下影线
1m 图看到：完美的 V 型底，每根 K 线影线都很短

         │
         │╲
         │ ╲
         │  ╲    PANIC (恐慌加速)
         │   ╲
         │    ╲
         │     ┼  CLIMAX (高潮换手)
         │    ╱
         │   ╱
         │  ╱     REVERSAL (反转回升)
         │ ╱
         │╱
         │
```

### 8.3 三阶段设计

| 阶段 | 占比 | 特征 | K 线形态 |
|------|------|------|----------|
| **PANIC** | 35% | 恐慌加速，实体逐渐增大 | 连续阴/阳线，影线极短 |
| **CLIMAX** | 15% | 高潮换手，极高成交量 | 十字星/小实体，略有双向影线 |
| **REVERSAL** | 50% | 逐渐收复，实体从大到小 | 反向连续 K 线，逐渐减弱 |

### 8.4 移动幅度计算

```typescript
// PANIC：指数加速（前小后大）
move = direction × (phaseTarget/duration) × (0.5 + progress^1.5);

// CLIMAX：波动剧烈但方向不明
move = direction × noise;

// REVERSAL：指数减速（前大后小）
move = -direction × (remainingMove/duration) × (0.8 + (1-progress^0.8) × 0.4);
```

---

## 九、成交量模式系统

### 9.1 五种成交量模式

| 模式 | 描述 | 成交量 | 典型场景 |
|------|------|--------|----------|
| `NORMAL` | 成交量与波动率正相关 | 1.0x + 波动加成 | 大部分时间 |
| `PAINT_TAPE_UP` | 无量空涨（诱多） | 0.3-0.6x | 低波动横盘后 |
| `PAINT_TAPE_DOWN` | 无量空跌（诱空） | 0.3-0.6x | 低波动横盘后 |
| `VOLUME_CLIMAX_TOP` | 放量滞涨（顶部信号） | 3-5x | 派发阶段后期 |
| `VOLUME_CLIMAX_BOTTOM` | 放量止跌（底部信号） | 3-5x | 吸筹阶段后期 |

### 9.2 阶段成交量倍数

```typescript
ACCUMULATION: 1.2 + phaseProgress × 0.5  // 逐渐放大
MARKUP:       1.0 + phaseProgress × 0.8  // 随趋势放大
DISTRIBUTION: 1.3 + random × 0.5         // 高位震荡
MARKDOWN:     1.5 + phaseProgress        // 恐慌放量
```

### 9.3 随机大单

```typescript
// 3% 概率出现大单
if (Math.random() < 0.03) {
  volume *= 3 + Math.random() × 4; // 3-7 倍放大
}
```

---

## 十、Bart 形态生成

### 10.1 形态结构

```
        ┌─────────────────────┐
        │   CONSOLIDATE       │  20-60 根（缩量锯齿）
        │   ～～～～～～～～   │
   ╱    │                     │    ╲
  ╱     └─────────────────────┘     ╲
 ╱ PUMP                              ╲ DUMP
╱  3-8 根                             ╲ 3-8 根
   (放量拉升)                          (放量砸盘)
```

### 10.2 阶段实现

```typescript
// PUMP：急速拉升 2-5%
close = startPrice + targetProgress + noise;
volume = avgVolume × (2-4);

// CONSOLIDATE：高位锯齿震荡
close = targetPrice + sin(progress × 0.5) × 0.5% + noise;
volume = avgVolume × (0.5-1); // 缩量

// DUMP：急速砸回原点
close = targetPrice - (targetPrice - startPrice) × progress;
volume = avgVolume × (2-4);
```

---

## 十一、技术指标响应

### 11.1 计算的指标

| 指标 | 周期 | 用途 |
|------|------|------|
| MA20 | 20 根 | 短期支撑阻力 |
| MA50 | 50 根 | 中期支撑阻力 |
| 布林带 | 20 周期, 2σ | 超买超卖边界 |
| recentHigh/Low | 50 根 | 关键支撑阻力位 |
| rangeHigh/Low | 20 根 | 箱体区间 |

### 11.2 响应逻辑 (80% 概率遵循)

```typescript
// MA20 附近 (0.2% 内)：减速 50%，80% 概率反弹
// MA50 附近 (0.3% 内)：减速 70%，85% 概率反弹
// 布林上轨：压力回落 80%
// 布林下轨：支撑反弹 80%
```

---

## 十二、实时数据调度

### 12.1 动态更新频率

```typescript
function getNextDelay(): number {
  let baseDelay = 500, variance = 500;

  switch (state.phase) {
    case 'MARKDOWN':
      baseDelay = 200; variance = 300;  // 恐慌时更新更快
      break;
    case 'MARKUP':
      if (phaseProgress > 0.7) {
        baseDelay = 300; variance = 400;  // 拉升末期加速
      }
      break;
  }

  if (currentEvent !== 'NONE') {
    baseDelay = 100; variance = 150;  // 操纵事件时加速
  }

  return baseDelay + random × variance;
}
```

### 12.2 订单簿生成

- 买卖各 50 档深度
- 价差随机 0.01-0.50
- 挂单量随深度递增 (`depthMultiplier = 1 + i × 0.15`)

---

## 十三、关键常量配置

```typescript
// 基础配置
SYMBOL = 'BTC-USDT';
BASE_PRICE = 40000.0;
LEVELS = 50;
PRICE_PRECISION = 100; // 精确到 0.01

// 波动率约束
MAX_RANGE_1M = 0.003;     // 1分钟最大振幅 0.3%
NORMAL_RANGE_1M = 0.001;  // 1分钟常规振幅 0.1%

// 动量系统
MOMENTUM_DECAY = 0.85;    // 动量衰减系数
INERTIA_STRENGTH = 0.15;  // 惯性强度
MAX_TICK_JUMP = 0.002;    // Tick级最大跳动 0.2%

// 影线分布
NOISE_WICK_PROB = 0.95;   // 95% 短影线
LOW_VOLUME_THRESHOLD = 0.3;  // 流动性真空阈值
HIGH_VOLUME_THRESHOLD = 2.5; // 流动性冲击阈值

// 微观趋势
WICK_EVENT_MIN_DURATION = 5;   // 插针最少 5 根 K 线
WICK_EVENT_MAX_DURATION = 15;  // 插针最多 15 根 K 线
V_REVERSAL_PHASES = [0.35, 0.15, 0.5]; // 恐慌/高潮/反转比例
```

---

## 十四、使用示例

### 14.1 启动实时数据

```typescript
worker.postMessage({
  type: 'START',
  payload: { interval: 500, startPrice: 42000 }
});

// 接收数据
worker.onmessage = (e) => {
  if (e.data.type === 'DATA') {
    const orderBook = e.data.payload;
    // { symbol, timestamp, price, bids, asks }
  }
};
```

### 14.2 请求历史 K 线

```typescript
worker.postMessage({
  type: 'GET_HISTORY',
  payload: { timeframeSeconds: 60, count: 500 }
});

// 接收历史数据
worker.onmessage = (e) => {
  if (e.data.type === 'HISTORY') {
    const candles = e.data.payload.candles;
    // [{ time, open, high, low, close, volume, tickCount }, ...]
  }
};
```

---

## 十五、总结

本模拟器通过以下核心机制，生成在统计特征上高度接近真实加密货币市场的数据：

1. **Wyckoff 周期状态机** → 宏观趋势结构
2. **波动率时间分形约束** → 多周期振幅一致性
3. **厚尾分布随机数** → 极端波动特征
4. **价格惯性系统** → 减少不真实的震荡
5. **流动性状态感知** → 控制影线长度
6. **微观趋势 V 型展开** → 真实的插针形态
7. **成交量模式解耦** → 量价背离信号
8. **技术指标响应** → 支撑阻力有效性

---

*文档版本: 1.0.0*  
*最后更新: 2025-12*  
*维护者: RustQuantLab Team*

