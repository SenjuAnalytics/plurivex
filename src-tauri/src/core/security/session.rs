use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Auto-lock session manager for Plurivex Vault
pub struct SessionManager {
    is_locked: AtomicBool,
    last_activity_sec: AtomicU64,
    timeout_seconds: AtomicU64,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new(900) // Default 15 minutes (900 seconds)
    }
}

impl SessionManager {
    pub fn new(timeout_seconds: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Self {
            is_locked: AtomicBool::new(false),
            last_activity_sec: AtomicU64::new(now),
            timeout_seconds: AtomicU64::new(timeout_seconds),
        }
    }

    pub fn record_activity(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.last_activity_sec.store(now, Ordering::Relaxed);
    }

    pub fn lock(&self) {
        self.is_locked.store(true, Ordering::SeqCst);
    }

    pub fn unlock(&self) {
        self.is_locked.store(false, Ordering::SeqCst);
        self.record_activity();
    }

    pub fn is_locked(&self) -> bool {
        self.is_locked.load(Ordering::SeqCst)
    }

    pub fn check_idle_timeout(&self) -> bool {
        if self.is_locked() {
            return true;
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let last = self.last_activity_sec.load(Ordering::Relaxed);
        let timeout = self.timeout_seconds.load(Ordering::Relaxed);

        if now.saturating_sub(last) >= timeout {
            self.lock();
            true
        } else {
            false
        }
    }
}
