use serde::{Deserialize, Serialize};
use std::fs;
use sysinfo::Disks;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[derive(Serialize, Deserialize, Debug)]
pub struct UsbDeviceInfo {
    pub is_connected: bool,
    pub mount_path: String,
    pub volume_name: String,
    pub match_files: Vec<String>,
    pub pit_files: Vec<String>,
    pub photo_files: Vec<String>,
}

// Removed `pub` here to prevent macro symbol collision in lib.rs
#[tauri::command]
fn detect_usb_drives() -> Vec<UsbDeviceInfo> {
    let mut detected_drives = Vec::new();
    let disks = Disks::new_with_refreshed_list();

    for disk in &disks {
        let mount_point = disk.mount_point();
        let mount_str = mount_point.to_string_lossy().to_string();

        // Filter for removable media across Windows, macOS, and Linux
        let is_removable = disk.is_removable()
            || mount_str.contains("/media/")
            || mount_str.contains("/Volumes/")
            || (cfg!(windows) && mount_str != "C:\\");

        if is_removable {
            let mut match_files = Vec::new();
            let mut pit_files = Vec::new();
            let mut photo_files = Vec::new();

            if let Ok(entries) = fs::read_dir(mount_point) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        let lower_name = file_name.to_lowercase();

                        if lower_name.ends_with(".csv")
                            || lower_name.ends_with(".json")
                            || lower_name.ends_with(".txt")
                        {
                            if lower_name.contains("pit") {
                                pit_files.push(file_name.to_string());
                            } else {
                                match_files.push(file_name.to_string());
                            }
                        } else if lower_name.ends_with(".jpg")
                            || lower_name.ends_with(".jpeg")
                            || lower_name.ends_with(".png")
                            || lower_name.ends_with(".webp")
                        {
                            photo_files.push(file_name.to_string());
                        }
                    }
                }
            }

            detected_drives.push(UsbDeviceInfo {
                is_connected: true,
                mount_path: mount_str,
                volume_name: disk.name().to_string_lossy().to_string(),
                match_files,
                pit_files,
                photo_files,
            });
        }
    }

    detected_drives
}

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
        .invoke_handler(tauri::generate_handler![detect_usb_drives])
        .run(tauri::generate_context!())
        .expect("error while running ShamStrategy Node E application");
}