import type { RemoteCompactionSessionState, ResponsesRequestShapeState } from "./types.ts";

const remoteCompactionBySessionId = new Map<string, RemoteCompactionSessionState>();
const requestShapeBySessionId = new Map<string, ResponsesRequestShapeState>();

export function getRemoteCompactionState(sessionId: string): RemoteCompactionSessionState | undefined {
	return remoteCompactionBySessionId.get(sessionId);
}

export function setRemoteCompactionState(sessionId: string, state: RemoteCompactionSessionState): void {
	remoteCompactionBySessionId.set(sessionId, state);
}

export function clearRemoteCompactionState(sessionId: string | undefined): void {
	if (sessionId) remoteCompactionBySessionId.delete(sessionId);
}

export function getResponsesRequestShapeState(sessionId: string): ResponsesRequestShapeState | undefined {
	return requestShapeBySessionId.get(sessionId);
}

export function setResponsesRequestShapeState(sessionId: string, state: ResponsesRequestShapeState): void {
	requestShapeBySessionId.set(sessionId, state);
}

export function clearResponsesRequestShapeState(sessionId: string | undefined): void {
	if (sessionId) requestShapeBySessionId.delete(sessionId);
}

export function clearAllRemoteCompactionState(): void {
	remoteCompactionBySessionId.clear();
	requestShapeBySessionId.clear();
}
