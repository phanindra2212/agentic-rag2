from typing import Dict, Any
from backend.app.rag.retriever import search_documents
from backend.app.utils.logger import logger

def retrieval_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieves documents from Chroma DB using the generated expanded queries.
    
    Merges results, de-duplicates chunks, and calculates retrieval confidence.
    """
    logger.info("Executing Retrieval Agent...")
    user_id = state.get("user_id")
    generated_queries = state.get("generated_queries", [])
    filters = state.get("filters", {}) or {}
    
    file_names = filters.get("file_names", [])
    file_types = filters.get("file_types", [])
    
    # We retrieve up to 20 raw chunks, then rerank in the next step
    top_k = 20
    
    if not generated_queries:
        current_q = state.get("current_query", state.get("question", ""))
        generated_queries = [current_q]
        
    all_results = {}
    
    # Search for each query variation
    for q in generated_queries:
        scored_docs = search_documents(
            query=q,
            user_id=user_id,
            top_k=top_k,
            file_names=file_names,
            file_types=file_types
        )
        
        # Merge results, keeping the highest similarity score for duplicate chunks
        for doc, similarity in scored_docs:
            chunk_id = doc.metadata.get("chunk_id")
            if not chunk_id:
                chunk_id = doc.page_content
                
            if chunk_id not in all_results or similarity > all_results[chunk_id][1]:
                all_results[chunk_id] = (doc, similarity)
                
    # Sort merged results by similarity score descending
    sorted_results = sorted(all_results.values(), key=lambda x: x[1], reverse=True)
    
    # Take the top 20 candidate documents for reranking
    candidate_results = sorted_results[:top_k]
    
    retrieved_docs = [item[0] for item in candidate_results]
    scores = [item[1] for item in candidate_results]
    
    # Calculate retrieval confidence based on average similarity score of candidates
    avg_score = sum(scores) / len(scores) if scores else 0.0
    
    if avg_score >= 0.70:
        confidence = "High Confidence"
    elif avg_score >= 0.45:
        confidence = "Medium Confidence"
    else:
        confidence = "Low Confidence"
        
    logger.info(
        f"Retrieval Agent complete. Merged {len(sorted_results)} chunks to {len(retrieved_docs)} candidates. "
        f"Average similarity score: {avg_score:.4f} ({confidence})"
    )
    
    return {
        "retrieved_documents": retrieved_docs,
        "confidence_score": confidence,
        "confidence_val": avg_score
    }
