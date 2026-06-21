from typing import Dict, Any
from backend.app.rag.reranker import rerank_documents
from backend.app.utils.logger import logger

def context_optimization_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Optimizes the retrieved documents to construct the final LLM context.
    
    De-duplicates content, runs BGE Cross-Encoder reranker to narrow candidates down
    to top 5, and sorts them by filename and page to ensure a coherent narrative.
    """
    logger.info("Executing Context Optimization Agent...")
    question = state.get("question", "")
    retrieved_docs = state.get("retrieved_documents", [])
    
    if not retrieved_docs:
        logger.info("No documents retrieved. Context is empty.")
        return {"optimized_context": []}
        
    # 1. Content-based de-duplication
    seen_contents = set()
    unique_docs = []
    
    for doc in retrieved_docs:
        normalized_content = " ".join(doc.page_content.lower().split())
        if normalized_content not in seen_contents:
            seen_contents.add(normalized_content)
            unique_docs.append(doc)
            
    # 2. Rerank from Top 20 candidates down to Top 5 using BGE-Reranker-v2-m3
    logger.info(f"Triggering BGE-Reranker for {len(unique_docs)} unique candidates...")
    reranked_docs = rerank_documents(query=question, documents=unique_docs, top_k=5)
    
    # 3. Sort remaining documents by source and page number to maintain reading order
    try:
        sorted_docs = sorted(
            reranked_docs,
            key=lambda d: (
                d.metadata.get("file_name", ""),
                d.metadata.get("page_number", 0)
            )
        )
    except Exception as e:
        logger.warning(f"Failed to sort documents chronologically: {e}")
        sorted_docs = reranked_docs
        
    logger.info(f"Context Agent optimized docs: {len(retrieved_docs)} -> {len(sorted_docs)}")
    return {"optimized_context": sorted_docs}
