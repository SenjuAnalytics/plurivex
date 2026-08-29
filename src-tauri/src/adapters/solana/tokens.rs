pub fn solana_token_meta(mint: &str) -> (&'static str, &'static str) {
    match mint {
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => ("USDC", "USD Coin"),
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" => ("USDT", "Tether USD"),
        "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" => ("BONK", "Bonk"),
        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" => ("JUP", "Jupiter"),
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" => ("RAY", "Raydium"),
        "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" => ("WIF", "dogwifhat"),
        "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" => ("mSOL", "Marinade Staked SOL"),
        "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" => ("bSOL", "BlazeStake Staked SOL"),
        "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" => ("JitoSOL", "Jito Staked SOL"),
        _ => ("", "SPL Token"),
    }
}
