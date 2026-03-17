import fitz  # PyMuPDF
import docx
import io
import os


class DocumentExtractor:
    @staticmethod
    async def extract_text_from_path(file_path: str) -> str:
        """
        Reads a file from the local disk and extracts text based on its extension.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        filename = file_path.lower()

        # Read the file bytes from disk
        with open(file_path, "rb") as f:
            content = f.read()

        if filename.endswith(".pdf"):
            return DocumentExtractor._extract_from_pdf(content)
        elif filename.endswith(".docx"):
            return DocumentExtractor._extract_from_docx(content)
        elif filename.endswith(".txt"):
            return content.decode("utf-8", errors="ignore")
        else:
            raise ValueError(f"Unsupported file format: {filename}")

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