/**
 * P0 审批测试扩展（一次性验证用，不进主干）
 *
 * 拦截含 P0_APPROVE 标记的 bash 调用，先 notify 再 confirm。
 * 目的：验证 tool_call 钩子 → RPC extension_ui_request → 客户端应答 → 命令放行 这条链路。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = String((event.input as { command?: unknown })?.command ?? "");
		if (!command.includes("P0_APPROVE")) return undefined;

		ctx.ui.notify(`[P0] gate hit: ${command}`, "info");

		const approved = await ctx.ui.confirm("P0 审批测试", `允许执行这条命令吗？\n\n${command}`);

		return approved ? undefined : { block: true, reason: "P0: blocked by user" };
	});
}
