# Remote Compaction

Pi-Claude can use the OpenAI Responses remote compaction protocol for providers that explicitly opt in through `models.json`.

## Enable for a provider

Add a provider-level `remoteCompaction` object. `enabled` is the capability switch, while `model` optionally selects a different model under the same provider to execute both the remote compaction request and the parallel portable text summary:

```json
{
  "providers": {
    "openai": {
      "remoteCompaction": {
        "enabled": true,
        "model": "gpt-5.6-sol"
      }
    }
  }
}
```

Omit `model` to use the currently selected conversation model:

```json
{
  "providers": {
    "openai": {
      "remoteCompaction": {
        "enabled": true
      }
    }
  }
}
```

For an OpenAI-compatible proxy:

```json
{
  "providers": {
    "my-responses-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "api": "openai-responses",
      "apiKey": "$MY_PROXY_KEY",
      "remoteCompaction": {
        "enabled": true,
        "model": "gpt-5.6-sol"
      },
      "models": [
        {
          "id": "gpt-5.6-sol",
          "reasoning": true,
          "contextWindow": 272000
        },
        {
          "id": "gpt-5.6-luna",
          "reasoning": true,
          "contextWindow": 272000
        }
      ]
    }
  }
}
```

The configured compaction model is resolved by model ID within the same provider. If it is missing, unavailable, or does not use `openai-responses` or `openai-codex-responses`, Pi-Claude leaves the operation to native compaction.

## Behavior

When normal Pi compaction is triggered, Pi-Claude runs two operations in parallel:

1. A portable text-summary compaction using the configured compaction model.
2. A Responses request using the same configured compaction model, containing the current conversation and a trailing `compaction_trigger` item.

When the remote request succeeds, Pi-Claude stores the returned opaque `compaction` artifact in the local session entry and replays it on later compatible requests. The artifact remains bound to the conversation model that was active when compaction occurred, even when a different model generated it. Session resume, tree navigation, and subsequent compactions reconstruct this state from the session file.

The remote integration does not replace the configured provider transport, enable WebSocket streaming, set `store: true`, or introduce `previous_response_id` continuation. It only handles remote compaction and artifact replay.

If remote compaction fails while the portable summary succeeds, Pi-Claude uses that summary. If both attempts fail, the normal native compaction path remains available as the final fallback.

## Compatibility and data handling

Remote compaction is only activated when all of the following are true:

- `remoteCompaction.enabled` is `true` for the active provider.
- The active conversation model uses `openai-responses` or `openai-codex-responses`, because the stored artifact must be replayed through a Responses request.
- The configured compaction model uses `openai-responses` or `openai-codex-responses`.
- Authentication is available for the configured compaction model.

The full conversation context is sent to the configured compaction model's Responses endpoint. Returned artifacts are provider-native, opaque, and stored in Pi-Claude's local session JSONL. Only sessions using the same provider, API, and conversation model replay a stored artifact.

For generic `openai-responses` providers, Pi-Claude resolves the endpoint from the compaction model's `baseUrl` and calls `/responses`. Providers should only enable this feature when their endpoint implements Responses compaction v2 and returns a streamed `compaction` output item.
