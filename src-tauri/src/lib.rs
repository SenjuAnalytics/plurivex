pub mod adapters;
pub mod app;
pub mod core;
pub mod db;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = db::migrations::get_migrations();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app::commands::rpc_get_balance,
            app::commands::rpc_get_sol_balance,
            app::commands::scan_balances,
            app::commands::get_chain_fee_data,
            app::commands::get_account_nonce_and_balance,
            app::commands::broadcast_raw_tx,
            app::commands::broadcast_solana_tx,
            app::commands::get_solana_recent_blockhash,
            app::commands::get_solana_account_details,
            app::commands::scan_directory_native,
            app::commands::window_minimize,
            app::commands::window_toggle_maximize,
            app::commands::window_close,
            app::commands::schedule_clipboard_clear,
            app::commands::vault_encrypt,
            app::commands::vault_encrypt_batch,
            app::commands::vault_decrypt,
            app::commands::vault_create_token,
            app::commands::vault_verify_token,
            app::commands::vault_derive_credentials,
            app::commands::vault_derive_credentials_batch,
            app::commands::vault_validate_mnemonic,
            app::commands::vault_repair_mnemonic,
            app::commands::set_air_gapped_mode,
            app::commands::get_air_gapped_mode,
            app::commands::start_recovery_session,
            app::commands::pause_recovery_session,
            app::commands::resume_recovery_session,
            app::commands::cancel_recovery_session,
            app::commands::clear_recovery_session,
            app::commands::get_recovery_session_status,
            app::commands::scan_phrase_on_the_fly,
            app::commands::get_token_prices,
            app::commands::vault_extract_credentials
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
