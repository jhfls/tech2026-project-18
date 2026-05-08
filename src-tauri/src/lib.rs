#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(#[allow(unused_variables)] |app| {
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{WebViewExt, PermissionRequestExt};                
                let window = app.get_webview_window("main").unwrap();
                window.with_webview(|webview| {
                    let wk_webview = webview.inner();
                    wk_webview.connect_permission_request(|_, request| {
                        request.allow();
                        true
                    });
                }).unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
