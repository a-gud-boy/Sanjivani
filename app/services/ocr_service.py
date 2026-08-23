import base64
import io
import logging
from typing import Optional

from fastapi import HTTPException, status
from PIL import Image

logger = logging.getLogger("sanjivani.ocr_service")


class OCRService:
    """
    Service responsible for validating, normalizing, and encoding uploaded medical document images
    (prescriptions, lab reports) into base64 payload strings for direct VLM processing.
    """

    def encode_image(self, file_bytes: bytes, max_dimension: int = 640) -> str:
        """
        Convert raw image binary bytes into a base64-encoded JPEG string.
        Automatically resizes ultra-high-resolution images to `max_dimension`
        to keep VLM input token counts compact and within API rate limits (TPM).

        Args:
            file_bytes: Raw binary bytes of the uploaded image file.
            max_dimension: Maximum width/height in pixels (default 640).

        Returns:
            Base64 encoded string of the normalized JPEG image.

        Raises:
            ValueError: If file_bytes is empty or invalid.
        """
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Uploaded file is empty.")

        try:
            # Attempt PIL image normalization & resizing for compact VLM tokens
            with Image.open(io.BytesIO(file_bytes)) as img:
                img = img.convert("RGB")
                w, h = img.size
                if max(w, h) > max_dimension:
                    scale = max_dimension / max(w, h)
                    new_size = (int(w * scale), int(h * scale))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85)
                return base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception as pil_err:
            logger.warning("PIL normalization failed (%s), falling back to raw base64.", str(pil_err))
            try:
                return base64.b64encode(file_bytes).decode("utf-8")
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
