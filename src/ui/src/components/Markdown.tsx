import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
	text: string;
}

/**
 * 助手输出按 Markdown 渲染。代码块加复制按钮，表格可横向滚动。
 */
export function MarkdownView({ text }: Props) {
	return (
		<div className="markdown">
			<Markdown
				remarkPlugins={[remarkGfm]}
				components={{
					a: ({ href, children }) => (
						<a href={href} target="_blank" rel="noreferrer noopener">
							{children}
						</a>
					),
					code: ({ className, children, ...props }) => {
						const inline = !className;
						if (inline) {
							return (
								<code className="inline-code" {...props}>
									{children}
								</code>
							);
						}
						return (
							<code className={className} {...props}>
								{children}
							</code>
						);
					},
					pre: ({ children }) => (
						<div className="code-block">
							<div className="code-bar">
								<span>代码</span>
								<CopyButton />
							</div>
							<pre>{children}</pre>
						</div>
					),
				}}
			>
				{text}
			</Markdown>
		</div>
	);
}

function CopyButton() {
	return (
		<button
			className="ghost-btn"
			onClick={(event) => {
				const pre = event.currentTarget.closest(".code-block")?.querySelector("pre");
				if (pre) void navigator.clipboard.writeText(pre.textContent ?? "");
			}}
		>
			复制
		</button>
	);
}
