#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

// Origin of the bundled shell page on Windows (Tauri 2 default, useHttpsScheme off).
const SHELL_CHANGE_URL: &str = "http://tauri.localhost/?change";

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
            let menu = MenuBuilder::new(app).item(&submenu).build()?;
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
