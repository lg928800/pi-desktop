import { useEffect, useState } from "react";
import type { ApprovalRequest } from "@pi-desktop/shared";

interface Props {
	request: ApprovalRequest;
	onDecide: (confirmed: boolean) => void;
}

export function ApprovalDialog({ request, onDecide }: Props) {
	const [leftMs, setLeftMs] = useState(request.timeoutMs ?? null);

	useEffect(() => {
		if (!request.timeoutMs) return;
		const started = Date.now();
		const timer = setInterval(() => {
			setLeftMs(Math.max(0, request.timeoutMs! - (Date.now() - started)));
		}, 200);
		return () => clearInterval(timer);
	}, [request.requestId, request.timeoutMs]);

	return (
		<div className="modal-backdrop">
			<div className="modal">
				<h2>{request.title || "需要审批"}</h2>
				{request.detail && <pre className="modal-detail">{request.detail}</pre>}

				{request.options ? (
					<div className="modal-options">
						{request.options.map((option) => (
							<button key={option} onClick={() => onDecide(option === request.options![0])}>
								{option}
							</button>
						))}
					</div>
				) : (
					<div className="modal-actions">
						<button className="danger" onClick={() => onDecide(false)}>
							拒绝
						</button>
						<button className="primary" onClick={() => onDecide(true)}>
							允许
						</button>
					</div>
				)}

				{leftMs !== null && <p className="modal-timer">{(leftMs / 1000).toFixed(1)}s 后自动拒绝</p>}
				<p className="note">未应答时 agent 会阻塞在该动作上，不会自动放行。</p>
			</div>
		</div>
	);
}
