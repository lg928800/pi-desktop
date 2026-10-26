//! 启动 Node bridge 子进程，并把 `{url, token}` 注入到页面。
//!
//! 关键点：从 Finder 双击启动时进程 PATH 只有 `/usr/bin:/bin`，
//! 找不到 npx / node。所以这里显式补齐 PATH，并允许用环境变量覆盖启动方式。
//!
//! 跨平台：
//!  - Windows 上 npx 实为 npx.cmd，需要 `cmd /C` 走 shell；
//!  - 仓库根目录优先取 `PI_DESKTOP_ROOT`，其次取编译期路径（开发机可用）。
//!
//! TODO(P4 打包)：release 版本应随包分发已编译的 bridge（bun/node 单文件），
//! 通过 `PI_DESKTOP_BRIDGE_CMD` 指向包内可执行文件，从而不再依赖仓库与 npx。

use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;

use tauri::Manager;

fn repo_root() -> Option<std::path::PathBuf> {
	if let Ok(root) = std::env::var("PI_DESKTOP_ROOT") {
		return Some(std::path::PathBuf::from(root));
	}
	// 编译期写入的仓库路径：同一台机器上开发/自用足够
	std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
		.parent()
		.map(|p| p.to_path_buf())
}

/// Finder 启动时 PATH 不完整，这里把常见位置补上
fn augmented_path() -> String {
	let home = std::env::var("HOME").unwrap_or_default();
	let current = std::env::var("PATH").unwrap_or_default();
	if cfg!(target_os = "windows") {
		let home = std::env::var("USERPROFILE").unwrap_or(home);
		format!(
			r"C:\Program Files\nodejs;{home}\AppData\Roaming\npm;{home}\.local\bin;{current}"
		)
	} else {
		format!(
			"{home}/.local/bin:{home}/.cargo/bin:{home}/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{current}"
		)
	}
}

pub fn spawn(app: tauri::AppHandle) {
	thread::spawn(move || {
		let Some(root) = repo_root() else {
			eprintln!("[tauri] cannot resolve repo root");
			return;
		};

		let env_path = augmented_path();
		let mut command = if let Ok(custom) = std::env::var("PI_DESKTOP_BRIDGE_CMD") {
			// 打包后：直接指向随包分发的 bridge 可执行文件
			let mut cmd = Command::new(custom);
			cmd.arg("--stdio-ready");
			cmd
		} else {
			let entry = root.join("src/bridge/src/main.ts");
			if !entry.exists() {
				eprintln!("[tauri] bridge entry not found: {}", entry.display());
				return;
			}
			let mut cmd = Command::new("npx");
			cmd.args(["tsx", entry.to_string_lossy().as_ref()]);
			cmd
		};

		let mut child = match command
			.current_dir(&root)
			.env("PATH", &env_path)
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
