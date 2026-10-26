mod bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_dialog::init())
		.setup(|app| {
			bridge::spawn(app.handle().clone());
			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("failed to run pi-desktop");
}
