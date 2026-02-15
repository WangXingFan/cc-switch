//! 多 API Key 轮换器
//!
//! 维护每个 Provider 的轮询计数器（内存状态），
//! 根据调度策略（轮询/随机/固定）返回 Key 的尝试顺序。

use crate::provider::{KeyRotationStrategy, MultiKeyConfig};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::RwLock;

/// Key 轮换器
///
/// 为每个 Provider 维护一个轮询计数器，支持 RoundRobin、Random 和 Fixed 三种策略。
/// 线程安全：使用 `RwLock<HashMap>` + `AtomicUsize`。
pub struct KeyRotator {
    /// 每个 Provider 的轮询计数器（key: provider_id）
    counters: RwLock<HashMap<String, AtomicUsize>>,
}

impl KeyRotator {
    /// 创建新的 Key 轮换器
    pub fn new() -> Self {
        Self {
            counters: RwLock::new(HashMap::new()),
        }
    }

    /// 根据策略返回 Key 索引的尝试顺序
    ///
    /// # Arguments
    /// * `provider_id` - 供应商 ID
    /// * `config` - 多 Key 配置
    ///
    /// # Returns
    /// Key 索引的有序列表，调用方应按此顺序依次尝试
    pub fn select_key_order(&self, provider_id: &str, config: &MultiKeyConfig) -> Vec<usize> {
        let key_count = config.keys.len();
        if key_count == 0 {
            return vec![];
        }
        if key_count == 1 {
            return vec![0];
        }

        let start = match config.strategy {
            KeyRotationStrategy::RoundRobin => self.next_round_robin(provider_id, key_count),
            KeyRotationStrategy::Random => self.random_start(key_count),
            KeyRotationStrategy::Fixed => {
                // 固定模式：使用用户指定的索引，越界则回退到 0
                config.fixed_index.unwrap_or(0).min(key_count - 1)
            }
        };

        // 从 start 位置开始，依次遍历所有 Key
        (0..key_count).map(|i| (start + i) % key_count).collect()
    }

    /// RoundRobin：获取下一个计数器位置并自增
    fn next_round_robin(&self, provider_id: &str, key_count: usize) -> usize {
        // 先尝试读锁
        {
            let counters = self.counters.read().unwrap();
            if let Some(counter) = counters.get(provider_id) {
                return counter.fetch_add(1, Ordering::Relaxed) % key_count;
            }
        }

        // 不存在则写锁创建
        let mut counters = self.counters.write().unwrap();
        let counter = counters
            .entry(provider_id.to_string())
            .or_insert_with(|| AtomicUsize::new(0));
        counter.fetch_add(1, Ordering::Relaxed) % key_count
    }

    /// Random：随机选择起始位置
    fn random_start(&self, key_count: usize) -> usize {
        // 使用简单的伪随机：基于当前时间纳秒
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos() as usize;
        nanos % key_count
    }
}

impl Default for KeyRotator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::KeyRotationStrategy;

    fn make_config(keys: Vec<&str>, strategy: KeyRotationStrategy) -> MultiKeyConfig {
        MultiKeyConfig {
            keys: keys.into_iter().map(|s| s.to_string()).collect(),
            strategy,
            fixed_index: None,
        }
    }

    fn make_fixed_config(keys: Vec<&str>, fixed_index: Option<usize>) -> MultiKeyConfig {
        MultiKeyConfig {
            keys: keys.into_iter().map(|s| s.to_string()).collect(),
            strategy: KeyRotationStrategy::Fixed,
            fixed_index,
        }
    }

    #[test]
    fn test_empty_keys() {
        let rotator = KeyRotator::new();
        let config = make_config(vec![], KeyRotationStrategy::RoundRobin);
        let order = rotator.select_key_order("p1", &config);
        assert!(order.is_empty());
    }

    #[test]
    fn test_single_key() {
        let rotator = KeyRotator::new();
        let config = make_config(vec!["key1"], KeyRotationStrategy::RoundRobin);
        let order = rotator.select_key_order("p1", &config);
        assert_eq!(order, vec![0]);
    }

    #[test]
    fn test_round_robin_cycles() {
        let rotator = KeyRotator::new();
        let config = make_config(vec!["k1", "k2", "k3"], KeyRotationStrategy::RoundRobin);

        // 第一次调用：从 0 开始
        let order1 = rotator.select_key_order("p1", &config);
        assert_eq!(order1.len(), 3);
        assert_eq!(order1[0], 0); // 起始位置 0

        // 第二次调用：从 1 开始
        let order2 = rotator.select_key_order("p1", &config);
        assert_eq!(order2[0], 1);

        // 第三次调用：从 2 开始
        let order3 = rotator.select_key_order("p1", &config);
        assert_eq!(order3[0], 2);

        // 第四次调用：回到 0
        let order4 = rotator.select_key_order("p1", &config);
        assert_eq!(order4[0], 0);
    }

    #[test]
    fn test_round_robin_covers_all_keys() {
        let rotator = KeyRotator::new();
        let config = make_config(vec!["k1", "k2", "k3"], KeyRotationStrategy::RoundRobin);

        let order = rotator.select_key_order("p1", &config);
        // 应该包含所有索引
        let mut sorted = order.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2]);
    }

    #[test]
    fn test_different_providers_independent() {
        let rotator = KeyRotator::new();
        let config = make_config(vec!["k1", "k2"], KeyRotationStrategy::RoundRobin);

        let order_p1 = rotator.select_key_order("p1", &config);
        let order_p2 = rotator.select_key_order("p2", &config);

        // 两个 Provider 的计数器独立，都从 0 开始
        assert_eq!(order_p1[0], 0);
        assert_eq!(order_p2[0], 0);
    }

    #[test]
    fn test_random_covers_all_keys() {
        let rotator = KeyRotator::new();
        let config = make_config(vec!["k1", "k2", "k3"], KeyRotationStrategy::Random);

        let order = rotator.select_key_order("p1", &config);
        assert_eq!(order.len(), 3);

        // 应该包含所有索引（只是起始位置不同）
        let mut sorted = order.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2]);
    }

    #[test]
    fn test_fixed_uses_specified_index() {
        let rotator = KeyRotator::new();
        let config = make_fixed_config(vec!["k1", "k2", "k3"], Some(1));

        // 固定模式：始终从 index 1 开始
        let order1 = rotator.select_key_order("p1", &config);
        assert_eq!(order1[0], 1);
        assert_eq!(order1, vec![1, 2, 0]);

        // 再次调用依然从 index 1 开始（无状态）
        let order2 = rotator.select_key_order("p1", &config);
        assert_eq!(order2[0], 1);
    }

    #[test]
    fn test_fixed_default_index_zero() {
        let rotator = KeyRotator::new();
        let config = make_fixed_config(vec!["k1", "k2", "k3"], None);

        // 未设置 fixed_index 时默认使用 0
        let order = rotator.select_key_order("p1", &config);
        assert_eq!(order[0], 0);
    }

    #[test]
    fn test_fixed_out_of_bounds_clamps() {
        let rotator = KeyRotator::new();
        let config = make_fixed_config(vec!["k1", "k2", "k3"], Some(99));

        // 越界时钳位到最后一个 key
        let order = rotator.select_key_order("p1", &config);
        assert_eq!(order[0], 2);
    }
}
