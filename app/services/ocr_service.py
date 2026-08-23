import base64
import logging
from typing import Optional

from fastapi import HTTPException, status

logger = logging.getLogger("sanjivani.ocr_service")


class OCRService:
    """
    Service responsible for validating and encoding uploaded medical document images
    (prescriptions, lab reports) into base64 payload strings for direct VLM processing.
    """

    def encode_image(self, file_bytes: bytes) -> str:
        """
        Convert raw image binary bytes into a base64-encoded ASCII string.
        
        Args:
            file_bytes: Raw binary bytes of the uploaded image file.
            
        Returns:
            Base64 encoded string of the image.
            
        Raises:
            ValueError: If file_bytes is empty or invalid.
        """
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Uploaded file is empty.")

        try:
            encoded = base64.b64encode(file_bytes).decode("utf-8")
            return encoded
        except Exception as e:
            logger.error("Base64 image encoding failed: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process image data: {str(e)}",
            )

    async def extract_text(self, file_bytes: bytes) -> str:
        """
        Legacy interface helper that encodes the image to base64 for backward compatibility.
        """
        return self.encode_image(file_bytes)


# Global singleton instance
_ocr_service: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service
