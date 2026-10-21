def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
    """
    Plain character-based splitting with sliding window and boundary snapping.
    Tries to break at paragraph, line, sentence, or word boundaries when possible.
    Strips whitespace and drops empty chunks.
    Ensures new chunks do not start mid-word by snapping next_start to the nearest whitespace.
    """
    if not text:
        return []

    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    total_length = len(text)

    while start < total_length:
        end = min(start + chunk_size, total_length)

        if end == total_length:
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            break

        # Window to search backward for boundaries
        search_start = max(start + overlap, end - int(chunk_size * 0.4))
        search_text = text[search_start:end]

        split_pos = None

        # 1. Paragraph boundary (\n\n)
        p_idx = search_text.rfind("\n\n")
        if p_idx != -1:
            split_pos = search_start + p_idx + 2
        else:
            # 2. Line boundary (\n)
            n_idx = search_text.rfind("\n")
            if n_idx != -1:
                split_pos = search_start + n_idx + 1
            else:
                # 3. Sentence boundary (. , ! , ? )
                best_punct = -1
                for punct in [". ", "! ", "? "]:
                    idx = search_text.rfind(punct)
                    if idx > best_punct:
                        best_punct = idx
                if best_punct != -1:
                    split_pos = search_start + best_punct + 2
                else:
                    # 4. Word boundary (space)
                    space_idx = search_text.rfind(" ")
                    if space_idx != -1:
                        split_pos = search_start + space_idx + 1

        if split_pos is None or split_pos <= start:
            split_pos = end

        chunk = text[start:split_pos].strip()
        if chunk:
            chunks.append(chunk)

        # Advance start position with overlap
        next_start = split_pos - overlap
        if next_start <= start:
            next_start = split_pos
        else:
            # Move next_start forward to the nearest whitespace boundary
            # so the next chunk never starts in the middle of a word
            overlap_text = text[next_start:split_pos]
            ws_offset = None
            for idx, ch in enumerate(overlap_text):
                if ch in (" ", "\n", "\r", "\t"):
                    ws_offset = idx
                    break

            if ws_offset is not None:
                fwd = next_start + ws_offset
                while fwd < split_pos and text[fwd] in (" ", "\n", "\r", "\t"):
                    fwd += 1
                if fwd < split_pos:
                    next_start = fwd

        start = next_start

    return [c for c in chunks if c]
