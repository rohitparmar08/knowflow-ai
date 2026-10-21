import logging
import time
from django.conf import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = (
    "Answer using ONLY the provided context. If the context does not contain the answer, "
    "say you could not find it in the user's documents. Cite sources inline as [1], [2] "
    "matching the numbered context blocks. Do not invent facts. "
    "Use only facts and examples that appear in the context. Do not add examples, names or details from your own knowledge."
)


def _classify_error(err_str: str) -> str:
    lower = err_str.lower()
    if any(k in lower for k in ["quota", "429", "resource_exhausted", "rate limit"]):
        return f"LLM quota or rate limit exceeded: {err_str}"
    if any(k in lower for k in ["api key", "401", "403", "unauthenticated", "permission_denied"]):
        return f"LLM authentication failure: {err_str}"
    if any(k in lower for k in ["not found", "404"]):
        return f"LLM model not found: {err_str}"
    return f"LLM generation failed: {err_str}"


def _call_model(client: genai.Client, model: str, prompt: str) -> str:
    response = client.models.generate_content(
        model=model.strip(),
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2,
        ),
    )
    if not response or not response.text:
        return "I could not generate an answer from the provided context."
    return response.text.strip()


def generate_answer(question: str, chunks: list[dict], history: list[dict] = None) -> str:
    """
    Calls the Google GenAI SDK to generate a cited answer based on provided context chunks.
    Raises RuntimeError if configuration is missing or if the API call fails.
    Never logs or exposes the API key.
    """
    api_key = getattr(settings, "LLM_API_KEY", "") or ""
    model_name = getattr(settings, "LLM_MODEL", "") or ""
    fallback_model = getattr(settings, "LLM_FALLBACK_MODEL", "") or ""

    if not api_key.strip():
        raise RuntimeError("LLM_API_KEY is not configured or is empty.")
    if not model_name.strip():
        raise RuntimeError("LLM_MODEL is not configured or is empty.")

    # 1. Format context blocks
    context_lines = []
    for i, c in enumerate(chunks, start=1):
        context_lines.append(
            f"[{i}] ({c['document_title']}, chunk {c['chunk_index']}): {c['content']}"
        )
    context_str = "\n\n".join(context_lines)

    # 2. Format conversation history (up to last 6 messages)
    history_str = ""
    if history:
        recent = history[-6:]
        hist_lines = []
        for msg in recent:
            role_label = "User" if msg.get("role") == "user" else "Assistant"
            hist_lines.append(f"{role_label}: {msg.get('content', '')}")
        if hist_lines:
            history_str = "\n\nConversation History:\n" + "\n".join(hist_lines)

    # 3. Assemble prompt content
    user_prompt = f"Context:\n{context_str}{history_str}\n\nQuestion: {question}"

    delays = [2, 5, 10]
    last_exception = None

    for attempt, delay in enumerate(delays):
        try:
            client = genai.Client(api_key=api_key.strip())
            return _call_model(client, model_name, user_prompt)
        except Exception as e:
            last_exception = e
            err_str = str(e).lower()
            is_transient = any(
                k in err_str
                for k in [
                    "503",
                    "unavailable",
                    "429",
                    "resource_exhausted",
                    "quota",
                    "temporarily",
                    "spikes in demand",
                ]
            )
            if is_transient and attempt < len(delays) - 1:
                time.sleep(delay)
                continue
            break

    # If primary model failed and fallback model is configured, try once with fallback
    if fallback_model and fallback_model.strip() and fallback_model.strip() != model_name.strip():
        try:
            logger.warning(
                "Primary LLM model '%s' failed (%s). Attempting fallback model '%s'...",
                model_name,
                last_exception,
                fallback_model,
            )
            client = genai.Client(api_key=api_key.strip())
            return _call_model(client, fallback_model, user_prompt)
        except Exception as fallback_err:
            logger.error(
                "Fallback LLM model '%s' also failed: %s", fallback_model, fallback_err
            )
            readable_msg = _classify_error(str(fallback_err))
            raise RuntimeError(readable_msg) from fallback_err

    readable_msg = _classify_error(str(last_exception))
    logger.error("LLM call failed: %s", readable_msg)
    raise RuntimeError(readable_msg) from last_exception

