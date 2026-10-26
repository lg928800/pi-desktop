import { useState } from "react";
import { rememberEndpoint, resolveEndpoint, type BridgeEndpoint } from "../lib/bridge-client.ts";

interface Props {
	connection: "connecting" | "open" | "closed" | "idle";
	onConnect: (endpoint: BridgeEndpoint) => void;
}

export function ConnectBar({ connection, onConnect }: Props) {
	const existing = resolveEndpoint();
	const [token, setToken] = useState(existing?.token ?? "");
	const [url, setUrl] = useState(existing?.url ?? "ws://127.0.0.1:8787/");

	return (
		<div className="connect-bar">
			<span className="state">{connection === "connecting" ? "连接中…" : connection === "closed" ? "已断开" : "未连接"}</span>
			<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://127.0.0.1:8787/" />
			<input value={token} onChange={(e) => setToken(e.target.value)} placeholder="token（bridge 启动时打印）" />
			<button
				onClick={() => {
					const endpoint = { url, token };
					rememberEndpoint(endpoint);
					onConnect(endpoint);
				}}
			>
				连接
			</button>
		</div>
	);
}
