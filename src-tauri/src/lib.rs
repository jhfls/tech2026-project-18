#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(#[allow(unused_variables)] |app| {
            #[cfg(target_os = "linux")] {
                // 引入 WebKit GTK 相关的 trait
                use tauri::Manager;
                use webkit2gtk::{WebViewExt, PermissionRequestExt};
                // 获取主窗口 (默认 label 是 "main")
                let window = app.get_webview_window("main").unwrap();
                // 获取底层的原生 webview 进行操作
                window.with_webview(|webview| {
                    let wk_webview = webview.inner();
                    // 拦截权限请求并自动调用 allow()
                    wk_webview.connect_permission_request(|_, request| {
                        request.allow(); // 自动授予摄像头/麦克风权限
                        true
                    });
                }).unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
