"""LLM Client interface, Google GenAI implementation, and Mock client."""

import asyncio
import logging
from typing import Protocol

from google import genai
from google.genai import types

logger = logging.getLogger("eventease.llm")


class LLMClientProtocol(Protocol):
    """Protocol defining the interface for LLM operations."""

    async def generate_json(self, prompt: str, system_instruction: str) -> str:
        """Asynchronously generate a structured JSON string response."""
        ...


class GeminiClient:
    """Production LLM client utilizing the google-genai SDK."""

    def __init__(
        self,
        api_key: str | None,
        model: str = "gemini-2.5-flash",
        timeout_seconds: float = 10.0,
        max_retries: int = 2,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        """Check whether a non-empty API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    async def generate_json(self, prompt: str, system_instruction: str) -> str:
        """Call Gemini API with bounded retries, timeout, and JSON output constraint."""
        if not self.is_configured:
            raise ValueError("GEMINI_API_KEY is not configured")

        client = genai.Client(api_key=self.api_key)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.7,
            max_output_tokens=1500,
        )

        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                # Wrap SDK async call with strict timeout
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=self.model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=self.timeout_seconds,
                )
                if response.text:
                    return response.text
                raise ValueError("Empty response returned from Gemini API")
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini API attempt %d failed: %s", attempt + 1, str(exc)
                )
                if attempt < self.max_retries:
                    # Exponential backoff: 0.5s, 1.0s
                    await asyncio.sleep(0.5 * (2 ** attempt))

        msg = f"Gemini API failed after {self.max_retries + 1} attempts"
        raise RuntimeError(msg) from last_error


class MockLLMClient:
    """Mock client for testing LLM interactions, errors, timeouts, and fallbacks."""

    def __init__(
        self,
        response_text: str | None = None,
        raise_timeout: bool = False,
        raise_error: bool = False,
        is_configured_value: bool = True,
    ) -> None:
        self.response_text = response_text
        self.raise_timeout = raise_timeout
        self.raise_error = raise_error
        self._is_configured = is_configured_value

    @property
    def is_configured(self) -> bool:
        """Return configured status."""
        return self._is_configured

    async def generate_json(self, prompt: str, system_instruction: str) -> str:
        """Simulate LLM response or failure."""
        _ = (prompt, system_instruction)
        if not self.is_configured:
            raise ValueError("GEMINI_API_KEY is not configured")
        if self.raise_timeout:
            raise TimeoutError("Simulated LLM call timeout")
        if self.raise_error:
            raise RuntimeError("Simulated API failure")
        if self.response_text is not None:
            return self.response_text
        return "{}"
