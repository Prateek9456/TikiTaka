def normalize_riot_api_key(raw: str | None) -> str:
    if not raw:
        return ""
    key = raw.strip()
    if key.lower().startswith("bearer "):
        key = key[7:].strip()
    if len(key) >= 2 and key[0] == key[-1] and key[0] in "\"'":
        key = key[1:-1].strip()
    return key
