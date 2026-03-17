import fitz
import docx
import io
from fastapi import UploadFile


class DocumentExtractor:
    @staticmethod
    async def extract_text(file: UploadFile) -> str:
        """
        Reads an UploadFile and extracts text based on its extension.
        Supports .pdf, .docx, and .txt.
        """
        filename = file.filename.lower()
        content = await file.read()

        if filename.endswith(".pdf"):
            return DocumentExtractor._extract_from_pdf(content)
        elif filename.endswith(".docx"):
            return DocumentExtractor._extract_from_docx(content)
        elif filename.endswith(".txt"):
            return content.decode("utf-8", errors="ignore")
        else:
            raise ValueError(f"Unsupported file format: {filename}. Please use PDF, DOCX, or TXT.")

    @staticmethod
    def _extract_from_pdf(content: bytes) -> str:
        text = ""
        with fitz.open(stream=content, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text("text") + "\n"
        return text.strip()

    @staticmethod
    def _extract_from_docx(content: bytes) -> str:
        text = ""
        # Load the binary stream into python-docx
        doc = docx.Document(io.BytesIO(content))
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text.strip()