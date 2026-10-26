import { useEffect, useRef } from "react";
import type { SessionView } from "../lib/session-view.ts";
import { Composer } from "./Composer.tsx";
import { ToolCard } from "./ToolCard.tsx";

interface Props {
	view: SessionView;
	onSend: (text: string, images: Array<{ type: "image"; data: string; mimeType: string }>) => Promise<void>;
	onAbort: () => Promise<void>;
}

export function Chat({ view, onSend, onAbort }: Props) {
	const bottom = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottom.current?.scrollIntoView({ block: "end" });
	}, [view.items.length, view.items.at(-1)]);

	return (
		<section className="chat">
			<div className="timeline">
				{view.items.length === 0 && (
					<p className="hint">
						{view.sessionId ? "会话已就绪，说点什么。" : "在左侧选一个任务开始会话。"}
					</p>
				)}

				{view.items.map((item) =>
					item.kind === "tool" ? (
						<ToolCard key={item.id} item={item} />
					) : (
						<article key={item.id} className={`msg ${item.role}`}>
							<div className="msg-role">{item.role === "user" ? "你" : "AI"}</div>
							<div className="msg-body">
								{item.text}
								{item.streaming && <span className="cursor">▌</span>}
							</div>
							{item.images.length > 0 && (
								<div className="msg-images">
									{item.images.map((image) => (
										<span key={image.ref} className="img-chip">
											🖼 {image.mimeType}
										</span>
									))}
								</div>
							)}
						</article>
					),
				)}
				<div ref={bottom} />
			</div>

			<Composer
				disabled={!view.sessionId}
				running={view.status === "running"}
				onSend={onSend}
				onAbort={onAbort}
			/>
		</section>
	);
}
