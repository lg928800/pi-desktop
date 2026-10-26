//! 启动 Node bridge 子进程，并把 `{url, token}` 注入到页面。
//!
//! P1 只保证开发期可用：用 `npx tsx` 跑仓库里的 TS 源码。
//! TODO(P4 打包)：release 构建要改为随包分发已编译的 bridge，并把 node 运行时一起带上。

use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;

use tauri::Manager;

pub fn spawn(app: tauri::AppHandle) {
	thread::spawn(move || {
		let manifest = env!("CARGO_MANIFEST_DIR");
		let root = match std::path::Path::new(manifest).parent() {
			Some(root) => root.to_path_buf(),
			None => return,
		};
		let entry = root.join("src/bridge/src/main.ts");
		if !entry.exists() {
			eprintln!("[tauri] bridge entry not found: {}", entry.display());
			return;
		}

		let mut child = match Command::new("npx")
			.args(["tsx", entry.to_string_lossy().as_ref()])
			.current_dir(&root)
			.stdout(Stdio::piped())
			.stderr(Stdio::inherit())
			.spawn()
		{
			Ok(child) => child,
			Err(error) => {
				eprintln!("[tauri] failed to spawn bridge: {error}");
				return;
			}
		};

		let Some(stdout) = child.stdout.take() else { return };
		for line in BufReader::new(stdout).lines().map_while(Result::ok) {
			let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
			if value["type"] != "bridge.ready" {
				continue;
			}
			let url = serde_json::to_string(&value["url"]).unwrap_or_else(|_| "\"\"".into());
			let token = serde_json::to_string(&value["token"]).unwrap_or_else(|_| "\"\"".into());
			let script = format!(
				"window.__PI_DESKTOP__ = {{ url: {url}, token: {token} }}; window.dispatchEvent(new Event('pi-desktop-ready'));"
			);
			if let Some(window) = app.get_webview_window("main") {
				let _ = window.eval(&script);
			}
		}

		let _ = child.wait();
	});
}
