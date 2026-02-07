/**
 * UI 文案术语表
 *
 * 规则:
 * 1. 行业标准术语保留英文 (Long/Short/USDT/BTC 等)
 * 2. 操作类文案使用中文
 * 3. 状态类文案使用中文
 */

export const UI_TEXT = {
    // 交易操作
    actions: {
        buyLong: '做多',
        sellShort: '做空',
        close: '平仓',
        closeAll: '全部平仓',
        addMargin: '追加保证金',
        cancelOrder: '撤单',
        cancelAll: '全部撤单',
        confirm: '确认',
        cancel: '取消',
        reset: '重置',
        expand: '展开',
        collapse: '收起',
    },

    // 风险等级
    riskLevel: {
        Safe: '安全',
        Low: '低风险',
        Medium: '中等风险',
        High: '高风险',
        Critical: '危险',
    },

    // 仓位状态
    position: {
        noPosition: '暂无持仓',
        openTip: '开仓以开始交易',
        unrealizedPnl: '未实现盈亏',
        realizedPnl: '已实现盈亏',
        entryPrice: '开仓均价',
        markPrice: '标记价格',
        liqPrice: '强平价格',
        estLiqPrice: '预估强平价',
        distToLiq: '距强平',
        marginRatio: '保证金率',
        leverage: '杠杆',
        size: '数量',
        notional: '名义价值',
        margin: '保证金',
        marginMode: {
            cross: '全仓',
            isolated: '逐仓',
        },
    },

    // 订单相关
    order: {
        orderType: '订单类型',
        market: '市价单',
        limit: '限价单',
        marketPrice: '市价',
        limitPrice: '限价',
        priceDeviation: '价格偏差',
        aboveMarket: '高于市价',
        belowMarket: '低于市价',
        pendingOrders: '挂单',
        orderHistory: '委托历史',
        filled: '已成交',
        cancelled: '已撤销',
    },

    // 账户相关
    account: {
        balance: '账户余额',
        availableBalance: '可用余额',
        equity: '账户权益',
        totalPnl: '总盈亏',
        resetBalance: '重置余额',
        resetConfirmTitle: '重置账户余额',
        resetConfirmMsg:
            '此操作将清空所有持仓和交易历史，余额重置为 10,000 USDT。此操作不可撤销。',
    },

    // 市场数据
    market: {
        change24h: '24h 涨跌',
        high24h: '24h 最高',
        low24h: '24h 最低',
        volume24h: '24h 成交量',
        fundingRate: '资金费率',
        countdown: '倒计时',
        nextFunding: '下次结算',
    },

    // 通用
    common: {
        loading: '加载中...',
        error: '出错了',
        retry: '重试',
        success: '成功',
        failed: '失败',
    },
} as const;

// 风险等级类型导出
export type RiskLevelKey = keyof typeof UI_TEXT.riskLevel;
