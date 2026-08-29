// Fingerprint deduplication
pub fn calculate_fingerprint(data: &str) -> String {
    format!("{:x}", data.len())
}
