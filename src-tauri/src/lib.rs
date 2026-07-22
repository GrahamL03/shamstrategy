use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "enable_wal_mode_and_foreign_keys",
            sql: r#"
                PRAGMA journal_mode = WAL;
                PRAGMA foreign_keys = ON;
                PRAGMA synchronous = NORMAL;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_shamstrategy_v2_schema",
            sql: include_str!("../../src/db/schema.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:shamstrategy.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running ShamStrategy Node E application");
}