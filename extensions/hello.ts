import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("hello", {
		description: "Show a hello notification from this pi package",
		handler: async (args, ctx) => {
			const name = args.trim() || "pi";
			ctx.ui.notify(`Hello, ${name}!`, "info");
		},
	});

	pi.registerTool({
		name: "hello_package",
		label: "Hello Package",
		description: "Return a short greeting from this pi package.",
		promptSnippet: "Return a greeting from the installed package",
		parameters: Type.Object({
			name: Type.Optional(Type.String({ description: "Name to greet" })),
		}),
		async execute(_toolCallId, params) {
			const name = params.name?.trim() || "pi";
			return {
				content: [{ type: "text", text: `Hello, ${name}!` }],
				details: { name },
			};
		},
	});
}
