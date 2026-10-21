import logging
import re
from .llm import generate_answer
from .retrieval import retrieve_chunks

logger = logging.getLogger(__name__)

FALLBACK_ANSWER = "I couldn't find anything relevant in your documents."


def answer_question(
    user,
    question: str,
    conversation=None,
    document_ids: list = None,
    folder_id: int = None,
) -> tuple[str, list[dict]]:
    """
    Coordinates RAG:
    - If conversation has an earlier user message, appends it to query for retrieval.
    - Retrieves relevant chunks; skips LLM if distance threshold is not met.
    - Generates answer via LLM with context chunks and recent history.
    - Filters returned sources to only those explicitly cited as [n] in the answer.
    """
    # 1. Determine retrieval query
    retrieval_query = question
    if conversation:
        last_user_msg = (
            conversation.messages.filter(role="user")
            .order_by("-created_at", "-id")
            .first()
        )
        if last_user_msg and last_user_msg.content.strip():
            retrieval_query = f"{last_user_msg.content.strip()}\n{question.strip()}"

    # 2. Retrieve chunks
    chunks = retrieve_chunks(
        user=user,
        query=retrieval_query,
        document_ids=document_ids,
        folder_id=folder_id,
    )

    if not chunks:
        # Crucial requirement: No chunks survive threshold -> Do NOT call LLM.
        msg = f"[RAG Pipeline] No chunks below distance threshold for user {user.username}. Skipping LLM call."
        print(msg)
        logger.info(msg)
        return FALLBACK_ANSWER, []

    # 3. Prepare conversation history (up to last 6 messages)
    history = []
    if conversation:
        recent_messages = list(conversation.messages.order_by("-created_at", "-id")[:6])
        recent_messages.reverse()
        history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # 4. Generate answer with LLM
    answer = generate_answer(question=question, chunks=chunks, history=history)

    # 5. Build and filter sources to only those cited in the answer as [n]
    cited_indices = set(map(int, re.findall(r"\[(\d+)\]", answer)))

    all_sources = [
        {
            "index": i,
            "document_id": c["document_id"],
            "document_title": c["document_title"],
            "chunk_index": c["chunk_index"],
            "snippet": c["content"][:200],
            "distance": c["distance"],
        }
        for i, c in enumerate(chunks, start=1)
    ]

    sources = [s for s in all_sources if s["index"] in cited_indices]

    return answer, sources
