import { useState } from "react";
import { rememberEndpoint, resolveEndpoint, type BridgeEndpoint } from "../lib/bridge-client.ts";

interface Props {
	connection: "connecting" | "open" | "closed" | "idle";
	connecting: boolean;
	onConnect: (endpoint: BridgeEndpoint) => void;
}

export function ConnectBar({ connection, connecting, onConnect }: Props) {
	const existing = resolveEndpoint();
	const [token, setToken] = useState(existing?.token ?? "");
	const [url, setUrl] = useState(existing?.url ?? "ws://127.0.0.1:8787/");

	return (
		<div className="connect-bar">
			<span className="state">{connecting ? "连接中…" : "未连接"}</span>
			<input className="grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://127.0.0.1:8787/" />
			<input className="grow" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" />
			<button
				className="primary"
				onClick={() => {
					const endpoint = { url, token };
					rememberEndpoint(endpoint);
					onConnect(endpoint);
				}}
			>
				连接
			</button>
			<span className="dim">{connection === "closed" ? "连接已断开" : ""}</span>
		</div>
	);
}
