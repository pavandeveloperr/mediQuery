import pdfParse from 'pdf-parse'

export interface PDFExtractResult {
  text: string
  pageCount: number
}

export async function extractPDFText(buffer: Buffer): Promise<PDFExtractResult> {
  try {
    const result = await pdfParse(buffer)

    const text = result.text.trim()

    if (!text) {
      throw new Error('No text content found in the PDF — the file may be scanned or image-based')
    }

    return {
      text,
      pageCount: result.numpages,
    }
  } catch (error) {
    console.error('[extractPDFText] Failed to parse PDF:', error)
    throw error
  }
}
