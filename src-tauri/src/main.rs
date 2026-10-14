#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

// Origin of the bundled shell page: Tauri 2 serves it from http://tauri.localhost on Windows
// (useHttpsScheme off) and from tauri://localhost on macOS/Linux.
#[cfg(windows)]
const SHELL_CHANGE_URL: &str = "http://tauri.localhost/?change";
#[cfg(not(windows))]
const SHELL_CHANGE_URL: &str = "tauri://localhost/?change";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let change = MenuItemBuilder::with_id("change-server", "Change server…")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let submenu = SubmenuBuilder::new(app, "App")
                .item(&change)
                .item(&reload)
                .separator()
                .quit()
                .build()?;
            // Without an Edit menu, Cmd+C / Cmd+V / Cmd+A do nothing inside the macOS webview.
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let menu = MenuBuilder::new(app).item(&submenu).item(&edit).build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "change-server" => {
                        if let Ok(url) = SHELL_CHANGE_URL.parse() {
                            let _ = window.navigate(url);
                        }
                    }
                    "reload" => {
                        let _ = window.eval("location.reload()");
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Money Manager desktop");
}
