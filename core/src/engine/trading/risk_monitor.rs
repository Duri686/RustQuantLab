//! # 风险监控模块
//!
//! 负责价格更新时的风险检查和强平触发。

use std::collections::HashMap;
use crate::risk::{LiquidationResult, RiskCalculator, RiskConfig, RiskLevel};
use crate::trading::{PositionManager, TradingAccount};
use crate::engine::types::EngineEvent;

/// 风险监控器
pub(crate) struct RiskMonitor;

impl RiskMonitor {
    /// 更新价格并执行风险检查，返回需要强平的仓位列表
    pub fn check_and_update(
        price: f64,
        current_price: &mut f64,
        symbol_prices: &mut HashMap<String, f64>,
        position_manager: &mut PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        risk_assessment: &mut Option<LiquidationResult>,
        pending_events: &mut Vec<EngineEvent>,
    ) -> Vec<String> {
        *current_price = price;
        symbol_prices.insert("BTCUSDT".to_string(), price);

        if position_manager.is_empty() {
            *risk_assessment = None;
            return Vec::new();
        }

        // 1. 更新所有仓位 PnL
        position_manager.update_pnl(symbol_prices);

        // 2. 计算维持保证金需求
        let (cross_mm, isolated_liquidations) = 
            position_manager.calculate_maintenance_requirements(symbol_prices, risk_config);
        
        // 3. 评估 Cross 模式账户风险
        let cross_liquidations = Self::evaluate_cross_risk(
            price, cross_mm, position_manager, account, risk_config, 
            risk_assessment, pending_events,
        );

        // 合并强平列表
        let mut to_liquidate = isolated_liquidations;
        to_liquidate.extend(cross_liquidations);
        to_liquidate
    }

    /// 评估 Cross 模式账户级别风险
    fn evaluate_cross_risk(
        price: f64,
        total_cross_mm: f64,
        position_manager: &PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        risk_assessment: &mut Option<LiquidationResult>,
        pending_events: &mut Vec<EngineEvent>,
    ) -> Vec<String> {
        let total_cross_pnl = position_manager.total_cross_unrealized_pnl();
        let account_equity = account.balance() + total_cross_pnl;
        
        let margin_ratio = if total_cross_mm > 0.0 {
            account_equity / total_cross_mm
        } else {
            f64::MAX
        };

        let risk_level = RiskCalculator::evaluate_risk_level(
            margin_ratio, risk_config.margin_warning_threshold,
        );

        // 计算净敞口（考虑对冲）
        let (net_long_size, net_short_size, avg_long_entry, avg_short_entry) = 
            position_manager.calculate_net_exposure();
        
        let net_exposure = net_long_size - net_short_size;
        
        // 根据净敞口计算强平价
        let cross_liq_price = if net_exposure.abs() < 0.0001 {
            // 完全对冲：强平价设为 0（无强平风险）
            0.0
        } else if net_exposure > 0.0 {
            // 净多头敞口
            RiskCalculator::calculate_cross_liquidation_price(
                avg_long_entry,
                account_equity,
                total_cross_mm,
                net_exposure,
                crate::trading::PositionSide::Long,
            )
        } else {
            // 净空头敞口
            RiskCalculator::calculate_cross_liquidation_price(
                avg_short_entry,
                account_equity,
                total_cross_mm,
                net_exposure.abs(),
                crate::trading::PositionSide::Short,
            )
        };

        let distance_pct = if cross_liq_price > 0.0 {
            ((price - cross_liq_price) / price * 100.0).abs()
        } else {
            100.0 // 完全对冲时，距离强平 100%
        };

        let is_liquidated = margin_ratio <= 1.0;

        *risk_assessment = Some(LiquidationResult {
            risk_level,
            margin_ratio,
            liquidation_price: cross_liq_price, // 使用全仓强平价
            distance_to_liquidation_pct: distance_pct,
            maintenance_margin: total_cross_mm,
            available_balance: account.calculate_available_balance(position_manager),
            is_liquidated,
            warning_message: Self::get_warning_message(risk_level),
        });

        // 发送风险预警事件
        if matches!(risk_level, RiskLevel::High | RiskLevel::Critical) {
            pending_events.push(EngineEvent::MarginWarning {
                symbol: "BTCUSDT".to_string(),
                risk_level: format!("{:?}", risk_level),
                margin_ratio,
                liquidation_price: cross_liq_price, // 使用全仓强平价
                distance_pct,
            });
        }

        // 触发全账户强平
        if is_liquidated {
            pending_events.push(EngineEvent::AccountRiskWarning {
                account_equity,
                total_maintenance_margin: total_cross_mm,
                risk_level: format!("{:?}", risk_level),
            });
            return position_manager.cross_position_symbols();
        }

        Vec::new()
    }

    fn get_warning_message(level: RiskLevel) -> Option<String> {
        match level {
            RiskLevel::Critical => Some("⚠️ 极高风险：即将触发强制平仓！".to_string()),
            RiskLevel::High => Some("⚠️ 高风险：请注意保证金水平".to_string()),
            RiskLevel::Medium => Some("注意：保证金率较低".to_string()),
            _ => None,
        }
    }
}
