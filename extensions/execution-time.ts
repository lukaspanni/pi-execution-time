import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "execution-time";
const UPDATE_INTERVAL_MS = 250;

type TimerState = {
	startedAt: number;
	interval: ReturnType<typeof setInterval>;
};

export default function (pi: ExtensionAPI) {
	let timer: TimerState | undefined;

	function stopTimer() {
		if (!timer) return;
		clearInterval(timer.interval);
		timer = undefined;
	}

	function renderRunning(ctx: ExtensionContext) {
		if (!timer) return;
		const elapsedMs = Date.now() - timer.startedAt;
		const icon = ctx.ui.theme.fg("accent", "⏱");
		const text = ctx.ui.theme.fg("dim", ` ${formatElapsed(elapsedMs)}`);
		ctx.ui.setStatus(STATUS_KEY, icon + text);
	}

	function renderDone(ctx: ExtensionContext, elapsedMs: number) {
		const icon = ctx.ui.theme.fg("success", "✓");
		const label = ctx.ui.theme.fg("dim", " task ");
		const value = ctx.ui.theme.fg("muted", formatElapsed(elapsedMs));
		ctx.ui.setStatus(STATUS_KEY, icon + label + value);
	}

	pi.on("agent_start", async (_event, ctx) => {
		stopTimer();

		timer = {
			startedAt: Date.now(),
			interval: setInterval(() => renderRunning(ctx), UPDATE_INTERVAL_MS),
		};

		renderRunning(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!timer) return;

		const elapsedMs = Date.now() - timer.startedAt;
		stopTimer();
		renderDone(ctx, elapsedMs);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTimer();
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}

function formatElapsed(ms: number) {
	const totalSeconds = Math.max(0, ms / 1000);

	if (totalSeconds < 10) {
		return `${totalSeconds.toFixed(1)}s`;
	}

	const roundedSeconds = Math.floor(totalSeconds);
	const seconds = roundedSeconds % 60;
	const totalMinutes = Math.floor(roundedSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	if (hours > 0) {
		return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${pad2(seconds)}s`;
	}

	return `${roundedSeconds}s`;
}

function pad2(value: number) {
	return value.toString().padStart(2, "0");
}
