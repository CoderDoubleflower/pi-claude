function isPackRecord(value) {
	return value !== null && typeof value === "object" && typeof value.filename === "string" && value.filename.length > 0;
}

/**
 * Parse `npm pack --json` output across npm versions.
 *
 * npm 10 commonly returns an array of pack records. Newer npm versions may
 * return an object keyed by workspace package name. A direct record is also
 * accepted for forward compatibility.
 */
export function parseNpmPackJson(stdout, expectedPackageName) {
	let parsed;
	try {
		parsed = JSON.parse(stdout);
	} catch (error) {
		throw new Error(`Invalid npm pack JSON output: ${stdout}`, { cause: error });
	}

	let candidates = [];
	if (Array.isArray(parsed)) {
		candidates = parsed.filter(isPackRecord);
	} else if (isPackRecord(parsed)) {
		candidates = [parsed];
	} else if (parsed !== null && typeof parsed === "object") {
		const expected = expectedPackageName === undefined ? undefined : parsed[expectedPackageName];
		if (isPackRecord(expected)) {
			candidates = [expected];
		} else {
			candidates = Object.values(parsed).filter(isPackRecord);
		}
	}

	if (candidates.length !== 1) {
		const expectation = expectedPackageName === undefined ? "one package" : expectedPackageName;
		throw new Error(`Unexpected npm pack output for ${expectation}: ${stdout}`);
	}

	return candidates[0];
}
