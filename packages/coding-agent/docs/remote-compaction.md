# Remote Compaction

Pi-Claude can use the OpenAI Responses remote compaction protocol for providers that explicitly opt in through `models.json`.

## Enable for a provider

Set `compat.supportsRemoteCompaction` to `true` on a provider whose models use `openai-responses` or `openai-codex-responses`:

```json
{
  "providers": {
    "openai": {
      "compat": {
        "supportsRemoteCompaction": true
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
      "compat": {
        "supportsRemoteCompaction": true
      },
      "models": [
        {
          "id": "gpt-5.6-sol",
          "reasoning": true,
          "contextWindow": 272000
        }
      ]
    }
  }
}
```

Provider-level `compat` is inherited by every model. A model or `modelOverrides` entry can set `supportsRemoteCompaction` to `false` to opt out individually.

## Behavior

When normal Pi compaction is triggered, Pi-Claude runs two operations in parallel:

1. Pi's native text-summary compaction, which remains the portable fallback.
2. A Responses request containing the current conversation and a trailing `compaction_trigger` item.

When the remote request succeeds, Pi-Claude stores the returned opaque `compaction` artifact in the local session entry and replays it on later compatible requests. Session resume, tree navigation, and subsequent compactions reconstruct this state from the session file.

The remote integration does not replace the configured provider transport, enable WebSocket streaming, set `store: true`, or introduce `previous_response_id` continuation. It only handles remote compaction and artifact replay.

If remote compaction fails while the local summary succeeds, Pi-Claude uses the local summary. If both attempts fail, the normal compaction path remains available as the final fallback.

## Compatibility and data handling

Remote compaction is only activated when all of the following are true:

- `compat.supportsRemoteCompaction` is `true`.
- The selected model uses `openai-responses` or `openai-codex-responses`.
- Authentication is available for the provider.

The full conversation context is sent to the configured Responses endpoint during compaction. Returned artifacts are provider-native, opaque, and stored in Pi-Claude's local session JSONL. Only sessions using the same provider, API, and model replay a stored artifact.

For generic `openai-responses` providers, Pi-Claude resolves the endpoint from `baseUrl` and calls `/responses`. Providers should only enable this flag when their endpoint implements Responses compaction v2 and returns a streamed `compaction` output item.
