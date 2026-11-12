import assert from "node:assert/strict";
import test from "node:test";
import executionTime from "../extensions/execution-time.ts";

const TASK_KEY = "execution-time";
const TOTAL_KEY = "zz-execution-time-total";
const STATE_TYPE = "execution-time-session-timer";

function setup(t, initialBranch = []) {
	let now = 1_000;
	let intervalId = 0;
	const intervals = new Map();
	const handlers = new Map();
	const commands = new Map();
	const statuses = new Map();
	const notifications = [];
	const messages = [];
	const entries = [...initialBranch];
	let branch = entries;

	t.mock.method(Date, "now", () => now);
	t.mock.method(globalThis, "setInterval", (callback, delay) => {
		const id = ++intervalId;
		intervals.set(id, { callback, delay });
		return id;
	});
	t.mock.method(globalThis, "clearInterval", (id) => intervals.delete(id));

	const ctx = {
		ui: {
			theme: { fg: (_color, text) => text },
			setStatus: (key, text) => {
				if (text === undefined) statuses.delete(key);
				else statuses.set(key, text);
			},
			notify: (message, level) => notifications.push({ message, level }),
		},
		sessionManager: {
			getBranch: () => branch,
			getEntries: () => entries,
		},
	};
	const pi = {
		on: (event, handler) => handlers.set(event, handler),
		registerCommand: (name, command) => commands.set(name, command),
		registerMessageRenderer: () => {},
		appendEntry: (customType, data) => {
			const entry = { type: "custom", customType, data };
			entries.push(entry);
			if (branch !== entries) branch.push(entry);
		},
		sendMessage: (message) => messages.push(message),
	};
	executionTime(pi);

	return {
		intervals, statuses, notifications, entries, messages,
		command: commands.get("session-timer"),
		run: (args = "") => commands.get("session-timer").handler(args, ctx),
		emit: (name, event = {}) => handlers.get(name)(event, ctx),
		setBranch: (value) => { branch = value; },
		advance: (milliseconds) => {
			now += milliseconds;
			for (const { callback } of [...intervals.values()]) callback();
		},
	};
}

function state(enabled) {
	return { type: "custom", customType: STATE_TYPE, data: { enabled } };
}

test("session timer defaults on; toggle hides it and includes hidden time when restored", async (t) => {
	const app = setup(t);
	await app.emit("session_start");
	assert.equal(app.statuses.get(TOTAL_KEY), "Σ session 0.0s");
	assert.equal(app.intervals.size, 1);

	await app.run();
	assert.equal(app.statuses.has(TOTAL_KEY), false);
	assert.equal(app.intervals.size, 0);
	assert.deepEqual(app.entries, [state(false)]);

	app.advance(12_000);
	await app.run();
	assert.equal(app.statuses.get(TOTAL_KEY), "Σ session 12s");
	assert.equal(app.intervals.size, 1);
	assert.deepEqual(app.entries, [state(false), state(true)]);
});

test("explicit on/off is case-insensitive, idempotent, and validates arguments", async (t) => {
	const app = setup(t);
	await app.emit("session_start");
	await app.run("on");
	assert.equal(app.entries.length, 0);
	await app.run(" OFF ");
	await app.run("off");
	assert.equal(app.entries.length, 1);
	assert.equal(app.intervals.size, 0);

	await app.run("invalid");
	assert.equal(app.entries.length, 1);
	assert.equal(app.statuses.has(TOTAL_KEY), false);
	assert.equal(app.notifications.at(-1).level, "error");
	assert.match(app.notifications.at(-1).message, /Usage:/);

	await app.run(" ON ");
	await app.run("on");
	assert.equal(app.entries.length, 2);
	assert.equal(app.intervals.size, 1);
	assert.deepEqual(app.command.getArgumentCompletions("O"), [
		{ value: "on", label: "on" }, { value: "off", label: "off" },
	]);
	assert.equal(app.command.getArgumentCompletions("invalid"), null);
});

test("session start restores the latest valid saved preference", async (t) => {
	const app = setup(t, [
		state(true), state(false), state("on"),
		{ type: "custom", customType: STATE_TYPE, data: null },
		{ type: "custom", customType: "another-extension", data: { enabled: true } },
	]);
	await app.emit("session_start");
	assert.equal(app.statuses.has(TOTAL_KEY), false);
	assert.equal(app.intervals.size, 0);
	await app.run("on");
	assert.equal(app.statuses.has(TOTAL_KEY), true);

	await app.emit("session_shutdown");
	assert.equal(app.intervals.size, 0);
	await app.emit("session_start");
	assert.equal(app.statuses.has(TOTAL_KEY), true);
	assert.equal(app.intervals.size, 1);
});

test("tree navigation uses the selected branch, not preferences on other branches", async (t) => {
	const app = setup(t, [state(false)]);
	await app.emit("session_start");
	app.setBranch([]);
	app.advance(20_000);
	await app.emit("session_tree");
	assert.equal(app.statuses.get(TOTAL_KEY), "Σ session 20s");
	assert.equal(app.intervals.size, 1);

	app.setBranch([state(true), state(false)]);
	await app.emit("session_tree");
	assert.equal(app.statuses.has(TOTAL_KEY), false);
	assert.equal(app.intervals.size, 0);
});

test("new sessions default on and shutdown clears timers and statuses", async (t) => {
	const app = setup(t);
	await app.emit("session_start");
	await app.run("off");
	await app.emit("session_shutdown");
	app.setBranch([]);
	await app.emit("session_start");
	await app.emit("agent_start");
	assert.equal(app.intervals.size, 2);
	assert.equal(app.statuses.has(TOTAL_KEY), true);
	assert.equal(app.statuses.has(TASK_KEY), true);
	await app.emit("session_shutdown");
	assert.equal(app.intervals.size, 0);
	assert.equal(app.statuses.size, 0);
});

test("disabling the session timer leaves task timing and step history intact", async (t) => {
	const app = setup(t);
	await app.emit("session_start");
	await app.emit("before_agent_start");
	await app.emit("agent_start");
	await app.emit("message_start", { message: { role: "user" } });
	await app.run("off");
	assert.deepEqual([...app.intervals.values()].map(({ delay }) => delay), [250]);
	app.advance(5_000);
	assert.equal(app.statuses.get(TASK_KEY), "⏱ 5.0s");
	assert.equal(app.statuses.has(TOTAL_KEY), false);
	await app.emit("agent_end");
	assert.match(app.statuses.get(TASK_KEY), /^✓ task /);
	assert.equal(app.intervals.size, 0);
	await app.emit("before_agent_start");
	assert.equal(app.messages.length, 1);
	assert.equal(app.messages[0].customType, "execution-time-step");
	assert.equal(app.messages[0].details.step, 1);
});
