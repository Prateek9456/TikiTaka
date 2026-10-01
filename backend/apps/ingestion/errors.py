class IngestionError(Exception):
    """Raised when ingestion cannot proceed (missing link, API key, etc.)."""

    def __init__(self, message, code="INGESTION_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)
