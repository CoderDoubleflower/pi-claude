import assert from "node:assert/strict";
import test from "node:test";
import { parseNpmPackJson } from "./npm-pack-json.mjs";

const record = {
	id: "@doubleflower/pi-claude@0.83.12",
	name: "@doubleflower/pi-claude",
	version: "0.83.12",
	filename: "doubleflower-pi-claude-0.83.12.tgz",
};

test("parses npm 10 array output", () => {
	assert.equal(parseNpmPackJson(JSON.stringify([record]), record.name).filename, record.filename);
});

test("parses newer npm workspace-keyed output", () => {
	assert.equal(
		parseNpmPackJson(JSON.stringify({ [record.name]: record }), record.name).filename,
		record.filename,
	);
});

test("parses a direct pack record", () => {
	assert.equal(parseNpmPackJson(JSON.stringify(record)).filename, record.filename);
});

test("selects the expected workspace from keyed output", () => {
	const other = { ...record, name: "@earendil-works/pi-ai", filename: "pi-ai.tgz" };
	assert.equal(
		parseNpmPackJson(JSON.stringify({ [other.name]: other, [record.name]: record }), record.name).filename,
		record.filename,
	);
});

test("rejects ambiguous output without an expected package", () => {
	const other = { ...record, name: "@earendil-works/pi-ai", filename: "pi-ai.tgz" };
	assert.throws(
		() => parseNpmPackJson(JSON.stringify({ [other.name]: other, [record.name]: record })),
		/Unexpected npm pack output/,
	);
});

test("rejects malformed JSON output", () => {
	assert.throws(() => parseNpmPackJson("not-json"), /Invalid npm pack JSON output/);
});
