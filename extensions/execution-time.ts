import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const TASK_STATUS_KEY = "execution-time";
const TOTAL_STATUS_KEY = "zz-execution-time-total";
const STEP_MESSAGE_TYPE = "execution-time-step";
const TASK_UPDATE_INTERVAL_MS = 250;
const TOTAL_UPDATE_INTERVAL_MS = 1000;

type TimerState = {
	startedAt: number;
	interval: ReturnType<typeof setInterval>;
};

type CompletedStep = {
	step: number;
	elapsedMs: number;
	completedAt: Date;
};

export default function (pi: ExtensionAPI) {
	let sessionStartedAt = Date.now();
	let totalInterval: ReturnType<typeof setInterval> | undefined;
	let taskTimer: TimerState | undefined;
	let activeStep: { step: number; startedAt: number } | undefined;
	let nextStep = 1;
	let standardInputsQueued = 0;
	let completedSteps: CompletedStep[] = [];

	function stopTaskTimer() {
		if (!taskTimer) return;
		clearInterval(taskTimer.interval);
		taskTimer = undefined;
	}

	function stopTotalTimer() {
		if (!totalInterval) return;
		clearInterval(totalInterval);
		totalInterval = undefined;
	}

	function stopTimers() {
		stopTaskTimer();
		stopTotalTimer();
	}

	function isStaleContextError(error: unknown) {
		return error instanceof Error && error.message.startsWith("This extension ctx is stale");
	}

	function renderWithContext(ctx: ExtensionContext, render: () => void) {
		try {
			render();
		} catch (error) {
			// A timer can already be queued while pi replaces/reloads a session.
			// Never let a stale ExtensionContext crash the host process.
			if (!isStaleContextError(error)) throw error;
			stopTimers();
		}
	}

	function renderTaskRunning(ctx: ExtensionContext) {
		if (!taskTimer) return;
		const elapsedMs = Date.now() - taskTimer.startedAt;
		const icon = ctx.ui.theme.fg("accent", "⏱");
		const text = ctx.ui.theme.fg("dim", ` ${formatElapsed(elapsedMs)}`);
		ctx.ui.setStatus(TASK_STATUS_KEY, icon + text);
	}

	function renderTaskDone(ctx: ExtensionContext, elapsedMs: number, completedAt: Date) {
		const icon = ctx.ui.theme.fg("success", "✓");
		const label = ctx.ui.theme.fg("dim", " task ");
		const duration = ctx.ui.theme.fg("muted", formatElapsed(elapsedMs));
		const separator = ctx.ui.theme.fg("dim", " · ");
		const completedTime = ctx.ui.theme.fg("muted", formatCompletedAt(completedAt));
		ctx.ui.setStatus(TASK_STATUS_KEY, icon + label + duration + separator + completedTime);
	}

	function renderTotal(ctx: ExtensionContext) {
		const icon = ctx.ui.theme.fg("accent", "Σ");
		const label = ctx.ui.theme.fg("dim", " session ");
		const elapsed = ctx.ui.theme.fg("muted", formatElapsed(Date.now() - sessionStartedAt));
		ctx.ui.setStatus(TOTAL_STATUS_KEY, icon + label + elapsed);
	}

	function renderCompletedSteps() {
		for (const { step, elapsedMs, completedAt } of completedSteps) {
			pi.sendMessage({
				customType: STEP_MESSAGE_TYPE,
				content: "",
				display: true,
				details: { step, elapsedMs, completedAt: completedAt.toISOString() },
			});
		}
		completedSteps = [];
	}

	pi.registerMessageRenderer<{ step: number; elapsedMs: number; completedAt: string }>(
		STEP_MESSAGE_TYPE,
		(message, _options, theme) => {
			const details = message.details;
			const step = details?.step ?? "?";
			const elapsed = typeof details?.elapsedMs === "number" ? formatElapsed(details.elapsedMs) : "?";
			const completedAt = details?.completedAt ? formatCompletedAt(new Date(details.completedAt)) : "?";
			const text = `${theme.fg("success", "✓")} ${theme.fg("dim", `step ${step}`)} ${theme.fg("muted", elapsed)} ${theme.fg("dim", "·")} ${theme.fg("muted", completedAt)}`;
			return new Text(text, 0, 0);
		},
	);

	// Stop callbacks before session replacement starts invalidating the old ctx.
	// session_shutdown also performs cleanup, but replacement can yield while
	// other shutdown handlers run, allowing a captured ctx to fire in between.
	const stopTimersBeforeReplacement = stopTimers;
	pi.on("session_before_switch", async () => {
		stopTimersBeforeReplacement();
	});
	pi.on("session_before_fork", async () => {
		stopTimersBeforeReplacement();
	});

	pi.on("session_start", async (_event, ctx) => {
		sessionStartedAt = Date.now();
		activeStep = undefined;
		standardInputsQueued = 0;
		completedSteps = [];
		nextStep = getNextStep(ctx);
		stopTotalTimer();
		totalInterval = setInterval(() => renderWithContext(ctx, () => renderTotal(ctx)), TOTAL_UPDATE_INTERVAL_MS);
		renderWithContext(ctx, () => renderTotal(ctx));
	});

	pi.on("context", async (event) => ({
		messages: event.messages.filter(
			(message) => message.role !== "custom" || message.customType !== STEP_MESSAGE_TYPE,
		),
	}));

	pi.on("before_agent_start", async () => {
		renderCompletedSteps();
		standardInputsQueued++;
	});

	pi.on("input", async (event) => {
		if (event.source === "extension" || event.streamingBehavior !== "followUp") return;

		standardInputsQueued++;
	});

	pi.on("agent_start", async (_event, ctx) => {
		stopTaskTimer();

		taskTimer = {
			startedAt: Date.now(),
			interval: setInterval(() => renderWithContext(ctx, () => renderTaskRunning(ctx)), TASK_UPDATE_INTERVAL_MS),
		};

		renderWithContext(ctx, () => renderTaskRunning(ctx));
	});

	pi.on("message_start", async (event) => {
		if (event.message.role !== "user" || standardInputsQueued === 0) return;

		if (activeStep) {
			completedSteps.push(completeStep(activeStep, new Date()));
		}

		standardInputsQueued--;
		activeStep = { step: nextStep++, startedAt: Date.now() };
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!taskTimer) return;

		const completedAt = new Date();
		const elapsedMs = completedAt.getTime() - taskTimer.startedAt;
		const completedStep = activeStep;
		stopTaskTimer();
		activeStep = undefined;
		renderTaskDone(ctx, elapsedMs, completedAt);

		if (completedStep) {
			completedSteps.push(completeStep(completedStep, completedAt));
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTimersBeforeReplacement();
		ctx.ui.setStatus(TASK_STATUS_KEY, undefined);
		ctx.ui.setStatus(TOTAL_STATUS_KEY, undefined);
	});
}

function getNextStep(ctx: ExtensionContext) {
	let maxStep = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "custom_message" || entry.customType !== STEP_MESSAGE_TYPE) continue;
		const step = (entry.details as { step?: unknown } | undefined)?.step;
		if (typeof step === "number") maxStep = Math.max(maxStep, step);
	}
	return maxStep + 1;
}

function completeStep(step: { step: number; startedAt: number }, completedAt: Date): CompletedStep {
	return {
		step: step.step,
		elapsedMs: completedAt.getTime() - step.startedAt,
		completedAt,
	};
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

function formatCompletedAt(date: Date) {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad2(value: number) {
	return value.toString().padStart(2, "0");
}
