//! # 平仓模块
//!
//! 负责平仓逻辑。

use crate::risk::{LiquidationResult, PositionSide};
use crate::trading::{PositionManager, TradeAction, TradingAccount};
use crate::engine::types::{ClosePositionResult, EngineEvent};

use super::TradingExecutor;

impl TradingExecutor {
    /// 平仓
    pub fn close_position(
        symbol: &str,
        exit_price: f64,
        close_size: Option<f64>,
        is_liquidation: bool,
        position_manager: &mut PositionManager,
        account: &mut TradingAccount,
        pending_events: &mut Vec<EngineEvent>,
        risk_assessment: &mut Option<LiquidationResult>,
    ) -> ClosePositionResult {
        let position = match position_manager.get(symbol).cloned() {
            Some(p) => p,
            None => return ClosePositionResult {
                success: false,
                message: format!("无持仓可平: {}", symbol),
                realized_pnl: 0.0,
                exit_price: 0.0,
                new_balance: account.balance(),
            },
        };

        let actual_close_size = close_size.unwrap_or(position.size).min(position.size);
        let opposite_side = match position.side {
            PositionSide::Long => PositionSide::Short,
            PositionSide::Short => PositionSide::Long,
        };

        let trade_result = match position_manager.apply_trade(symbol, opposite_side, actual_close_size, exit_price, 0.0) {
            Some(r) => r,
            None => return ClosePositionResult {
                success: false,
                message: format!("平仓失败: {}", symbol),
                realized_pnl: 0.0,
                exit_price: 0.0,
                new_balance: account.balance(),
            },
        };

        let (realized_pnl, is_fully_closed) = match &trade_result.action {
            TradeAction::Reduced { realized_pnl, remaining_size, closed_size } => {
                pending_events.push(EngineEvent::PositionReduced {
                    symbol: symbol.to_string(),
                    side: position.side.to_string(),
                    closed_size: *closed_size,
                    remaining_size: *remaining_size,
                    realized_pnl: *realized_pnl,
                });
                (*realized_pnl, false)
            }
            TradeAction::Closed { realized_pnl, .. } => (*realized_pnl, true),
            _ => (0.0, false),
        };

        account.update_balance(realized_pnl);

        if is_fully_closed {
            position_manager.move_to_history(symbol, exit_price, realized_pnl, is_liquidation);
            
            if symbol.contains("BTCUSDT") {
                *risk_assessment = None;
            }

            let event = if is_liquidation {
                EngineEvent::Liquidated {
                    symbol: position.symbol.clone(),
                    side: position.side.to_string(),
                    size: position.size,
                    entry_price: position.entry_price,
                    liquidation_price: position.liquidation_price,
                    lost_margin: position.margin,
                }
            } else {
                EngineEvent::PositionClosed {
                    symbol: position.symbol.clone(),
                    side: position.side.to_string(),
                    size: position.size,
                    entry_price: position.entry_price,
                    exit_price,
                    realized_pnl,
                }
            };
            pending_events.push(event);
        }

        ClosePositionResult {
            success: true,
            message: Self::build_close_message(&position, actual_close_size, exit_price, realized_pnl, is_liquidation, is_fully_closed),
            realized_pnl,
            exit_price,
            new_balance: account.balance(),
        }
    }

    fn build_close_message(
        position: &crate::trading::Position,
        size: f64,
        price: f64,
        pnl: f64,
        is_liquidation: bool,
        is_fully_closed: bool,
    ) -> String {
        if is_liquidation {
            format!("⚠️ 强制平仓: {} {:?} {:.4} @ {:.2}, 亏损 {:.2} USDT",
                position.symbol, position.side, size, price, pnl.abs())
        } else if is_fully_closed {
            format!("平仓成功: {} {:?} {:.4} @ {:.2}, 盈亏 {:.2} USDT",
                position.symbol, position.side, size, price, pnl)
        } else {
            format!("部分平仓: {} {:?} {:.4} @ {:.2}, 盈亏 {:.2} USDT",
                position.symbol, position.side, size, price, pnl)
        }
    }
}
