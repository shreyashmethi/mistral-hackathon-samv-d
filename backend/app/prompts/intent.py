"""
intent.py — Intent classification definitions for Mistral function calling.

Intents:
  BRIEFING      — User wants the top news stories ("What's happening?", "Give me the news")
  ENTITY_QUERY  — User asks about a named entity ("Who is X?", "What is the ECB?")
  FOLLOW_UP     — Continuation of current story ("Tell me more", "Why did that happen?")
  NAVIGATION    — Move between stories ("Next story", "Go back", "Skip this")
  CHITCHAT      — Off-topic or greeting ("Hello", "Thanks", "How are you?")
  ARTICLE_MODE  — User pastes a URL or references a specific article (stretch)
"""

INTENT_TOOL_SPEC = {
    "toolSpec": {
        "name": "classify_intent",
        "description": (
            "Classify the user's intent from their utterance and conversation history. "
            "Return the most appropriate intent along with any relevant entity or topic."
        ),
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "intent": {
                        "type": "string",
                        "enum": [
                            "BRIEFING",
                            "ENTITY_QUERY",
                            "FOLLOW_UP",
                            "NAVIGATION",
                            "CHITCHAT",
                            "ARTICLE_MODE",
                        ],
                        "description": "The classified intent of the user's message.",
                    },
                    "entity": {
                        "type": "string",
                        "description": (
                            "For ENTITY_QUERY: the exact name of the person, organisation, "
                            "place, or concept being asked about. Empty string otherwise."
                        ),
                    },
                    "topic": {
                        "type": "string",
                        "description": (
                            "For FOLLOW_UP: a brief description of the topic being followed up on. "
                            "Empty string for other intents."
                        ),
                    },
                    "navigation_direction": {
                        "type": "string",
                        "enum": ["next", "previous", "first", "last", "specific"],
                        "description": "For NAVIGATION intent only: which direction to navigate.",
                    },
                },
                "required": ["intent"],
            }
        },
    }
}

# Mistral-native SDK tool format (for direct API fallback)
INTENT_TOOL_MISTRAL = {
    "type": "function",
    "function": {
        "name": "classify_intent",
        "description": (
            "Classify the user's intent from their utterance and conversation history. "
            "Return the most appropriate intent along with any relevant entity or topic."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": [
                        "BRIEFING",
                        "ENTITY_QUERY",
                        "FOLLOW_UP",
                        "NAVIGATION",
                        "CHITCHAT",
                        "ARTICLE_MODE",
                    ],
                },
                "entity": {"type": "string"},
                "topic": {"type": "string"},
                "navigation_direction": {
                    "type": "string",
                    "enum": ["next", "previous", "first", "last", "specific"],
                },
            },
            "required": ["intent"],
        },
    },
}

INTENT_SYSTEM_PROMPT = """\
You are an intent classifier for Samvād, a voice-first news AI. \
Given the user's utterance and recent conversation history, call the classify_intent function \
with the most appropriate intent. Be decisive — pick one intent only. \
\
Intent guide:
- BRIEFING: user wants news ("What's happening?", "Tell me the news", "Catch me up")
- ENTITY_QUERY: user asks about a named thing ("Who is Lagarde?", "What is NATO?", "Tell me about SpaceX")
- FOLLOW_UP: user wants more on the current story ("Why?", "Tell me more", "And then?", "How does this affect...?")
- NAVIGATION: user wants to move ("Next story", "Skip", "Go back", "First story")
- CHITCHAT: greetings, thanks, off-topic ("Hello", "Thanks", "You're great", "What's the weather?")
- ARTICLE_MODE: user provides a URL or references a specific article directly
"""
