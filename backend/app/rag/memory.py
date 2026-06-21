from typing import List, Dict, Any

def format_chat_history_for_prompt(chat_history: List[Dict[str, str]], limit: int = 5) -> str:
    """Formats list of message dicts into a plain text history block for the LLM."""
    if not chat_history:
        return "No prior conversation history."
        
    recent_history = chat_history[-limit:]
    formatted = []
    
    for message in recent_history:
        role = "User" if message.get("role") == "user" else "Assistant"
        content = message.get("content", "")
        formatted.append(f"{role}: {content}")
        
    return "\n".join(formatted)
