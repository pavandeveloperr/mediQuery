-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to chunks table
ALTER TABLE "chunks" 
ADD COLUMN "embedding" vector(768);

-- Create index for fast similarity search
CREATE INDEX "chunks_embedding_idx" ON "chunks" 
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
