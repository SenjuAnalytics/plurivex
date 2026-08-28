mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_meta_table",
            sql: "CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_wallets_table",
            sql: "CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                encrypted_secret TEXT NOT NULL,
                fingerprint TEXT NOT NULL UNIQUE,
                address TEXT,
                word_count INTEGER,
                label TEXT,
                created_at TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_balances_table",
            sql: "CREATE TABLE IF NOT EXISTS balances (
                wallet_id INTEGER NOT NULL,
                chain TEXT NOT NULL,
                balance TEXT,
                updated_at TEXT,
                PRIMARY KEY (wallet_id, chain),
                FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_sol_address_column",
            sql: "ALTER TABLE wallets ADD COLUMN sol_address TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_token_balances_table",
            sql: "CREATE TABLE IF NOT EXISTS token_balances (
                wallet_id INTEGER NOT NULL,
                chain TEXT NOT NULL,
                token_symbol TEXT NOT NULL,
                token_name TEXT,
                balance TEXT NOT NULL,
                raw_balance TEXT,
                contract_address TEXT,
                updated_at TEXT,
                PRIMARY KEY (wallet_id, chain, token_symbol, contract_address),
                FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::rpc_get_balance,
            commands::rpc_get_sol_balance,
            commands::scan_balances,
            commands::get_chain_fee_data,
            commands::get_account_nonce_and_balance,
            commands::broadcast_raw_tx,
            commands::broadcast_solana_tx,
            commands::get_solana_recent_blockhash,
            commands::get_solana_account_details,
            commands::scan_directory_native
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:wallet_inspector.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}